/**
 * Service exports for Organic Interface Kernel
 *
 * Re-exports all kernel services for convenient access.
 */

// Text interaction services
export {
  TextService,
  type TextServiceConfig,
  type TextStream,
  type SpinnerController,
  type SpinnerFrames,
  type TextStyle,
  type TextColor,
  type TableData,
  type TableOptions,
  type ListOptions,
  type PrintOptions,
  type StreamOptions,
} from './TextService.js';

export {
  InfoService,
  type InfoServiceConfig,
  type ProjectContext,
  type SystemInfo,
  type PlatformInfo,
  type RuntimeInfo,
  type ConfigValue,
} from './InfoService.js';
