/**
 * ExecutionPreview - Preview orchestration plans before execution
 *
 * Provides analysis of execution plans including duration estimation,
 * critical path identification, risk detection, and formatted output
 * in tree and timeline views.
 */

import { createLogger, type Logger } from '@organic/utils';
import type { OrchestrationLayerPlan } from './OrchestrationLayer.js';
import type { ExecutionStep } from './ExecutionCoordinator.js';

/**
 * Preview item representing a single unit in the execution plan
 */
export interface PreviewItem {
  /** Unique identifier */
  id: string;
  /** Item type */
  type: 'task' | 'agent' | 'step' | 'checkpoint';
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Estimated duration in milliseconds */
  estimatedDuration: number;
  /** IDs of dependencies that must complete first */
  dependencies: string[];
  /** Risk level */
  risk: 'low' | 'medium' | 'high';
  /** Whether this item can run in parallel with siblings */
  parallelizable: boolean;
}

/**
 * Preview result containing full analysis of execution plan
 */
export interface PreviewResult {
  /** All preview items */
  items: PreviewItem[];
  /** Total estimated duration in milliseconds */
  totalEstimatedDuration: number;
  /** IDs in critical path order */
  criticalPath: string[];
  /** Groups of IDs that can run in parallel */
  parallelGroups: string[][];
  /** Risk breakdown counts */
  risks: {
    high: number;
    medium: number;
    low: number;
  };
  /** Execution warnings */
  warnings: string[];
}

/**
 * ExecutionPreview - Analyzes and previews execution plans
 *
 * Provides duration estimation, critical path analysis, risk
 * detection, and multiple formatted output views.
 */
