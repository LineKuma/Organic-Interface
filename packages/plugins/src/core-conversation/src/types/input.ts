/**
 * Input types for core conversation plugin
 */

/**
 * Message sender type
 */
export enum MessageSender {
  /** User message */
  USER = 'user',
  /** Assistant message */
  ASSISTANT = 'assistant',
  /** System message */
  SYSTEM = 'system',
  /** Tool message */
  TOOL = 'tool',
}

/**
 * Input format enum
 */
export enum InputFormat {
  /** Plain text */
  PLAIN_TEXT = 'plain_text',
  /** Structured command */
  COMMAND = 'command',
  /** JSON format */
  JSON = 'json',
}

/**
 * Message interface
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Message content */
  content: string;
  /** Message sender */
  sender: MessageSender;
  /** Timestamp */
  timestamp: number;
  /** Associated session ID */
  sessionId?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parsed input result
 */
export interface ParsedInput {
  /** Input type */
  type: InputType;
  /** Raw input text */
  rawText: string;
  /** Normalized text */
  normalizedText: string;
  /** Extracted command */
  command?: string;
  /** Extracted arguments */
  arguments?: Record<string, unknown>;
  /** Extracted options */
  options?: InputOptions;
  /** Metadata */
  metadata: InputMetadata;
}

/**
 * Input type enum
 */
export enum InputType {
  /** Plain text message */
  TEXT = 'text',
  /** Command input */
  COMMAND = 'command',
  /** Tool result */
  TOOL_RESULT = 'tool_result',
  /** System message */
  SYSTEM_MESSAGE = 'system_message',
}

/**
 * Input options
 */
export interface InputOptions {
  /** Stream response flag */
  stream?: boolean;
  /** Priority flag */
  priority?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Custom options */
  [key: string]: unknown;
}

/**
 * Input metadata
 */
export interface InputMetadata {
  /** Parse timestamp */
  timestamp: number;
  /** Original length */
  originalLength: number;
  /** Token estimate */
  tokenEstimate?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors?: ValidationError[];
  /** Warnings */
  warnings?: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error position */
  position?: number;
  /** Field path */
  field?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
}
