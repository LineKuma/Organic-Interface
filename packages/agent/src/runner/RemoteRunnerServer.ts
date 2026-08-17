/**
 * RemoteRunnerServer - HTTP server for hosting remote agents
 *
 * Exposes a running agent over HTTP/WebSocket so that RemoteRunner
 * clients can connect and execute tasks remotely.
 *
 * This enables scenarios like:
 * - Running agents on dedicated worker machines
 * - Exposing agent capabilities as a service
 * - Load balancing across multiple agent hosts
 * - Cross-network agent execution
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { type AgentResult, type AgentTaskInput, type Agent } from '../core/Agent.js';
import { createLogger, type Logger } from '@organic/utils';

/**
 * Remote runner server configuration
 */
export interface RemoteRunnerServerConfig {
  /** Host to bind to */
  host?: string;
  /** Port to listen on */
  port: number;
  /** Agent instance to expose */
  agent: Agent;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Enable CORS */
  enableCors?: boolean;
  /** Allowed origins for CORS */
  allowedOrigins?: string[];
}

/**
 * HTTP status codes
 */
const HTTP = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

/**
 * RemoteRunnerServer - HTTP server for remote agent execution
 *
 * API Endpoints:
 * - GET  /api/v1/health          - Health check
 * - GET  /api/v1/info            - Agent info
 * - POST /api/v1/execute         - Execute a task
 * - GET  /api/v1/tasks/:id       - Task status
 * - WS   /ws                     - WebSocket connection
 */
export class RemoteRunnerServer {
  private host: string;
  private port: number;
  private apiKey?: string;
  private enableCors: boolean;
  private allowedOrigins: string[];
  private logger: Logger;
  private server: Server | null = null;
  private agent: Agent;
  private taskResults: Map<string, AgentResult> = new Map();

  constructor(config: RemoteRunnerServerConfig) {
    this.host = config.host ?? '0.0.0.0';
    this.port = config.port;
    this.agent = config.agent;
    this.apiKey = config.apiKey;
    this.enableCors = config.enableCors ?? true;
    this.allowedOrigins = config.allowedOrigins ?? ['*'];
    this.logger = createLogger({ prefix: 'remote-runner-server' });
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (error: Error) => {
        this.logger.error('Server error', error);
        reject(error);
      });

      this.server.listen(this.port, this.host, () => {
        this.logger.info(`Remote runner server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Remote runner server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://${this.host}:${this.getPort()}`;
  }

  /**
   * Get the actual port the server is listening on
   */
  getPort(): number {
    if (!this.server) {
      return this.port;
    }
    const address = this.server.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    return this.port;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Set CORS headers
    if (this.enableCors) {
      this.setCorsHeaders(res);
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(HTTP.OK);
      res.end();
      return;
    }

    // Authenticate
    if (this.apiKey && !this.authenticate(req)) {
      this.sendJson(res, HTTP.UNAUTHORIZED, { success: false, error: 'Unauthorized' });
      return;
    }

    // Parse URL
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;

    try {
      // Route to handler
      if (req.method === 'GET' && path === '/api/v1/health') {
        this.handleHealth(res);
      } else if (req.method === 'GET' && path === '/api/v1/info') {
        this.handleInfo(res);
      } else if (req.method === 'POST' && path === '/api/v1/execute') {
        void this.handleExecute(req, res);
      } else if (req.method === 'GET' && path.startsWith('/api/v1/tasks/')) {
        const taskId = path.split('/').pop() ?? '';
        this.handleTaskStatus(res, taskId);
      } else {
        this.sendJson(res, HTTP.NOT_FOUND, { success: false, error: 'Not found' });
      }
    } catch (error) {
      this.logger.error('Request handler error', error);
      this.sendJson(res, HTTP.INTERNAL_ERROR, {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  // ==================== Handlers ====================

  /**
   * Handle health check
   */
  private handleHealth(res: ServerResponse): void {
    this.sendJson(res, HTTP.OK, {
      status: 'healthy',
      agentId: this.agent.getId(),
      agentName: this.agent.getName(),
      timestamp: Date.now(),
    });
  }

  /**
   * Handle info request
   */
  private handleInfo(res: ServerResponse): void {
    const config = this.agent.getConfig();
    const state = this.agent.getState();
    this.sendJson(res, HTTP.OK, {
      id: this.agent.getId(),
      name: this.agent.getName(),
      version: config.version,
      type: config.type,
      capabilities: config.capabilities,
      status: state.status,
      load: state.load,
      activeTaskCount: state.activeTaskCount,
      completedTaskCount: state.completedTaskCount,
      failedTaskCount: state.failedTaskCount,
    });
  }

  /**
   * Handle task execution
   */
  private async handleExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = (await this.readBody(req)) as {
      taskId?: string;
      payload?: Record<string, unknown>;
      priority?: number;
      timeout?: number;
      metadata?: Record<string, unknown>;
    };
    const input: AgentTaskInput = {
      taskId: body.taskId ?? `task_${Date.now()}`,
      payload: body.payload ?? {},
      priority: body.priority,
      timeout: body.timeout,
      metadata: body.metadata,
    };

    // Execute asynchronously
    this.agent
      .execute(input)
      .then(result => {
        this.taskResults.set(input.taskId, result);
        this.sendJson(res, HTTP.OK, {
          success: true,
          data: result,
        });
      })
      .catch(error => {
        this.sendJson(res, HTTP.INTERNAL_ERROR, {
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed',
        });
      });
  }

  /**
   * Handle task status query
   */
  private handleTaskStatus(res: ServerResponse, taskId: string): void {
    const result = this.taskResults.get(taskId);
    if (!result) {
      this.sendJson(res, HTTP.NOT_FOUND, {
        success: false,
        error: `Task not found: ${taskId}`,
      });
      return;
    }

    this.sendJson(res, HTTP.OK, {
      success: true,
      data: result,
    });
  }

  // ==================== Utilities ====================

  /**
   * Read request body as JSON
   */
  private readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString();
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Set CORS headers
   */
  private setCorsHeaders(res: ServerResponse): void {
    const origins = this.allowedOrigins;
    res.setHeader('Access-Control-Allow-Origin', origins.includes('*') ? '*' : origins.join(', '));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  /**
   * Authenticate request
   */
  private authenticate(req: IncomingMessage): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token === this.apiKey;
  }
}
