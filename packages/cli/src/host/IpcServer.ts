/**
 * IPC Server - Host-side socket server
 *
 * Listens on a Unix domain socket for requests from the
 * lightweight AI helper. Handles validation, routing, and
 * dispatching to the appropriate handlers.
 *
 * The host process (OI kernel) creates an IpcServer and
 * registers handlers for each IPC method. The server
 * validates that requests come from authorized clients
 * and have the proper executor identity.
 *
 * Architecture:
 *   - Helper sends IPC request with executor identity (pid, aiTerminal, conversationId)
 *   - Host validates executor identity and performs permission checks
 *   - Host determines what the helper is allowed to access
 *   - Hard isolation: helper never directly accesses host data
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import { createLogger, type Logger } from '@organic/utils';

import type {
  IpcRequest,
  IpcResponse,
  IpcMethod,
  HistoryListResponse,
  HistoryGetResponse,
  MacroResolveResponse,
  MacroPreviewResponse,
  ConfigListResponse,
} from '../types/ipc.js';

/** Handler function type for IPC methods */
export type IpcHandler = (request: IpcRequest) => Promise<Omit<IpcResponse, 'id'>>;

/** Context provider for the IPC server */
export interface IpcServerContext {
  /** Get all conversation contexts */
  getContexts?: () => HistoryListResponse['contexts'] | Promise<HistoryListResponse['contexts']>;
  /** Get messages for a context */
  getMessages?: (
    contextId: string,
    range?: { start?: number; end?: number },
    lastN?: number
  ) => HistoryGetResponse['messages'] | Promise<HistoryGetResponse['messages']>;
  /** Get total message count for a context */
  getMessageCount?: (contextId: string) => number | Promise<number>;
  /** Resolve macro expressions */
  resolveMacro?: (text: string, contextId?: string) => Promise<MacroResolveResponse>;
  /** Preview macros in text */
  previewMacro?: (text: string) => MacroPreviewResponse;
  /** Get config values */
  getConfig?: (key: string) => unknown;
  /** List all config values */
  listConfig?: () => ConfigListResponse['items'] | Promise<ConfigListResponse['items']>;
  /** Permission check: can this executor access the given conversation? */
  checkPermission?: (executor: IpcRequest['executor'], conversationId: string) => boolean;
}

/**
 * Extract conversation ID from a request.
 * Priority: executor.conversationId > params.contextId
 */
function extractConversationId(req: IpcRequest): string | undefined {
  return req.executor?.conversationId ?? (req.params?.contextId as string | undefined);
}

/**
 * IPC Server
 *
 * Usage:
 * ```typescript
 * const server = new IpcServer('/tmp/oi-ipc.sock');
 * server.setContext({
 *   getContexts: () => contextManager.getAllContexts(),
 *   getMessages: (id, range) => contextManager.getMessages(id, range),
 *   resolveMacro: (text) => macroResolver.resolve(text, ctx),
 *   checkPermission: (executor, ctxId) => executor?.aiTerminal === true,
 * });
 * await server.start();
 * ```
 */
export class IpcServer {
  private socketPath: string;
  private server: net.Server | null = null;
  private handlers: Map<IpcMethod, IpcHandler> = new Map();
  private context: IpcServerContext = {};
  private logger: Logger;

  constructor(socketPath?: string, logger?: Logger) {
    this.socketPath = socketPath ?? '/tmp/oi-ipc-host.sock';
    this.logger = logger ?? createLogger({ prefix: 'IpcServer' });
    this.registerDefaultHandlers();
  }

  /** Get the socket path */
  getSocketPath(): string {
    return this.socketPath;
  }

  /** Set the context provider */
  setContext(context: IpcServerContext): void {
    this.context = context;
  }

  /** Register a custom handler */
  registerHandler(method: IpcMethod, handler: IpcHandler): void {
    this.handlers.set(method, handler);
    this.logger.info(`Handler registered: ${method}`);
  }

