/**
 * Result types for Organic Interface
 */

/**
 * Standard result wrapper for operations
 */
export interface Result<T = unknown> {
  /** Whether the operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Result metadata for additional information
 */
export interface ResultMetadata {
  /** Operation timestamp */
  timestamp: number;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Paginated result for list operations
 */
export interface PaginatedResult<T = unknown> {
  /** Items in the current page */
  items: T[];
  /** Current page number (0-indexed) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Create a success result
 */
export function successResult<T = unknown>(data: T, metadata?: ResultMetadata): Result<T> {
  return {
    success: true,
    data,
    ...(metadata && { metadata }),
  };
}

/**
 * Create an error result
 */
export function errorResult(error: string, code?: string): Result<never> {
  return {
    success: false,
    error,
    ...(code && { code }),
  };
}
