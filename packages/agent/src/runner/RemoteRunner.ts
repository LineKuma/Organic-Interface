/**
 * RemoteRunner - Remote agent execution via HTTP/WebSocket
 *
 * Executes agent tasks on a remote runner server over HTTP or WebSocket.
 * This enables distributed agent execution across multiple machines.
 *
 * Communication protocol:
 * - RESTful HTTP for task submission and status queries
 * - WebSocket for real-time streaming and event notifications
 * - JSON serialization for task inputs and results
 */

import { type AgentResult, type AgentTaskInput } from '../core/Agent.js';
import {
  AgentRunner,
  RunnerMode,
  RunnerHealthStatus,
  type RunnerConfig,
  DEFAULT_RUNNER_CONFIG,
} from './AgentRunner.js';

/**
 * Remote runner transport protocol
 */
export enum RemoteTransport {
  HTTP = 'http',
  WEBSOCKET = 'websocket',
}

/**
 * Remote runner configuration
 */
export interface RemoteRunnerConfig extends RunnerConfig {
  /** Remote server URL (e.g. http://host:port) */
  remoteUrl: string;
  /** Transport protocol */
  transport?: RemoteTransport;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Reconnection options */
  reconnect?: {
    /** Maximum reconnection attempts */
    maxAttempts: number;
    /** Base delay in ms */
    baseDelay: number;
  };
}

/**
 * Default remote runner configuration
 */
export const DEFAULT_REMOTE_RUNNER_CONFIG: Partial<RemoteRunnerConfig> = {
  ...DEFAULT_RUNNER_CONFIG,
  transport: RemoteTransport.HTTP,
  requestTimeout: 30000,
  reconnect: {
    maxAttempts: 5,
    baseDelay: 1000,
  },
};

/**
 * Remote runner API response
 */
interface RemoteApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * RemoteRunner - HTTP/WebSocket remote execution
 *
 * Features:
 * - HTTP REST API for task execution
 * - WebSocket support for real-time streaming
 * - Automatic reconnection with exponential backoff
 * - API key authentication
 * - Health check via remote endpoint
 * - Task status polling
 */
export class RemoteRunner extends AgentRunner {
  private remoteUrl: string;
  private transport: RemoteTransport;
  private apiKey?: string;
  private requestTimeout: number;
  private reconnectConfig: { maxAttempts: number; baseDelay: number };
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private pendingTasks: Map<
    string,
    {
      resolve: (value: AgentResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();

  constructor(config: RemoteRunnerConfig) {
    super({
      ...DEFAULT_REMOTE_RUNNER_CONFIG,
      ...config,
      mode: RunnerMode.REMOTE,
    } as RemoteRunnerConfig);
    this.remoteUrl = config.remoteUrl.replace(/\/+$/, '');
    this.transport = config.transport ?? RemoteTransport.HTTP;
    this.apiKey = config.apiKey;
    this.requestTimeout = config.requestTimeout ?? 30000;
    this.reconnectConfig = config.reconnect ?? { maxAttempts: 5, baseDelay: 1000 };
  }

  /**
   * Start the remote runner and connect to the remote server
   */
  async start(): Promise<void> {
    await super.start();

    if (this.transport === RemoteTransport.WEBSOCKET) {
      await this.connectWebSocket();
    }

    // Verify connectivity
    const healthy = await this.healthCheck();
    if (healthy === RunnerHealthStatus.HEALTHY) {
      this.logger.info(`Remote runner connected to: ${this.remoteUrl}`);
    } else {
      this.logger.warn(`Remote runner could not verify connectivity to: ${this.remoteUrl}`);
    }
  }

  /**
   * Stop the remote runner
   */
  async stop(): Promise<void> {
    this.disconnectWebSocket();
    // Reject all pending tasks
    for (const [taskId, pending] of this.pendingTasks) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Runner stopped'));
      this.pendingTasks.delete(taskId);
    }
    await super.stop();
  }

  /**
   * Execute a task on the remote server
   */
  async execute<R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>> {
    if (!this.started) {
      return {
        success: false,
        error: 'Remote runner not started',
        executionTime: 0,
      };
    }

    this.trackTaskStart(input.taskId);

    try {
      if (this.transport === RemoteTransport.WEBSOCKET && this.wsConnection) {
        return await this.executeViaWebSocket<R>(input);
      }
      return await this.executeViaHttp<R>(input);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.trackTaskError(input.taskId, err);
      return {
        success: false,
        error: err.message,
        executionTime: 0,
      };
    }
  }

  /**
   * Execute a task via HTTP POST
   */
  private async executeViaHttp<R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.remoteUrl}/api/v1/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          taskId: input.taskId,
          payload: input.payload,
          priority: input.priority,
          timeout: input.timeout ?? this.requestTimeout,
          metadata: input.metadata,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Remote execution failed (${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as RemoteApiResponse<AgentResult<R>>;

      if (!result.success) {
        throw new Error(result.error ?? 'Remote execution returned failure');
      }

      if (!result.data) {
        throw new Error('Remote execution returned no data');
      }

      const agentResult = result.data;
      agentResult.executionTime = Date.now() - startTime;
      this.trackTaskComplete(input.taskId, agentResult);
      return agentResult;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /**
   * Execute a task via WebSocket
   */
  private executeViaWebSocket<R = unknown>(input: AgentTaskInput): Promise<AgentResult<R>> {
    return new Promise((resolve, reject) => {
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingTasks.delete(input.taskId);
        reject(new Error(`Task ${input.taskId} timed out`));
      }, input.timeout ?? this.requestTimeout);

      this.pendingTasks.set(input.taskId, {
        resolve: resolve as (value: AgentResult) => void,
        reject,
        timeout,
      });

      this.wsConnection.send(
        JSON.stringify({
          type: 'execute',
          taskId: input.taskId,
          payload: input.payload,
          priority: input.priority,
          metadata: input.metadata,
        })
      );
    });
  }

