/**
 * @organic/ui - Terminal module
 *
 * Provides styled terminal output components using chalk and ora.
 */

export { type Theme, type ThemeColors, defaultTheme, createTheme } from './Theme.js';

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
