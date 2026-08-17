/**
 * Model type definitions for model configuration
 *
 * Defines model metadata, parameter constraints, and
 * parameter value types for runtime configuration.
 */

import type { ProviderId } from './provider.js';

/** Model capability */
export type ModelCapability =
  | 'chat'
  | 'completion'
  | 'embedding'
  | 'image'
  | 'audio'
  | 'vision'
  | 'code'
  | 'reasoning';

/** Model parameter type */
export type ParamType = 'number' | 'integer' | 'string' | 'boolean' | 'enum';

/** Model parameter constraint definition */
export interface ParamConstraint {
  /** Parameter type */
  type: ParamType;
  /** Minimum value (for number/integer) */
  min?: number;
  /** Maximum value (for number/integer) */
  max?: number;
  /** Enum values (for enum type) */
  values?: string[];
  /** Default value */
  default: unknown;
  /** Parameter description */
  description: string;
  /** Whether this parameter is required */
  required?: boolean;
}

/** Model definition */
export interface ModelDefinition {
  /** Unique model identifier */
  id: string;
  /** Model display name */
  name: string;
  /** Provider this model belongs to */
  provider: ProviderId;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Maximum context window size */
  maxTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Cost per 1K input tokens (USD) */
  costPer1KInput?: number;
  /** Cost per 1K output tokens (USD) */
  costPer1KOutput?: number;
  /** Whether this model is deprecated */
  deprecated?: boolean;
  /** Release date */
  releaseDate?: string;
  /** Parameter constraints */
  parameters: Record<string, ParamConstraint>;
  /** Model description */
  description: string;
}

/** Model instance configuration (user's configured model) */
export interface ModelConfig {
  /** Unique instance identifier */
  id: string;
  /** Reference to model definition */
  modelId: string;
  /** Custom display label */
  label: string;
  /** Provider this model uses */
  provider: ProviderId;
  /** Whether this model is enabled */
  enabled: boolean;
  /** Override parameter values */
  parameters: ModelParameters;
  /** Default preset to use */
  defaultPreset?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/** Runtime model parameters */
export interface ModelParameters {
  /** Temperature (0-2, default varies by model) */
  temperature?: number;
  /** Top-p nucleus sampling (0-1) */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Stop sequences */
  stop?: string[];
  /** Seed for reproducibility */
  seed?: number;
  /** Response format */
  responseFormat?: 'text' | 'json_object';
  /** System prompt override */
  systemPrompt?: string;
  /** Extra provider-specific parameters */
  extra?: Record<string, unknown>;
}

/** Built-in model definitions */
export const MODEL_DEFINITIONS: ModelDefinition[] = [
  // OpenAI models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: ['chat', 'vision', 'code', 'reasoning'],
    maxTokens: 128000,
    maxOutputTokens: 16384,
    costPer1KInput: 0.0025,
    costPer1KOutput: 0.01,
    releaseDate: '2024-05-13',
    description: 'Most capable GPT-4 model with vision',
    parameters: {
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        default: 1,
        description: 'Controls randomness in output',
      },
      topP: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Nucleus sampling parameter',
      },
      maxTokens: {
        type: 'integer',
        min: 1,
        max: 16384,
        default: 4096,
        description: 'Maximum tokens to generate',
      },
      presencePenalty: {
        type: 'number',
        min: -2,
        max: 2,
        default: 0,
        description: 'Penalize new tokens based on presence',
      },
      frequencyPenalty: {
        type: 'number',
        min: -2,
        max: 2,
        default: 0,
        description: 'Penalize new tokens based on frequency',
      },
      responseFormat: {
        type: 'enum',
        values: ['text', 'json_object'],
        default: 'text',
        description: 'Response format',
      },
    },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    capabilities: ['chat', 'vision', 'code'],
    maxTokens: 128000,
    maxOutputTokens: 16384,
    costPer1KInput: 0.00015,
    costPer1KOutput: 0.0006,
    releaseDate: '2024-07-18',
    description: 'Cost-efficient small model',
    parameters: {
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        default: 1,
        description: 'Controls randomness in output',
      },
      topP: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Nucleus sampling parameter',
      },
      maxTokens: {
        type: 'integer',
        min: 1,
        max: 16384,
        default: 4096,
        description: 'Maximum tokens to generate',
      },
      responseFormat: {
        type: 'enum',
        values: ['text', 'json_object'],
        default: 'text',
        description: 'Response format',
      },
    },
  },
  // Anthropic models
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    capabilities: ['chat', 'vision', 'code', 'reasoning'],
    maxTokens: 200000,
    maxOutputTokens: 8192,
    costPer1KInput: 0.003,
    costPer1KOutput: 0.015,
    releaseDate: '2025-05-14',
    description: 'Anthropic Claude Sonnet 4 model',
    parameters: {
      temperature: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Controls randomness in output',
      },
      topP: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Nucleus sampling parameter',
      },
      topK: {
        type: 'integer',
        min: 1,
        max: 100,
        default: 40,
        description: 'Top-k sampling',
      },
      maxTokens: {
        type: 'integer',
        min: 1,
        max: 8192,
        default: 4096,
        description: 'Maximum tokens to generate',
      },
    },
  },
  // Google models
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    capabilities: ['chat', 'vision', 'code', 'reasoning'],
    maxTokens: 1000000,
    maxOutputTokens: 65536,
    releaseDate: '2025-03-25',
    description: 'Google Gemini 2.5 Pro model',
    parameters: {
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        default: 1,
        description: 'Controls randomness in output',
      },
      topP: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.95,
        description: 'Nucleus sampling parameter',
      },
      topK: {
        type: 'integer',
        min: 1,
        max: 100,
        default: 40,
        description: 'Top-k sampling',
      },
      maxTokens: {
        type: 'integer',
        min: 1,
        max: 65536,
        default: 8192,
        description: 'Maximum tokens to generate',
      },
    },
  },
  // DeepSeek models
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    capabilities: ['chat', 'code', 'reasoning'],
    maxTokens: 128000,
    maxOutputTokens: 8192,
    costPer1KInput: 0.00014,
    costPer1KOutput: 0.00028,
    releaseDate: '2024-12-26',
    description: 'DeepSeek V3 chat model',
    parameters: {
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        default: 1,
        description: 'Controls randomness in output',
      },
      topP: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Nucleus sampling parameter',
      },
      maxTokens: {
        type: 'integer',
        min: 1,
        max: 8192,
        default: 4096,
        description: 'Maximum tokens to generate',
      },
      responseFormat: {
        type: 'enum',
        values: ['text', 'json_object'],
        default: 'text',
        description: 'Response format',
      },
    },
  },
];
