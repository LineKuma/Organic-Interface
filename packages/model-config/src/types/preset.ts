/**
 * Preset type definitions for model configuration
 *
 * Presets define reusable parameter templates for
 * common use cases like creative writing, precise
 * analysis, code generation, etc.
 */

import type { ModelParameters } from './model.js';

/** Preset category */
export type PresetCategory = 'creative' | 'precise' | 'balanced' | 'code' | 'chat' | 'custom';

/** Preset definition */
export interface PresetDefinition {
  /** Unique preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Preset category */
  category: PresetCategory;
  /** Preset description */
  description: string;
  /** Default parameter values */
  parameters: ModelParameters;
  /** Whether this preset requires specific model capabilities */
  requiredCapabilities?: string[];
  /** Whether this is a built-in preset */
  builtIn?: boolean;
  /** Creation timestamp */
  createdAt?: number;
  /** Updated timestamp */
  updatedAt?: number;
}

/** Built-in presets */
export const BUILTIN_PRESETS: PresetDefinition[] = [
  {
    id: 'creative',
    name: 'Creative',
    category: 'creative',
    description: 'High creativity for brainstorming, storytelling, and content generation',
    parameters: {
      temperature: 0.9,
      topP: 0.95,
      presencePenalty: 0.3,
      frequencyPenalty: 0.3,
    },
    builtIn: true,
  },
  {
    id: 'precise',
    name: 'Precise',
    category: 'precise',
    description: 'Low temperature for factual, deterministic responses',
    parameters: {
      temperature: 0.1,
      topP: 0.1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      responseFormat: 'json_object',
    },
    builtIn: true,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    category: 'balanced',
    description: 'Balanced settings for general-purpose use',
    parameters: {
      temperature: 0.7,
      topP: 0.9,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    builtIn: true,
  },
  {
    id: 'code',
    name: 'Code Generation',
    category: 'code',
    description: 'Optimized for code generation with low temperature',
    parameters: {
      temperature: 0.2,
      topP: 0.5,
      presencePenalty: 0,
      frequencyPenalty: 0,
      seed: 42,
    },
    builtIn: true,
  },
  {
    id: 'chat',
    name: 'Casual Chat',
    category: 'chat',
    description: 'Friendly conversational style with moderate creativity',
    parameters: {
      temperature: 0.8,
      topP: 0.9,
      presencePenalty: 0.5,
      frequencyPenalty: 0.2,
    },
    builtIn: true,
  },
  {
    id: 'reasoning',
    name: 'Deep Reasoning',
    category: 'precise',
    description: 'Maximum tokens for complex reasoning tasks',
    parameters: {
      temperature: 0.3,
      topP: 0.8,
      maxTokens: 8192,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    builtIn: true,
    requiredCapabilities: ['reasoning'],
  },
  {
    id: 'vision',
    name: 'Vision Analysis',
    category: 'precise',
    description: 'Optimized for image analysis with low temperature',
    parameters: {
      temperature: 0.1,
      topP: 0.5,
      maxTokens: 4096,
    },
    builtIn: true,
    requiredCapabilities: ['vision'],
  },
];