export class ExecutionPreview {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'execution-preview' });
  }

  /**
   * Generate a preview of an execution plan
   */
  preview(plan: OrchestrationLayerPlan): PreviewResult {
    const items = this.extractItems(plan);
    const totalEstimatedDuration = this.estimateDuration(plan);
    const criticalPath = this.findCriticalPath(plan);
    const parallelGroups = this.findParallelGroups(plan);
    const risks = this.detectRisks(plan);
    const warnings = this.generateWarnings(plan);

    return {
      items,
      totalEstimatedDuration,
      criticalPath,
      parallelGroups,
      risks: {
        high: risks.high.length,
        medium: risks.medium.length,
        low: risks.low.length,
      },
      warnings,
    };
  }

  /**
   * Estimate total duration of the execution plan
   */
  estimateDuration(plan: OrchestrationLayerPlan): number {
    const steps = plan.executionPlan.steps;
    if (steps.length === 0) return 0;

    // Build dependency graph
    const durations = new Map<string, number>();
    const visited = new Set<string>();

    const computeDuration = (stepId: string): number => {
      if (visited.has(stepId)) {
        return durations.get(stepId) ?? 0;
      }
      visited.add(stepId);

      const step = steps.find(s => s.stepId === stepId);
      if (!step) return 0;

      const baseDuration = this.estimateStepDuration(step);
      const depDurations = step.dependsOn.map(depId => computeDuration(depId));
      const maxDepDuration = depDurations.length > 0 ? Math.max(...depDurations) : 0;
      const total = baseDuration + maxDepDuration;

      durations.set(stepId, total);
      return total;
    };

    // Compute for all steps
    let maxDuration = 0;
    for (const step of steps) {
      const duration = computeDuration(step.stepId);
      maxDuration = Math.max(maxDuration, duration);
    }

    return maxDuration;
  }

  /**
   * Find the critical path in the execution plan
   * Returns step IDs in order of the longest dependency chain
   */
  findCriticalPath(plan: OrchestrationLayerPlan): string[] {
    const steps = plan.executionPlan.steps;
    if (steps.length === 0) return [];

    const durations = new Map<string, number>();
    const nextSteps = new Map<string, string>();
    const visited = new Set<string>();

    const computePath = (stepId: string): number => {
      if (visited.has(stepId)) {
        return durations.get(stepId) ?? 0;
      }
      visited.add(stepId);

      const step = steps.find(s => s.stepId === stepId);
      if (!step) return 0;

      const baseDuration = this.estimateStepDuration(step);
      let maxDepDuration = 0;
      let bestNext = '';

      for (const depId of step.dependsOn) {
        const depDuration = computePath(depId);
        if (depDuration > maxDepDuration) {
          maxDepDuration = depDuration;
          bestNext = depId;
        }
      }

      const total = baseDuration + maxDepDuration;
      durations.set(stepId, total);
      if (bestNext) {
        nextSteps.set(stepId, bestNext);
      }

      return total;
    };

    // Find the step with the longest path
    let maxDuration = 0;
    let startStep = '';
    for (const step of steps) {
      const duration = computePath(step.stepId);
      if (duration > maxDuration) {
        maxDuration = duration;
        startStep = step.stepId;
      }
    }

    // Walk down the critical path
    const path: string[] = [];
    const pathVisited = new Set<string>();
    let current = startStep;

    while (current && !pathVisited.has(current)) {
      path.push(current);
      pathVisited.add(current);
      current = nextSteps.get(current) ?? '';
    }

    return path;
  }

  /**
   * Detect risk levels for each step in the plan
   */
  detectRisks(plan: OrchestrationLayerPlan): {
    high: PreviewItem[];
    medium: PreviewItem[];
    low: PreviewItem[];
  } {
    const high: PreviewItem[] = [];
    const medium: PreviewItem[] = [];
    const low: PreviewItem[] = [];

    for (const step of plan.executionPlan.steps) {
      const item = this.stepToPreviewItem(step);
      const risk = this.assessRisk(step, plan);

      item.risk = risk;

      switch (risk) {
        case 'high':
          high.push(item);
          break;
        case 'medium':
          medium.push(item);
          break;
        case 'low':
          low.push(item);
          break;
      }
    }

    return { high, medium, low };
  }

  /**
   * Generate execution warnings
   */
  generateWarnings(plan: OrchestrationLayerPlan): string[] {
    const warnings: string[] = [];
    const steps = plan.executionPlan.steps;

    // Check for circular dependencies
    if (this.hasCircularDependencies(steps)) {
      warnings.push('Circular dependency detected in execution plan');
    }

    // Check for steps with no dependencies and no parallel groups
    const sequentialSteps = steps.filter(s => s.dependsOn.length === 0);
    if (sequentialSteps.length > 3) {
      warnings.push(
        `${sequentialSteps.length} independent steps found - consider parallel execution`
      );
    }

    // Check for steps with many dependencies
    const highDependencySteps = steps.filter(s => s.dependsOn.length > 5);
    if (highDependencySteps.length > 0) {
      warnings.push(
        `${highDependencySteps.length} steps have 5+ dependencies - may cause bottlenecks`
      );
    }

    // Check for high-risk steps
    const highRiskSteps = steps.filter(s => this.assessRisk(s, plan) === 'high');
    if (highRiskSteps.length > 0) {
      warnings.push(
        `${highRiskSteps.length} steps identified as high risk - review before execution`
      );
    }

    // Check for empty plan
    if (steps.length === 0) {
      warnings.push('Execution plan has no steps');
    }

    return warnings;
  }

  /**
   * Format the preview result for display
   */
  formatPreview(preview: PreviewResult): string {
    const lines: string[] = [];

    lines.push('╔═══════════════════════════════════════╗');
    lines.push('║     Execution Plan Preview           ║');
    lines.push('╚═══════════════════════════════════════╝');
    lines.push('');

    // Summary
    lines.push(`Total Items: ${preview.items.length}`);
    lines.push(`Estimated Duration: ${this.formatDuration(preview.totalEstimatedDuration)}`);
    lines.push(`Critical Path: ${preview.criticalPath.length} steps`);
    lines.push(
      `Risk Profile: ${preview.risks.high} high, ${preview.risks.medium} medium, ${preview.risks.low} low`
    );
    lines.push('');

    // Items
    lines.push('--- Items ---');
    for (const item of preview.items) {
      const riskIcon = item.risk === 'high' ? '🔴' : item.risk === 'medium' ? '🟡' : '🟢';
      const parallelIcon = item.parallelizable ? '⚡' : '→';
      lines.push(
        `  ${riskIcon} ${parallelIcon} [${item.type}] ${item.name} (${this.formatDuration(item.estimatedDuration)})`
      );
      if (item.description) {
        lines.push(`    ${item.description}`);
      }
      if (item.dependencies.length > 0) {
        lines.push(`    Depends on: ${item.dependencies.join(', ')}`);
      }
    }
    lines.push('');

    // Warnings
    if (preview.warnings.length > 0) {
      lines.push('--- Warnings ---');
      for (const warning of preview.warnings) {
        lines.push(`  ⚠  ${warning}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format the preview as a tree structure
   */
  formatTree(preview: PreviewResult): string {
    const lines: string[] = [];
    lines.push('Execution Plan Tree');
    lines.push('');

    // Build a dependency-based tree
    const rootItems = preview.items.filter(item => item.dependencies.length === 0);
    const childMap = new Map<string, PreviewItem[]>();

    for (const item of preview.items) {
      for (const depId of item.dependencies) {
        const children = childMap.get(depId) ?? [];
        children.push(item);
        childMap.set(depId, children);
      }
    }

    const renderNode = (item: PreviewItem, prefix: string, isLast: boolean): void => {
      const connector = isLast ? '└── ' : '├── ';
      const riskIcon = item.risk === 'high' ? '[HIGH]' : item.risk === 'medium' ? '[MED]' : '[LOW]';
      lines.push(
        `${prefix}${connector}${riskIcon} ${item.name} (${this.formatDuration(item.estimatedDuration)})`
      );

      const children = childMap.get(item.id) ?? [];
      const newPrefix = prefix + (isLast ? '    ' : '│   ');

      for (let i = 0; i < children.length; i++) {
        renderNode(children[i], newPrefix, i === children.length - 1);
      }
    };

    for (let i = 0; i < rootItems.length; i++) {
      renderNode(rootItems[i], '', i === rootItems.length - 1);
    }

    return lines.join('\n');
  }

  /**
   * Format the preview as a timeline
   */
  formatTimeline(preview: PreviewResult): string {
    const lines: string[] = [];
    lines.push('Execution Timeline');
    lines.push('');

    const totalDuration = preview.totalEstimatedDuration;
    const maxBarWidth = 40;

    for (const item of preview.items) {
      const barWidth =
        totalDuration > 0
          ? Math.max(1, Math.round((item.estimatedDuration / totalDuration) * maxBarWidth))
          : 1;
      const bar = '█'.repeat(barWidth);
      const riskIcon = item.risk === 'high' ? 'H' : item.risk === 'medium' ? 'M' : 'L';

      lines.push(
        `[${riskIcon}] ${item.name.padEnd(20)} ${bar} ${this.formatDuration(item.estimatedDuration)}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Extract preview items from a plan
   */
  private extractItems(plan: OrchestrationLayerPlan): PreviewItem[] {
    return plan.executionPlan.steps.map(step => this.stepToPreviewItem(step));
  }

  /**
   * Convert an execution step to a preview item
   */
  private stepToPreviewItem(step: ExecutionStep): PreviewItem {
    return {
      id: step.stepId,
      type: 'step',
      name: step.request.taskName,
      description: `Task: ${step.request.taskName}${step.request.requiredCapability ? ` (requires: ${step.request.requiredCapability})` : ''}`,
      estimatedDuration: this.estimateStepDuration(step),
      dependencies: step.dependsOn,
      risk: 'low',
      parallelizable: step.dependsOn.length === 0,
    };
  }

  /**
   * Estimate duration for a single step
   */
  private estimateStepDuration(step: ExecutionStep): number {
    // Base duration: 1000ms per step
    let duration = 1000;

    // Adjust based on payload complexity
    const payload = step.request.payload;
    if (payload && typeof payload === 'object') {
      const payloadStr = JSON.stringify(payload);
      const sizeFactor = Math.min(payloadStr.length / 100, 5);
      duration += sizeFactor * 100;
    }

    // Adjust based on dependencies
    duration += step.dependsOn.length * 200;

    // Adjust based on required capability
    if (step.request.requiredCapability) {
      duration += 500;
    }

    return duration;
  }

  /**
   * Assess risk level for a step
   */
  private assessRisk(step: ExecutionStep, plan: OrchestrationLayerPlan): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Many dependencies increase risk
    if (step.dependsOn.length > 3) riskScore += 2;
    else if (step.dependsOn.length > 1) riskScore += 1;

    // Required capability increases risk
    if (step.request.requiredCapability) riskScore += 1;

    // Complex payload increases risk
    const payload = step.request.payload;
    if (payload && typeof payload === 'object') {
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > 1000) riskScore += 2;
      else if (payloadStr.length > 500) riskScore += 1;
    }

    // Being a dependency for many others increases risk
    const dependents = plan.executionPlan.steps.filter(s => s.dependsOn.includes(step.stepId));
    if (dependents.length > 3) riskScore += 2;
    else if (dependents.length > 1) riskScore += 1;

    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Find parallel groups from the execution plan
   */
  private findParallelGroups(plan: OrchestrationLayerPlan): string[][] {
    const groups: string[][] = [];
    const assigned = new Set<string>();
    const steps = plan.executionPlan.steps;

    for (const step of steps) {
      if (assigned.has(step.stepId)) continue;

      // Find steps with same dependencies
      const group = steps.filter(s => {
        if (assigned.has(s.stepId)) return false;
        if (s.stepId === step.stepId) return true;
        return (
          s.dependsOn.length === step.dependsOn.length &&
          s.dependsOn.every(d => step.dependsOn.includes(d))
        );
      });

      if (group.length > 1) {
        groups.push(group.map(s => s.stepId));
        group.forEach(s => assigned.add(s.stepId));
      } else {
        groups.push([step.stepId]);
        assigned.add(step.stepId);
      }
    }

    return groups;
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(steps: ExecutionStep[]): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recStack.add(stepId);

      const step = steps.find(s => s.stepId === stepId);
      if (step) {
        for (const depId of step.dependsOn) {
          if (hasCycle(depId)) return true;
        }
      }

      recStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.stepId)) return true;
    }

    return false;
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
