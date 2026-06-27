/**
 * UIOperation - Core UI operation interfaces and types
 *
 * Defines standardized UI operation interfaces for AI-driven
 * interface interactions.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';

/**
 * UI Operation types
 */
export type UIOperationType =
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'getText'
  | 'getAttribute'
  | 'screenshot';

/**
 * Operation status
 */
export type UIOperationStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

/**
 * UI Operation result
 */
export interface UIOperationResult<T = unknown> {
  /** Operation ID */
  operationId: string;

  /** Operation type */
  type: UIOperationType;

  /** Whether operation was successful */
  success: boolean;

  /** Result data */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Status */
  status: UIOperationStatus;

  /** Timestamp */
  timestamp: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base UI Operation input
 */
export interface UIOperationInput {
  /** Target selector (CSS selector, XPath, or element identifier) */
  selector: string;

  /** Operation options */
  options?: UIOperationOptions;
}

/**
 * UI Operation options
 */
export interface UIOperationOptions {
  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry count */
  retry?: number;

  /** Wait for element to be visible */
  waitForVisible?: boolean;

  /** Wait for element to be enabled */
  waitForEnabled?: boolean;

  /** Position for click/scroll operations */
  position?: { x: number; y: number };

  /** Click type (for click operation) */
  clickType?: 'left' | 'right' | 'double';

  /** Scroll direction (for scroll operation) */
  direction?: 'up' | 'down' | 'left' | 'right';

  /** Scroll amount in pixels */
  distance?: number;

  /** Delay before operation in milliseconds */
  delay?: number;
}

/**
 * Click operation input
 */
export interface ClickInput extends UIOperationInput {
  clickType?: 'left' | 'right' | 'double';
  position?: { x: number; y: number };
}

/**
 * Input operation input
 */
export interface InputInput extends UIOperationInput {
  value: string;
  append?: boolean;
  clear?: boolean;
}

/**
 * Select operation input
 */
export interface SelectInput extends UIOperationInput {
  value: string | string[];
  by?: 'value' | 'label' | 'index';
}

/**
 * Scroll operation input
 */
export interface ScrollInput extends UIOperationInput {
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  position?: { x: number; y: number };
}

/**
 * Hover operation input
 */
export interface HoverInput extends UIOperationInput {
  position?: { x: number; y: number };
}

/**
 * Wait operation input
 */
export interface WaitInput extends UIOperationInput {
  condition?: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'exists';
  timeout?: number;
}

/**
 * Get text operation input
 */
export interface GetTextInput extends UIOperationInput {
  all?: boolean;
}

/**
 * Get attribute operation input
 */
export interface GetAttributeInput extends UIOperationInput {
  attribute: string;
}

/**
 * Screenshot operation input
 */
export interface ScreenshotInput extends UIOperationInput {
  fullPage?: boolean;
  encoding?: 'base64' | 'binary';
}

/**
 * UI Operation execution context
 */
export interface UIOperationContext {
  /** Operation ID */
  operationId: string;

  /** Agent ID */
  agentId: string;

  /** Session ID */
  sessionId: string;

  /** Permission level */
  permissionLevel: UIPermissionLevel;

  /** Timeout settings */
  timeout: number;

  /** Retry settings */
  retryCount: number;

  /** Sandbox enabled */
  sandboxEnabled: boolean;

  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * UI Permission levels
 */
export type UIPermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * Permission requirements for operations
 */
export const OPERATION_PERMISSIONS: Record<UIOperationType, UIPermissionLevel> = {
  click: 'L2',
  input: 'L2',
  select: 'L2',
  scroll: 'L1',
  hover: 'L1',
  wait: 'L1',
  getText: 'L1',
  getAttribute: 'L1',
  screenshot: 'L1',
};

/**
 * Sensitive operations requiring confirmation
 */
export const SENSITIVE_OPERATIONS: UIOperationType[] = [
  'input', // Inputting sensitive data
  'click', // Clicking potentially destructive buttons
];

/**
 * UI Operation handler interface
 */
export interface UIOperationHandler {
  /** Get operation type */
  getType(): UIOperationType;

  /** Check if handler supports the operation */
  supports(operation: UIOperationType): boolean;

  /** Execute the operation */
  execute(input: unknown, context: UIOperationContext): Promise<UIOperationResult>;

