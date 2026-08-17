/**
 * @organic/ui - standard frontend interface for TUI / WebUI
 */

export { NotImplementedError } from './errors.js';

export {
  FRONTEND_CAPABILITIES,
  FRONTEND_METHOD_OWNER,
  getFrontendCoverage,
  type CapabilityGroupDefinition,
  type CapabilityMethodDefinition,
  type FrontendCapabilityCoverage,
  type FrontendCoverageReport,
  type FrontendMethodCoverage,
  type FrontendMethodStatus,
} from './capabilities.js';

export { UIFrontend, type FrontendOptions } from './UIFrontend.js';

export type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalResult,
  AuditLogEntry,
  ConfigUpdate,
  ConfigWizardDescriptor,
  CreateSessionInput,
  DependencyInfo,
  FileReferenceDescriptor,
  FrontendHealth,
  FrontendInfo,
  FrontendKind,
  FrontendUIState,
  LogEntry,
  MessageResult,
  OrchestrationPlan,
  PromptDescriptor,
  PromptInput,
  PromptPreviewInput,
  PromptPreviewResult,
  PromptVersionInfo,
  RecordingDescriptor,
  RecordingStartInput,
  ReplayInput,
  ReplaySummary,
  SecurityPresetDescriptor,
  SendMessageInput,
  SessionDescriptor,
  StreamEvent,
  SymbolInfo,
  TaskInfo,
  TaskInput,
  TaskStatusName,
  UIOperationInput,
  UIOperationResult,
  UIOperationType,
  UIPermissionLevel,
  WorkflowDescriptor,
  WorkflowExecutionInfo,
} from './types.js';
