/**
 * @organic/ui - UI module
 *
 * Provides UI components, operations, and agent capabilities
 * for Organic Interface.
 */

// Re-export utils
export { createLogger, type Logger, type LogLevel } from '@organic/utils';

// Re-export UI components
export {
  Prompt,
  type PromptType,
  type SelectOption,
  type PromptConfig,
  type PromptResult,
  defaultPrompt,
  createPrompt,
} from './components/Prompt.js';

export {
  Progress,
  type ProgressStyle,
  type ProgressConfig,
  type ProgressState,
  createProgress,
  showProgress,
} from './components/Progress.js';

export {
  Table,
  type TableColumn,
  type TableConfig,
  type TableSortConfig,
  createTable,
  renderTable,
} from './components/Table.js';

// Re-export UI core modules
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
  type UIOperationEvents,
  type ClickInput,
  type InputInput,
  type SelectInput,
  type ScrollInput,
  type HoverInput,
  type WaitInput,
  type GetTextInput,
  type GetAttributeInput,
  type ScreenshotInput,
  OPERATION_PERMISSIONS,
  SENSITIVE_OPERATIONS,
} from './core/UIOperation.js';

export {
  Sandbox,
  createSandbox,
  type SandboxConfig,
  type SandboxSession,
  type SandboxSessionStatus,
  type SandboxOperationContext,
  type SandboxNetworkRestrictions,
  type PermissionCheckResult,
  type SandboxEvents,
  DEFAULT_SANDBOX_CONFIG,
} from './core/Sandbox.js';

export {
  UIAgent,
  createUIAgent,
  type UIAgentConfig,
  type UIAgentState,
  type UIAgentStatus,
  type UIAgentEvents,
  type UIOperationRequest,
  DEFAULT_UI_AGENT_CONFIG,
} from './core/UIAgent.js';

// CLI interface
export { CLI } from './cli/CLI.js';

// Terminal UI - core capability detection and feature toggles
export {
  Terminal,
  type FeatureConfig,
  type TerminalFeatures,
  type ColorDepth,
  DEFAULT_FEATURE_CONFIG,
  terminal,
  ANSI,
  esc,
} from './terminal/Terminal.js';

// Terminal UI - mouse event handling
export {
  MouseHandler,
  createMouseHandler,
  type MouseEvent,
  type MouseEventType,
  type MouseButton,
  type MouseEventCallback,
  type MouseEvents,
} from './terminal/Mouse.js';

// Terminal UI - screen buffer management
export {
  Screen,
  createScreen,
  inAlternateScreen,
  type ResizeEvent,
  type ScreenEvents,
} from './terminal/Screen.js';

// Terminal UI - theme and styling
export {
  type Theme,
  type ThemeColors,
  defaultTheme,
  lowColorTheme,
  noneTheme,
  createTheme,
  createAutoTheme,
  getChalkForDepth,
} from './terminal/Theme.js';

// Terminal UI - styled output
export { Output, defaultOutput, createOutput, type OutputLevel } from './terminal/Output.js';

// Terminal UI - spinner
export { Spinner, createSpinner, withSpinner, type SpinnerOptions } from './terminal/Spinner.js';

// Terminal UI - banner
export {
  Banner,
  defaultBanner,
  createBanner,
  type BannerConfig,
  type BannerStyle,
} from './terminal/Banner.js';

// Terminal UI - box drawing
export { Box, defaultBox, createBox, type BoxConfig, type BoxStyle } from './terminal/Box.js';

/**
 * Module version
 */
export const VERSION = '0.1.0';
