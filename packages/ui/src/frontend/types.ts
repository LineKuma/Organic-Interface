/**
 * @organic/ui - standard frontend interface types
 *
 * Shared, self-contained input/output types for every capability method of the standard
 * TUI/WebUI interface. They intentionally stay decoupled from the backend service
 * implementations (agent, plugins, storage, ...) so that both frontends implement the
 * exact same contract regardless of their rendering technology.
 */

// ---------------------------------------------------------------------------
// Frontend identity
// ---------------------------------------------------------------------------

/** Distinguishes the two standard frontends. */
export type FrontendKind = 'tui' | 'web';

/** Meta information about a frontend. */
export interface FrontendInfo {
  /** Product name, e.g. `organic` */
  name: string;
  /** Product version */
  version: string;
  /** Frontend kind (`tui` | `web`) */
  kind: FrontendKind;
  /** Any additional metadata the frontend exposes (theme, terminal caps, ...) */
  metadata: Record<string, unknown>;
}

/** Health status of a frontend. */
export interface FrontendHealth {
  /** Whether the frontend is operational */
  ok: boolean;
  /** Human-readable status */
  status: 'ok' | 'degraded' | 'error';
  /** Optional error message */
  error?: string;
}

/** A log entry surfaced by the frontend. */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  scope?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Conversation & sessions
// ---------------------------------------------------------------------------

export interface SessionDescriptor {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Persistent flag (resumable across restarts) */
  persisted: boolean;
}

export interface CreateSessionInput {
  title?: string;
  /** Resume an existing persisted session instead of creating a new one */
  resumeOf?: string;
  context?: Record<string, unknown>;
}

export interface SendMessageInput {
  sessionId: string;
  content: string;
  /** Optional file references attached to this message */
  references?: string[];
}

export interface MessageResult {
  messageId: string;
  sessionId: string;
  /** Assistant reply content */
  content: string;
  /** References that were actually attached */
  references: string[];
  createdAt: number;
}

/** One event yielded while streaming an assistant reply. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; tool: string; status: 'start' | 'complete' | 'error' }
  | { type: 'done'; messageId: string }
  | { type: 'error'; error: string };

// ---------------------------------------------------------------------------
// Agent tasks & orchestration
// ---------------------------------------------------------------------------

export interface TaskInput {
  prompt: string;
  agentId?: string;
  /** Optional orchestration plan to attach */
  planId?: string;
  options?: Record<string, unknown>;
}

export type TaskStatusName = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface TaskInfo {
  taskId: string;
  agentId: string;
  status: TaskStatusName;
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** An orchestration plan presented for user approval. */
export interface OrchestrationPlan {
  planId: string;
  summary: string;
  steps: Array<{ step: string; agentId: string; details?: string }>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export interface WorkflowDescriptor {
  workflowId: string;
  name: string;
  description?: string;
  version: string;
  /** DAG definition (nodes/edges) — opaque to the frontend */
  definition: Record<string, unknown>;
  updatedAt: number;
}

export interface WorkflowExecutionInfo {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'succeeded' | 'failed';
  currentStep?: string;
  startedAt: number;
  finishedAt?: number;
}

// ---------------------------------------------------------------------------
// Prompt management
// ---------------------------------------------------------------------------

export interface PromptDescriptor {
  promptId: string;
  name: string;
  category?: string;
  tags?: string[];
  content: string;
  version: string;
  updatedAt: number;
}

export interface PromptInput {
  name: string;
  content: string;
  category?: string;
  tags?: string[];
  variables?: Record<string, string>;
}

export interface PromptVersionInfo {
  version: string;
  createdAt: number;
  content: string;
}

export interface PromptPreviewInput {
  content: string;
  variables: Record<string, unknown>;
}

export interface PromptPreviewResult {
  rendered: string;
  unresolved: string[];
}

// ---------------------------------------------------------------------------
// File reference
// ---------------------------------------------------------------------------

export interface FileReferenceDescriptor {
  referenceId: string;
  path: string;
  kind: 'file' | 'directory';
  channelId?: string;
  addedAt: number;
}

export interface SymbolInfo {
  name: string;
  type: string;
  line: number;
  column: number;
}

export interface DependencyInfo {
  source: string;
  target: string;
  kind: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ConfigUpdate {
  /** Dot-path key, e.g. `security.default_preset` — empty key replaces whole config */
  key?: string;
  value?: unknown;
}

export interface ConfigWizardDescriptor {
  wizardId: string;
  title: string;
  description: string;
  steps: Array<{ id: string; title: string; type: string }>;
}

// ---------------------------------------------------------------------------
// Security & approval
// ---------------------------------------------------------------------------

export interface SecurityPresetDescriptor {
  id: string;
  label: string;
  description: string;
  active: boolean;
}

export interface ApprovalRequest {
  requestId: string;
  summary: string;
  /** JSON representation of the operation to approve */
  operation?: unknown;
  /** Risk level */
  risk: string;
  createdAt: number;
}

export type ApprovalDecision = 'approve' | 'reject';

export interface ApprovalResult {
  requestId: string;
  decision: ApprovalDecision;
  status: 'resolved' | 'timeout';
}

export interface AuditLogEntry {
  eventId: string;
  action: string;
  actor: string;
  target?: string;
  decision?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// UI as a tool
// ---------------------------------------------------------------------------

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

export interface UIOperationInput {
  operation: UIOperationType;
  selector: string;
  value?: unknown;
  options?: Record<string, unknown>;
}

export interface UIOperationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type UIPermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface FrontendUIState {
  /** Stable list of UI elements the frontend exposes to the agent */
  elements: string[];
  permissionLevel: UIPermissionLevel;
}

// ---------------------------------------------------------------------------
// Operation recording & replay
// ---------------------------------------------------------------------------

export interface RecordingStartInput {
  label?: string;
  scope?: string;
}

export interface RecordingDescriptor {
  recordingId: string;
  label: string;
  scopes: string[];
  /** Number of recorded operations */
  operationCount: number;
  createdAt: number;
  status: 'idle' | 'recording' | 'stopped';
}

export interface ReplayInput {
  recordingId: string;
  speed?: number;
  fromIndex?: number;
  toIndex?: number;
}

export interface ReplaySummary {
  replayId: string;
  recordingId: string;
  replayed: number;
  succeeded: number;
  failed: number;
}
