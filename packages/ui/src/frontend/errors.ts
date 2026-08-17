/**
 * @organic/ui - frontend contract errors
 */

import { BaseError } from '@organic/utils';

/**
 * Error thrown when a standard frontend interface method is not implemented by a
 * concrete frontend and therefore falls back to the base stub.
 *
 * This is the "acceptable stub" contract: a TUI or WebUI that does not implement a
 * method leaves the base stub in place, and the stub fails loudly (rather than
 * silently doing nothing) with this error whenever the feature is actually triggered.
 */
export class NotImplementedError extends BaseError {
  /** Fully-qualified method key, e.g. `workflow.createWorkflow` */
  public readonly method: string;
  /** Optional hint describing why this frontend intentionally stubs the feature */
  public readonly hint?: string;

  constructor(method: string, hint?: string) {
    const suffix = hint
      ? `Reason: ${hint}`
      : 'Provide a real implementation or an explicit stub declaration.';
    super(
      `Frontend feature '${method}' is not implemented by this frontend and relies on a stub. ${suffix}`,
      'NOT_IMPLEMENTED',
      { method, hint }
    );
    this.method = method;
    this.hint = hint;
  }
}