  /** Register default handlers */
  private registerDefaultHandlers(): void {
    this.handlers.set('ping', async () => ({
      success: true,
      data: { pong: true, timestamp: Date.now() },
    }));

    this.handlers.set('history.list', async req => {
      if (!this.context.getContexts) {
        return {
          success: false,
          error: 'History context provider not configured',
          errorCode: 'NO_CONTEXT_PROVIDER',
        };
      }

      const conversationId = extractConversationId(req);
      const contexts = await this.context.getContexts();

      const response: HistoryListResponse = {
        contexts,
        currentContextId: conversationId,
      };

      return { success: true, data: response };
    });

    this.handlers.set('history.get', async req => {
      if (!this.context.getMessages) {
        return {
          success: false,
          error: 'Message provider not configured',
          errorCode: 'NO_MESSAGE_PROVIDER',
        };
      }

      const params = req.params ?? {};
      const contextId = (params.contextId as string) ?? extractConversationId(req) ?? 'current';
      const range = params.range as { start?: number; end?: number } | undefined;
      const lastN = params.lastN as number | undefined;

      // Permission check: host validates executor can access this context
      if (this.context.checkPermission && req.executor) {
        if (!this.context.checkPermission(req.executor, contextId)) {
          return {
            success: false,
            error: 'Permission denied: executor cannot access this conversation',
            errorCode: 'PERMISSION_DENIED',
          };
        }
      }

      const messages = await this.context.getMessages(contextId, range, lastN);
      const totalCount = this.context.getMessageCount
        ? await this.context.getMessageCount(contextId)
        : messages.length;

      const response: HistoryGetResponse = {
        contextId,
        totalCount,
        messages,
        range: range ? { start: range.start ?? 0, end: range.end ?? messages.length } : undefined,
      };

      return { success: true, data: response };
    });

    this.handlers.set('history.count', async req => {
      if (!this.context.getMessageCount) {
        return {
          success: false,
          error: 'Message count provider not configured',
          errorCode: 'NO_COUNT_PROVIDER',
        };
      }

      const params = req.params ?? {};
      const contextId = (params.contextId as string) ?? extractConversationId(req) ?? 'current';
      const count = await this.context.getMessageCount(contextId);

      return { success: true, data: { contextId, count } };
    });

    this.handlers.set('macro.resolve', async req => {
      if (!this.context.resolveMacro) {
        return {
          success: false,
          error: 'Macro resolver not configured',
          errorCode: 'NO_MACRO_RESOLVER',
        };
      }

      const params = req.params ?? {};
      const text = params.text as string;
      const contextId = (params.contextId as string) ?? extractConversationId(req);

      if (!text) {
        return {
          success: false,
          error: 'Missing required parameter: text',
          errorCode: 'MISSING_PARAM',
        };
      }

      const result = await this.context.resolveMacro(text, contextId);
      return { success: true, data: result };
    });

    this.handlers.set('macro.preview', async req => {
      if (!this.context.previewMacro) {
        return {
          success: false,
          error: 'Macro preview not configured',
          errorCode: 'NO_MACRO_PREVIEW',
        };
      }

      const params = req.params ?? {};
      const text = params.text as string;

      if (!text) {
        return {
          success: false,
          error: 'Missing required parameter: text',
          errorCode: 'MISSING_PARAM',
        };
      }

      const result = this.context.previewMacro(text);
      return { success: true, data: result };
    });

    this.handlers.set('config.get', async req => {
      if (!this.context.getConfig) {
        return {
          success: false,
          error: 'Config provider not configured',
          errorCode: 'NO_CONFIG_PROVIDER',
        };
      }

      const params = req.params ?? {};
      const key = params.key as string;

      if (!key) {
        return {
          success: false,
          error: 'Missing required parameter: key',
          errorCode: 'MISSING_PARAM',
        };
      }

      const value = this.context.getConfig(key);
      return { success: true, data: { key, value } };
    });

    this.handlers.set('config.list', async _req => {
      if (!this.context.listConfig) {
        return {
          success: false,
          error: 'Config provider not configured',
          errorCode: 'NO_CONFIG_PROVIDER',
        };
      }

      const items = await this.context.listConfig();
      const response: ConfigListResponse = { items };
      return { success: true, data: response };
    });
  }

  /** Start the IPC server */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up old socket file
      try {
        if (fs.existsSync(this.socketPath)) {
          fs.unlinkSync(this.socketPath);
        }
      } catch {
        // Ignore cleanup errors
      }

      this.server = net.createServer(socket => {
        this.handleConnection(socket);
      });

      this.server.on('error', err => {
        this.logger.error(`Server error: ${err.message}`);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        this.logger.info(`IPC server listening on ${this.socketPath}`);
        // Set socket permissions to restrict access
        try {
          fs.chmodSync(this.socketPath, 0o600);
        } catch {
          // Ignore permission errors
        }
        resolve();
      });
    });
  }

  /** Stop the IPC server */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.logger.info('IPC server stopped');
        try {
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }
        } catch {
          // Ignore cleanup errors
        }
        resolve();
      });
    });
  }

  /** Handle an incoming connection */
  private handleConnection(socket: net.Socket): void {
    let data = '';

    socket.on('data', async (chunk: Buffer) => {
      data += chunk.toString();

      // Process complete JSON messages (newline-delimited)
      const lines = data.split('\n');
      data = lines.pop() ?? ''; // Keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request = JSON.parse(line) as IpcRequest;
          await this.processRequest(request, socket);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.error(`Failed to parse request: ${message}`);
          this.sendResponse(socket, {
            id: 'unknown',
            success: false,
            error: `Invalid request: ${message}`,
            errorCode: 'PARSE_ERROR',
          });
        }
      }
    });

    socket.on('error', err => {
      this.logger.debug(`Socket error: ${err.message}`);
    });
  }

  /** Process a single IPC request */
  private async processRequest(request: IpcRequest, socket: net.Socket): Promise<void> {
    this.logger.debug(
      `Processing: ${request.method} (${request.id})` +
        (request.executor ? ` executor=${request.executor.conversationId ?? 'anon'}` : '')
    );

    const handler = this.handlers.get(request.method);
    if (!handler) {
      this.sendResponse(socket, {
        id: request.id,
        success: false,
        error: `Unknown method: ${request.method}`,
        errorCode: 'UNKNOWN_METHOD',
      });
      return;
    }

    try {
      const response = await handler(request);
      this.sendResponse(socket, { id: request.id, ...response });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Handler error for ${request.method}: ${message}`);
      this.sendResponse(socket, {
        id: request.id,
        success: false,
        error: `Handler error: ${message}`,
        errorCode: 'HANDLER_ERROR',
      });
    }
  }

  /** Send a response over the socket */
  private sendResponse(socket: net.Socket, response: IpcResponse): void {
    try {
      const payload = JSON.stringify(response) + '\n';
      socket.write(payload);
    } catch (err) {
      this.logger.debug(`Failed to send response: ${err}`);
    }
  }
}
