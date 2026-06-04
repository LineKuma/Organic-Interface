/**
 * Message - Message structure for agent communication
 *
 * Defines the message format used for communication between
 * agents, users, and the system.
 */

/**
 * Message type enumeration
 */
export enum MessageType {
  /** User message */
  USER_MESSAGE = 'user_message',
  /** Assistant/Agent reply */
  ASSISTANT_MESSAGE = 'assistant_message',
  /** System message */
  SYSTEM_MESSAGE = 'system_message',
  /** Tool call request */
  TOOL_CALL = 'tool_call',
  /** Tool response */
  TOOL_RESPONSE = 'tool_response',
  /** Error message */
  ERROR_MESSAGE = 'error_message',
  /** Status update */
  STATUS_UPDATE = 'status_update',
}

/**
 * Message status enumeration
 */
export enum MessageStatus {
  /** Message is being sent */
  SENDING = 'sending',
  /** Message has been sent */
  SENT = 'sent',
  /** Message has been delivered */
  DELIVERED = 'delivered',
  /** Message has been read */
  READ = 'read',
  /** Message processing failed */
  FAILED = 'failed',
}

/**
 * Message flag enumeration
 */
export enum MessageFlag {
  /** Message is flagged */
  FLAGGED = 'flagged',
  /** Message is starred */
  STARRED = 'starred',
  /** Message is deleted */
  DELETED = 'deleted',
  /** Message is archived */
  ARCHIVED = 'archived',
  /** Message is private */
  PRIVATE = 'private',
}

/**
 * Content format enumeration
 */
export enum ContentFormat {
  PLAIN_TEXT = 'plain_text',
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  CODE = 'code',
}

/**
 * Attachment type enumeration
 */
export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  CODE_FILE = 'code_file',
  OTHER = 'other',
}

/**
 * Message sender
 */
export interface MessageSender {
  /** Sender ID */
  id: string;
  /** Sender type */
  type: 'user' | 'agent' | 'system' | 'plugin';
  /** Sender name */
  name: string;
  /** Sender role */
  role?: string;
}

/**
 * Message content
 */
export interface MessageContent {
  /** Text content */
  text?: string;
  /** Attachments */
  attachments?: Attachment[];
  /** Structured data */
  structured_data?: Record<string, unknown>;
  /** Content format */
  format: ContentFormat;
}

/**
 * Attachment
 */
export interface Attachment {
  /** Attachment type */
  type: AttachmentType;
  /** Attachment URL or path */
  url: string;
  /** Attachment name */
  name: string;
  /** Attachment size in bytes */
  size?: number;
  /** MIME type */
  mime_type: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool call information
 */
export interface ToolCall {
  /** Tool name */
  name: string;
  /** Tool parameters */
  params: Record<string, unknown>;
  /** Tool call ID */
  call_id?: string;
}

/**
 * Tool response
 */
export interface ToolResponse {
  /** Tool name */
  name: string;
  /** Success flag */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message */
  error?: string;
  /** Execution time in milliseconds */
  execution_time?: number;
}

/**
 * Message
 */
export interface Message {
  /** Message unique ID */
  id: string;
  /** Message sender */
  sender: MessageSender;
  /** Message content */
  content: MessageContent;
  /** Message type */
  type: MessageType;
  /** Associated tool call */
  tool_call?: ToolCall;
  /** Associated tool response */
  tool_response?: ToolResponse;
  /** Message timestamp */
  timestamp: number;
  /** Message status */
  status: MessageStatus;
  /** Message flags */
  flags: MessageFlag[];
  /** Reply to message ID */
  reply_to?: string;
  /** Conversation/Context ID */
  context_id?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message creation options
 */
export interface MessageOptions {
  /** Sender */
  sender: MessageSender;
  /** Content */
  content: MessageContent;
  /** Message type */
  type: MessageType;
  /** Tool call */
  tool_call?: ToolCall;
  /** Tool response */
  tool_response?: ToolResponse;
  /** Reply to message ID */
  reply_to?: string;
  /** Context ID */
  context_id?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new message
 */
export function createMessage(options: MessageOptions): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sender: options.sender,
    content: options.content,
    type: options.type,
    tool_call: options.tool_call,
    tool_response: options.tool_response,
    timestamp: Date.now(),
    status: MessageStatus.SENDING,
    flags: [],
    reply_to: options.reply_to,
    context_id: options.context_id,
    metadata: options.metadata,
  };
}

/**
 * Create a user message
 */
export function createUserMessage(
  userId: string,
  userName: string,
  text: string,
  contextId?: string
): Message {
  return createMessage({
    sender: { id: userId, type: 'user', name: userName },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.USER_MESSAGE,
    context_id: contextId,
  });
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  agentId: string,
  agentName: string,
  text: string,
  contextId?: string
): Message {
  return createMessage({
    sender: { id: agentId, type: 'agent', name: agentName },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.ASSISTANT_MESSAGE,
    context_id: contextId,
  });
}

/**
 * Create a tool call message
 */
export function createToolCallMessage(
  senderId: string,
  senderName: string,
  toolName: string,
  params: Record<string, unknown>,
  contextId?: string
): Message {
  return createMessage({
    sender: { id: senderId, type: 'agent', name: senderName },
    content: { text: `Calling tool: ${toolName}`, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.TOOL_CALL,
    tool_call: { name: toolName, params },
    context_id: contextId,
  });
}

/**
 * Create a tool response message
 */
export function createToolResponseMessage(
  senderId: string,
  senderName: string,
  response: ToolResponse,
  originalToolCall?: ToolCall,
  contextId?: string
): Message {
  return createMessage({
    sender: { id: senderId, type: 'system', name: senderName },
    content: {
      text: response.success ? `Tool ${response.name} succeeded` : `Tool ${response.name} failed`,
      format: ContentFormat.JSON,
      structured_data: { response },
    },
    type: MessageType.TOOL_RESPONSE,
    tool_call: originalToolCall,
    tool_response: response,
    context_id: contextId,
  });
}

/**
 * Create a system message
 */
export function createSystemMessage(text: string, contextId?: string): Message {
  return createMessage({
    sender: { id: 'system', type: 'system', name: 'System' },
    content: { text, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.SYSTEM_MESSAGE,
    context_id: contextId,
  });
}

/**
 * Create an error message
 */
export function createErrorMessage(
  senderId: string,
  senderName: string,
  errorMessage: string,
  contextId?: string
): Message {
  return createMessage({
    sender: { id: senderId, type: 'system', name: senderName },
    content: { text: errorMessage, format: ContentFormat.PLAIN_TEXT },
    type: MessageType.ERROR_MESSAGE,
    context_id: contextId,
  });
}

/**
 * Validate message structure
 */
export function isValidMessage(message: unknown): message is Message {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;
  return (
    typeof msg.id === 'string' &&
    typeof msg.sender === 'object' &&
    typeof msg.content === 'object' &&
    Object.values(MessageType).includes(msg.type as MessageType)
  );
}
