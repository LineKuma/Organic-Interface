/**
 * @organic/ui - Terminal module
 *
 * Provides styled terminal output components using chalk and ora.
 * Supports modern terminal features with toggleable options:
 * - Mouse events (click, scroll, drag, move)
 * - Screen buffer management (alternate screen, cursor control, resize)
 * - Color capability auto-detection (trueColor / 256 / 16 / none)
 * - Feature toggles for all capabilities
 */

export {
  Terminal,
  type FeatureConfig,
  type TerminalFeatures,
  type ColorDepth,
  DEFAULT_FEATURE_CONFIG,
  terminal,
  ANSI,
  esc,
} from './Terminal.js';

export {
  MouseHandler,
  createMouseHandler,
  type MouseEvent,
  type MouseEventType,
  type MouseButton,
  type MouseEventCallback,
  type MouseEvents,
} from './Mouse.js';

export {
  Screen,
  createScreen,
  inAlternateScreen,
  type ResizeEvent,
  type ScreenEvents,
} from './Screen.js';

export {
  type Theme,
  type ThemeColors,
  defaultTheme,
  lowColorTheme,
  noneTheme,
  createTheme,
  createAutoTheme,
  getChalkForDepth,
} from './Theme.js';

export { Output, defaultOutput, createOutput, type OutputLevel } from './Output.js';

export { Spinner, createSpinner, withSpinner, type SpinnerOptions } from './Spinner.js';

export {
  Banner,
  defaultBanner,
  createBanner,
  type BannerConfig,
  type BannerStyle,
} from './Banner.js';

export { Box, defaultBox, createBox, type BoxConfig, type BoxStyle } from './Box.js';
