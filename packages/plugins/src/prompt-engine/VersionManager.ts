/**
 * VersionManager - Manages version history for prompt templates
 *
 * Uses semantic versioning (auto-increment patch).
 * Provides version creation, retrieval, diff, and rollback.
 */

import { createLogger, type Logger } from '@organic/utils';
import type { TemplateVersion } from './types/template.js';

/**
 * VersionManager class
 */
export class VersionManager {
  private logger: Logger;
  /** Template version storage: templateId -> versions[] */
  private versions: Map<string, TemplateVersion[]>;

  constructor() {
    this.logger = createLogger({ prefix: 'VersionManager' });
    this.versions = new Map();
  }

  // ==================== Public API ====================

  /**
   * Create a new version for a template
   * @param templateId - Template identifier
   * @param content - Template content for this version
   * @param message - Version message / changelog
   * @param author - Optional author name
   * @returns The created TemplateVersion
   */
  createVersion(
    templateId: string,
    content: string,
    message: string,
    author?: string
  ): TemplateVersion {
    const history = this.getOrCreateHistory(templateId);
    const nextVersion = this.incrementVersion(history);

    const version: TemplateVersion = {
      version: nextVersion,
      content,
      createdAt: Date.now(),
      message,
      author,
    };

    history.push(version);
    this.logger.info(`Version ${nextVersion} created for template "${templateId}"`);

    return version;
  }

  /**
   * Get a specific version of a template
   * @param templateId - Template identifier
   * @param version - Version string
   * @returns The TemplateVersion or null if not found
   */
  getVersion(templateId: string, version: string): TemplateVersion | null {
    const history = this.versions.get(templateId);
    if (!history) return null;

    return history.find(v => v.version === version) || null;
  }

  /**
   * Get full version history for a template
   * @param templateId - Template identifier
   * @returns Array of versions, newest first
   */
  getHistory(templateId: string): TemplateVersion[] {
    const history = this.versions.get(templateId);
    if (!history) return [];

    return [...history].reverse();
  }

  /**
   * Compare two versions and return a diff-like string
   * @param templateId - Template identifier
   * @param v1 - First version string
   * @param v2 - Second version string
   * @returns Diff string showing additions and removals
   */
  diff(templateId: string, v1: string, v2: string): string {
    const version1 = this.getVersion(templateId, v1);
    const version2 = this.getVersion(templateId, v2);

    if (!version1) {
      return `Error: Version ${v1} not found for template "${templateId}"`;
    }
    if (!version2) {
      return `Error: Version ${v2} not found for template "${templateId}"`;
    }

    const lines1 = version1.content.split('\n');
    const lines2 = version2.content.split('\n');
    const diffLines: string[] = [];

    diffLines.push(`--- ${templateId}@${v1}`);
    diffLines.push(`+++ ${templateId}@${v2}`);
    diffLines.push('');

    // Simple line-based diff
    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
      const l1 = lines1[i] || '';
      const l2 = lines2[i] || '';

      if (l1 === l2) {
        diffLines.push(`  ${l1}`);
      } else {
        if (l1) {
          diffLines.push(`- ${l1}`);
        }
        if (l2) {
          diffLines.push(`+ ${l2}`);
        }
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Rollback to a specific version
   * @param templateId - Template identifier
   * @param targetVersion - Version to rollback to
   * @returns The TemplateVersion being rolled back to
   */
  rollback(templateId: string, targetVersion: string): TemplateVersion {
    const target = this.getVersion(templateId, targetVersion);
    if (!target) {
      throw new Error(`Version ${targetVersion} not found for template "${templateId}"`);
    }

    // Create a new version with the rolled-back content
    const rollbackVersion = this.createVersion(
      templateId,
      target.content,
      `Rollback to version ${targetVersion}`,
      'system'
    );

    this.logger.info(`Template "${templateId}" rolled back to version ${targetVersion}`);

    return rollbackVersion;
  }

  /**
   * Get the current (latest) version string for a template
   * @param templateId - Template identifier
   * @returns Current version string or '0.0.0' if no versions exist
   */
  getCurrentVersion(templateId: string): string {
    const history = this.versions.get(templateId);
    if (!history || history.length === 0) return '0.0.0';

    return history[history.length - 1].version;
  }

  /**
   * Remove all versions for a template
   * @param templateId - Template identifier
   */
  removeTemplate(templateId: string): void {
    this.versions.delete(templateId);
    this.logger.debug(`Version history removed for template "${templateId}"`);
  }

  // ==================== Private Methods ====================

  /**
   * Get or create version history array for a template
   */
  private getOrCreateHistory(templateId: string): TemplateVersion[] {
    if (!this.versions.has(templateId)) {
      this.versions.set(templateId, []);
    }
    return this.versions.get(templateId)!;
  }

  /**
   * Increment the patch version based on existing history
   */
  private incrementVersion(history: TemplateVersion[]): string {
    if (history.length === 0) {
      return '1.0.0';
    }

    const lastVersion = history[history.length - 1].version;
    const parts = lastVersion.split('.').map(Number);

    if (parts.length === 3) {
      parts[2] = (parts[2] || 0) + 1;
      return parts.join('.');
    }

    return '1.0.0';
  }
}