  /** Validate operation input */
  validate(input: unknown): UIOperationValidationError[];
}

/**
 * Operation validation error
 */
export interface UIOperationValidationError {
  path: string;
  message: string;
  expected?: string;
  actual?: unknown;
}

/**
 * UIOperationManager - Manages UI operations
 */
export class UIOperationManager extends EventEmitter {
  /** Operation handlers */
  private handlers: Map<UIOperationType, UIOperationHandler> = new Map();

  /** Logger instance */
  private logger: Logger;

  /** Operation counter */
  private operationCounter: number = 0;

  /**
   * Create a new UIOperationManager
   */
  constructor() {
    super();
    this.logger = createLogger({ prefix: 'ui-operation-manager' });
  }

  /**
   * Register an operation handler
   */
  registerHandler(handler: UIOperationHandler): void {
    const type = handler.getType();
    this.handlers.set(type, handler);
    this.logger.debug(`Registered handler for operation: ${type}`);
  }

  /**
   * Unregister an operation handler
   */
  unregisterHandler(type: UIOperationType): boolean {
    return this.handlers.delete(type);
  }

  /**
   * Get handler for operation type
   */
  getHandler(type: UIOperationType): UIOperationHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Execute an operation
   */
  async execute(
    type: UIOperationType,
    input: unknown,
    context: UIOperationContext
  ): Promise<UIOperationResult> {
    const operationId = `${type}_${++this.operationCounter}_${Date.now()}`;
    const startTime = Date.now();

    this.logger.info(`Executing UI operation: ${type} (${operationId})`);

    // Get handler
    const handler = this.handlers.get(type);
    if (!handler) {
      return {
        operationId,
        type,
        success: false,
        error: `No handler registered for operation: ${type}`,
        executionTime: Date.now() - startTime,
        status: 'failed',
        timestamp: Date.now(),
      };
    }

    // Validate input
    const errors = handler.validate(input);
    if (errors.length > 0) {
      return {
        operationId,
        type,
        success: false,
        error: `Validation failed: ${errors.map(e => e.message).join(', ')}`,
        executionTime: Date.now() - startTime,
        status: 'failed',
        timestamp: Date.now(),
        metadata: { validationErrors: errors },
      };
    }

    // Emit start event
    this.emit('operation:start', { operationId, type, timestamp: startTime });

    try {
      // Execute with retry
      let lastError: Error | undefined;
      const maxRetries = context.retryCount;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await handler.execute(input, context);

          this.emit('operation:complete', {
            operationId,
            type,
            result,
            timestamp: Date.now(),
          });

          return {
            ...result,
            operationId,
            timestamp: Date.now(),
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries) {
            this.logger.warn(
              `Operation failed, retrying (${attempt + 1}/${maxRetries}): ${lastError.message}`
            );
            await this.delay(100 * (attempt + 1)); // Exponential backoff
          }
        }
      }

      // All retries failed
      return {
        operationId,
        type,
        success: false,
        error: lastError?.message ?? 'Operation failed',
        executionTime: Date.now() - startTime,
        status: 'failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emit('operation:error', {
        operationId,
        type,
        error: errorMessage,
        timestamp: Date.now(),
      });

      return {
        operationId,
        type,
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
        status: 'failed',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check if operation requires confirmation
   */
  requiresConfirmation(type: UIOperationType): boolean {
    return SENSITIVE_OPERATIONS.includes(type);
  }

  /**
   * Check if operation is allowed for permission level
   */
  isAllowed(type: UIOperationType, level: UIPermissionLevel): boolean {
    const required = OPERATION_PERMISSIONS[type];
    const levels: UIPermissionLevel[] = ['L1', 'L2', 'L3', 'L4'];
    return levels.indexOf(level) >= levels.indexOf(required);
  }

  /**
   * Get registered operation types
   */
  getSupportedOperations(): UIOperationType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * UI Operation events
 */
export interface UIOperationEvents {
  'operation:start': { operationId: string; type: UIOperationType; timestamp: number };
  'operation:complete': {
    operationId: string;
    type: UIOperationType;
    result: UIOperationResult;
    timestamp: number;
  };
  'operation:error': {
    operationId: string;
    type: UIOperationType;
    error: string;
    timestamp: number;
  };
  'operation:cancelled': { operationId: string; timestamp: number };
}
