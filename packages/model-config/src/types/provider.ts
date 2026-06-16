/**
 * Provider type definitions for model configuration
 *
 * Supports major AI providers with structured metadata
 * for models, API keys, and endpoint configuration.
 */

/** Known provider identifiers */
export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'cohere'
  | 'mistral'
  | 'deepseek'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

/** Provider category */
export type ProviderCategory = 'cloud' | 'azure' | 'local' | 'custom';

/** Authentication type for providers */
export type AuthType = 'api_key' | 'azure_ad' | 'oauth' | 'none';

/** Provider definition */
export interface ProviderDefinition {
  /** Unique provider identifier */
  id: ProviderId;
  /** Display name */
  name: string;
  /** Provider category */
  category: ProviderCategory;
  /** Authentication type */
  authType: AuthType;
  /** Default base URL for API */
  baseUrl: string;
  /** Documentation URL */
  docsUrl?: string;
  /** Supported features */
  features: ProviderFeatures;
  /** Default request headers */
  defaultHeaders?: Record<string, string>;
  /** Environment variable name for API key */
  envVarName?: string;
}

/** Provider features */
export interface ProviderFeatures {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports function calling */
  functionCalling: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Supports JSON mode */
  jsonMode: boolean;
  /** Supports system prompts */
  systemPrompt: boolean;
  /** Maximum context window (tokens) */
  maxContextWindow?: number;
}

/** Provider instance configuration (user's configured provider) */
export interface ProviderConfig {
  /** Reference to provider definition */
  provider: ProviderId;
  /** Custom display label */
  label: string;
  /** Override base URL */
  baseUrlOverride?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** API keys associated with this provider */
  keys: ApiKeyConfig[];
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Provider-specific options */
  options?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/** API key configuration */
export interface ApiKeyConfig {
  /** Unique key identifier */
  id: string;
  /** Key label for identification */
  label: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Rate limit for this specific key */
  rateLimit?: RateLimitConfig;
  /** Whether this key is active */
  enabled: boolean;
  /** Key expiration timestamp (0 = no expiration) */
  expiresAt?: number;
  /** Last used timestamp */
  lastUsedAt?: number;
  /** Usage count */
  usageCount: number;
  /** The actual key value reference (never stored in plain text) */
  keyRef: string;
}

/** Rate limit configuration */
export interface RateLimitConfig {
  /** Requests per minute */
  rpm?: number;
  /** Requests per day */
  rpd?: number;
  /** Tokens per minute */
  tpm?: number;
  /** Tokens per day */
  tpd?: number;
  /** Concurrent request limit */
  concurrency?: number;
}

/** Built-in provider definitions */
export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs',
    envVarName: 'OPENAI_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
    defaultHeaders: { 'OpenAI-Organization': '' },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://docs.anthropic.com',
    envVarName: 'ANTHROPIC_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: false,
      systemPrompt: true,
      maxContextWindow: 200000,
    },
    defaultHeaders: { 'anthropic-version': '2023-06-01' },
  },
  google: {
    id: 'google',
    name: 'Google AI',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    docsUrl: 'https://ai.google.dev/docs',
    envVarName: 'GOOGLE_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 1000000,
    },
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    category: 'azure',
    authType: 'azure_ad',
    baseUrl: 'https://{resource}.openai.azure.com',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai',
    envVarName: 'AZURE_OPENAI_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
    defaultHeaders: { 'api-key': '' },
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://api.cohere.ai/v1',
    docsUrl: 'https://docs.cohere.com',
    envVarName: 'COHERE_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: false,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://docs.mistral.ai',
    envVarName: 'MISTRAL_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    category: 'cloud',
    authType: 'api_key',
    baseUrl: 'https://api.deepseek.com/v1',
    docsUrl: 'https://platform.deepseek.com/docs',
    envVarName: 'DEEPSEEK_API_KEY',
    features: {
      streaming: true,
      functionCalling: true,
      vision: false,
      jsonMode: true,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    category: 'local',
    authType: 'none',
    baseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com/docs',
    features: {
      streaming: true,
      functionCalling: false,
      vision: false,
      jsonMode: false,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'local',
    authType: 'none',
    baseUrl: 'http://localhost:1234/v1',
    docsUrl: 'https://lmstudio.ai/docs',
    features: {
      streaming: true,
      functionCalling: false,
      vision: false,
      jsonMode: false,
      systemPrompt: true,
      maxContextWindow: 128000,
    },
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    category: 'custom',
    authType: 'api_key',
    baseUrl: '',
    features: {
      streaming: false,
      functionCalling: false,
      vision: false,
      jsonMode: false,
      systemPrompt: true,
    },
  },
};
