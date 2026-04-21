/**
 * EventBus - Internal event bus for kernel and plugin communication
 */

import type { Logger } from '@organic/utils';

/**
 * Event listener callback
 */
export type EventListener<T = unknown> = (event: KernelEvent<T>) => void;

/**
 * Kernel event structure
 */
export interface KernelEvent<T = unknown> {
  /** Event type/name */
  type: string;
  /** Event payload data */
  data: T;
  /** Timestamp when event was emitted */
  timestamp: number;
  /** Source of the event */
  source?: string;
}

/**
 * Event subscription handle for cleanup
 */
export interface EventSubscription {
  /** Unsubscribe function to remove the listener */
  unsubscribe(): void;
}

/**
 * EventBus configuration
 */
export interface EventBusConfig {
  /** Logger instance */
  logger?: Logger;
  /** Enable async event dispatch */
  async?: boolean;
  /** Event capture limit per listener */
  captureLimit?: number;
}

/**
 * EventBus for kernel internal events
 */
export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private logger: Logger;
  private async: boolean;
  private captureLimit: number;

  constructor(config: EventBusConfig = {}) {
    this.logger = config.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.async = config.async ?? true;
    this.captureLimit = config.captureLimit ?? 100;
  }

  /**
   * Subscribe to an event
   */
  on<T = unknown>(type: string, listener: EventListener<T>): EventSubscription {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const listeners = this.listeners.get(type)!;
    listeners.add(listener as EventListener);

    this.logger.debug(`Listener subscribed to event: ${type}`);

    return {
      unsubscribe: () => this.off(type, listener),
    };
  }

  /**
   * Subscribe to an event once
   */
  once<T = unknown>(type: string, listener: EventListener<T>): EventSubscription {
    const wrappedListener: EventListener<T> = (event) => {
      listener(event);
      this.off(type, wrappedListener);
    };

    return this.on(type, wrappedListener);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(type: string, listener: EventListener<T>): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener as EventListener);
      this.logger.debug(`Listener unsubscribed from event: ${type}`);

      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T = unknown>(type: string, data: T, source?: string): void {
    const event: KernelEvent<T> = {
      type,
      data,
      timestamp: Date.now(),
      source,
    };

    this.logger.debug(`Emitting event: ${type}`);

    const listeners = this.listeners.get(type);
    if (!listeners || listeners.size === 0) {
      return;
    }

    if (this.async) {
      // Async dispatch for non-blocking behavior
      setImmediate(() => {
        for (const listener of listeners) {
          try {
            listener(event);
          } catch (error) {
            this.logger.error(`Error in event listener for ${type}:`, error);
          }
        }
      });
    } else {
      // Sync dispatch
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          this.logger.error(`Error in event listener for ${type}:`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(type?: string): void {
    if (type) {
      this.listeners.delete(type);
      this.logger.debug(`All listeners removed for event: ${type}`);
    } else {
      this.listeners.clear();
      this.logger.debug('All event listeners removed');
    }
  }

  /**
   * Get the count of listeners for a specific event type
   */
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Default event types for kernel
 */
export const KernelEvents = {
  KERNEL_INIT: 'kernel:init',
  KERNEL_START: 'kernel:start',
  KERNEL_STOP: 'kernel:stop',
  PLUGIN_REGISTER: 'plugin:register',
  PLUGIN_UNREGISTER: 'plugin:unregister',
  PLUGIN_ERROR: 'plugin:error',
  CONFIG_UPDATE: 'config:update',
} as const;
