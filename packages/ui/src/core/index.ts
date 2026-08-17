/**
 * UI Core module
 */

export {
  UIOperationManager,
  type UIOperationType,
  type UIOperationStatus,
  type UIOperationResult,
  type UIOperationInput,
  type UIOperationOptions,
  type UIOperationContext,
  type UIPermissionLevel,
  type UIOperationHandler,
  type UIOperationValidationError,
  OPERATION_PERMISSIONS,
  SENSITIVE_OPERATIONS,
  type UIOperationEvents,
  // Input types
  type ClickInput,
  type InputInput,
  type SelectInput,
  type ScrollInput,
  type HoverInput,
  type WaitInput,
  type GetTextInput,
  type GetAttributeInput,
  type ScreenshotInput,
} from './UIOperation.js';

export {
  Sandbox,
  createSandbox,
  type SandboxConfig,
  type SandboxSession,
  type SandboxSessionStatus,
  type SandboxOperationContext,
  type SandboxNetworkRestrictions,
  type PermissionCheckResult,
  DEFAULT_SANDBOX_CONFIG,
  type SandboxEvents,
} from './Sandbox.js';

export {
  UIAgent,
  createUIAgent,
  type UIAgentConfig,
  type UIAgentState,
  type UIAgentStatus,
  type UIAgentEvents,
  type UIOperationRequest,
  DEFAULT_UI_AGENT_CONFIG,
} from './UIAgent.js';