  /**
   * Perform a health check against the remote server
   */
  async healthCheck(): Promise<RunnerHealthStatus> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.remoteUrl}/api/v1/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        this.setHealth(RunnerHealthStatus.DEGRADED);
        return RunnerHealthStatus.DEGRADED;
      }

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const healthy = data.status === 'healthy' || data.status === 'ok';

      if (healthy) {
        this.setHealth(RunnerHealthStatus.HEALTHY);
      } else {
        this.setHealth(RunnerHealthStatus.DEGRADED);
      }

      return this.healthStatus;
    } catch {
      this.setHealth(RunnerHealthStatus.UNHEALTHY);
      return RunnerHealthStatus.UNHEALTHY;
    }
  }

  // ==================== WebSocket ====================

  /**
   * Connect to the remote server via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    const wsUrl = `${this.remoteUrl.replace(/^http/, 'ws')}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      this.wsConnection = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string);
          this.handleWsMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message', error);
        }
      };

      ws.onclose = () => {
        this.logger.warn('WebSocket disconnected');
        this.wsConnection = null;
        void this.attemptReconnect();
      };

      ws.onerror = (error: Event) => {
        this.logger.error('WebSocket error', error);
      };

      // Wait for connection and send authentication
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
        ws.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          if (this.apiKey) {
            ws.send(JSON.stringify({ type: 'auth', apiKey: this.apiKey }));
          }
          this.logger.info(`WebSocket connected to: ${wsUrl}`);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });
    } catch (error) {
      this.logger.error('Failed to connect WebSocket', error);
      throw error;
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWsMessage(message: Record<string, unknown>): void {
    const type = message.type as string;

    switch (type) {
      case 'result': {
        const taskId = message.taskId as string;
        const pending = this.pendingTasks.get(taskId);
        if (pending) {
          clearTimeout(pending.timeout);
          const result = message.result as AgentResult;
          this.trackTaskComplete(taskId, result);
          pending.resolve(result);
          this.pendingTasks.delete(taskId);
        }
        break;
      }
      case 'error': {
        const taskId = message.taskId as string;
        const pending = this.pendingTasks.get(taskId);
        if (pending) {
          clearTimeout(pending.timeout);
          const errorMsg = (message.error as string | undefined) ?? 'Unknown remote error';
          const error = new Error(errorMsg);
          this.trackTaskError(taskId, error);
          pending.reject(error);
          this.pendingTasks.delete(taskId);
        }
        break;
      }
      case 'heartbeat': {
        this.setHealth(RunnerHealthStatus.HEALTHY);
        break;
      }
      default:
        this.logger.debug(`Unhandled WebSocket message type: ${type}`);
    }
  }

  /**
   * Disconnect WebSocket
   */
  private disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.onclose = null;
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts || !this.started) {
      this.logger.error('Max reconnection attempts reached');
      this.setHealth(RunnerHealthStatus.OFFLINE);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectConfig.baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    this.logger.info(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.reconnectConfig.maxAttempts})`
    );

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connectWebSocket();
      this.logger.info('Reconnected successfully');
    } catch {
      await this.attemptReconnect();
    }
  }
}
