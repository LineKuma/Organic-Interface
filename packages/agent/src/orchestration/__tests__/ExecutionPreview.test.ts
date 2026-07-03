import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionPreview } from '../ExecutionPreview.js';
import type { OrchestrationLayerPlan } from '../OrchestrationLayer.js';
import { OrchestrationPlanStatus, OrchestrationStrategy } from '../OrchestrationLayer.js';
import {
  type ExecutionPlan,
  type ExecutionStep,
  type ExecutionRequest,
} from '../ExecutionCoordinator.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Helper to create an execution step
function createStep(
  stepId: string,
  taskName: string,
  dependsOn: string[] = [],
  requiredCapability?: string,
  payload?: Record<string, unknown>
): ExecutionStep {
  const request: ExecutionRequest = {
    requestId: `req_${stepId}`,
    taskName,
    payload: payload ?? { description: `Task ${stepId}` },
    requiredCapability,
  };
  return {
    stepId,
    request,
    dependsOn,
    status: 'pending',
  };
}

// Helper to create an execution plan
function createPlan(steps: ExecutionStep[]): ExecutionPlan {
  return {
    requestId: 'plan_1',
    steps,
    parallelGroups: [],
  };
}

// Helper to create an orchestration plan
function createOrchPlan(
  planId: string,
  steps: ExecutionStep[],
  strategy: OrchestrationStrategy = OrchestrationStrategy.AUTO
): OrchestrationLayerPlan {
  return {
    planId,
    request: {
      requestId: `req_${planId}`,
      taskName: `Plan ${planId}`,
      payload: {},
      strategy,
    },
    executionPlan: createPlan(steps),
    createdAt: Date.now(),
    status: OrchestrationPlanStatus.PENDING,
  };
}

describe('ExecutionPreview', () => {
  let preview: ExecutionPreview;

  beforeEach(() => {
    preview = new ExecutionPreview();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(preview).toBeDefined();
    });
  });

  describe('preview', () => {
    it('should generate preview for a plan', () => {
      const steps = [createStep('step_0', 'Task A'), createStep('step_1', 'Task B', ['step_0'])];
      const plan = createOrchPlan('plan_1', steps);

      const result = preview.preview(plan);
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalEstimatedDuration).toBeGreaterThan(0);
      expect(result.criticalPath.length).toBeGreaterThan(0);
    });

    it('should handle empty plan', () => {
      const plan = createOrchPlan('plan_1', []);

      const result = preview.preview(plan);
      expect(result.items).toHaveLength(0);
      expect(result.totalEstimatedDuration).toBe(0);
      expect(result.criticalPath).toEqual([]);
      expect(result.warnings).toContain('Execution plan has no steps');
    });

    it('should include risk breakdown', () => {
      const steps = [createStep('step_0', 'Task A'), createStep('step_1', 'Task B', ['step_0'])];
      const plan = createOrchPlan('plan_1', steps);

      const result = preview.preview(plan);
      expect(result.risks).toBeDefined();
      expect(result.risks.high + result.risks.medium + result.risks.low).toBe(result.items.length);
    });
  });

  describe('estimateDuration', () => {
    it('should estimate duration for single step', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps);

      const duration = preview.estimateDuration(plan);
      expect(duration).toBeGreaterThan(0);
    });

    it('should estimate duration for sequential steps', () => {
      const steps = [
        createStep('step_0', 'Task A'),
        createStep('step_1', 'Task B', ['step_0']),
        createStep('step_2', 'Task C', ['step_1']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const duration = preview.estimateDuration(plan);
      expect(duration).toBeGreaterThan(0);
      // Sequential steps should have longer duration than single step
      const singleSteps = [createStep('step_0', 'Task A')];
      const singlePlan = createOrchPlan('plan_single', singleSteps);
      const singleDuration = preview.estimateDuration(singlePlan);
      expect(duration).toBeGreaterThan(singleDuration);
    });

    it('should estimate duration for parallel steps', () => {
      const steps = [
        createStep('step_0', 'Task A'),
        createStep('step_1', 'Task B'),
        createStep('step_2', 'Task C', ['step_0', 'step_1']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const duration = preview.estimateDuration(plan);
      expect(duration).toBeGreaterThan(0);
    });

    it('should return 0 for empty plan', () => {
      const plan = createOrchPlan('plan_1', []);
      expect(preview.estimateDuration(plan)).toBe(0);
    });

    it('should account for required capability', () => {
      const stepsWithoutCap = [createStep('step_0', 'Task A')];
      const stepsWithCap = [createStep('step_0', 'Task A', [], 'special_capability')];

      const planWithout = createOrchPlan('plan_1', stepsWithoutCap);
      const planWith = createOrchPlan('plan_2', stepsWithCap);

      const durationWithout = preview.estimateDuration(planWithout);
      const durationWith = preview.estimateDuration(planWith);

      expect(durationWith).toBeGreaterThan(durationWithout);
    });

    it('should account for payload complexity', () => {
      const simplePayload = createStep('step_0', 'Task A', [], undefined, { small: 'data' });
      const complexPayload = createStep('step_0', 'Task A', [], undefined, {
        large: 'x'.repeat(2000),
      });

      const planSimple = createOrchPlan('plan_1', [simplePayload]);
      const planComplex = createOrchPlan('plan_2', [complexPayload]);

      const durationSimple = preview.estimateDuration(planSimple);
      const durationComplex = preview.estimateDuration(planComplex);

      expect(durationComplex).toBeGreaterThan(durationSimple);
    });
  });

  describe('findCriticalPath', () => {
    it('should find critical path for linear chain', () => {
      const steps = [
        createStep('step_0', 'Task A'),
        createStep('step_1', 'Task B', ['step_0']),
        createStep('step_2', 'Task C', ['step_1']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const path = preview.findCriticalPath(plan);
      expect(path.length).toBe(3);
    });

    it('should find critical path for diamond structure', () => {
      const steps = [
        createStep('step_0', 'Start'),
        createStep('step_1', 'Left', ['step_0']),
        createStep('step_2', 'Right', ['step_0']),
        createStep('step_3', 'End', ['step_1', 'step_2']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const path = preview.findCriticalPath(plan);
      expect(path.length).toBeGreaterThan(0);
      expect(path).toContain('step_3');
    });

    it('should return empty for empty plan', () => {
      const plan = createOrchPlan('plan_1', []);
      expect(preview.findCriticalPath(plan)).toEqual([]);
    });
  });

  describe('detectRisks', () => {
    it('should detect low risk for simple steps', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps);

      const risks = preview.detectRisks(plan);
      expect(risks.low).toHaveLength(1);
      expect(risks.medium).toHaveLength(0);
      expect(risks.high).toHaveLength(0);
    });

    it('should detect higher risk for complex steps', () => {
      const steps = [
        createStep('step_0', 'Complex Task', [], 'special_capability', {
          complex: 'x'.repeat(1500),
        }),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const risks = preview.detectRisks(plan);
      expect(risks.high.length + risks.medium.length).toBeGreaterThan(0);
    });

    it('should detect risk for highly dependent steps', () => {
      const steps = [
        createStep('step_0', 'Hub'),
        createStep('step_1', 'Dep1', ['step_0']),
        createStep('step_2', 'Dep2', ['step_0']),
        createStep('step_3', 'Dep3', ['step_0']),
        createStep('step_4', 'Dep4', ['step_0']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const risks = preview.detectRisks(plan);
      // step_0 has many dependents, should be medium or higher risk
      const step0Risk = [...risks.high, ...risks.medium, ...risks.low].find(
        item => item.id === 'step_0'
      );
      expect(step0Risk).toBeDefined();
      expect(['medium', 'high']).toContain(step0Risk!.risk);
    });
  });

  describe('generateWarnings', () => {
    it('should generate warnings for empty plan', () => {
      const plan = createOrchPlan('plan_1', []);
      const warnings = preview.generateWarnings(plan);
      expect(warnings).toContain('Execution plan has no steps');
    });

    it('should warn about many independent steps', () => {
      const steps = [
        createStep('step_0', 'Task A'),
        createStep('step_1', 'Task B'),
        createStep('step_2', 'Task C'),
        createStep('step_3', 'Task D'),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const warnings = preview.generateWarnings(plan);
      expect(warnings.some(w => w.includes('parallel execution'))).toBe(true);
    });

    it('should warn about high-risk steps', () => {
      const steps = [
        createStep('step_0', 'Hub', [], 'special_capability', {
          complex: 'x'.repeat(2000),
        }),
        createStep('step_1', 'Dep1', ['step_0']),
        createStep('step_2', 'Dep2', ['step_0']),
        createStep('step_3', 'Dep3', ['step_0']),
        createStep('step_4', 'Dep4', ['step_0']),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const warnings = preview.generateWarnings(plan);
      expect(warnings.some(w => w.includes('high risk'))).toBe(true);
    });

    it('should warn about steps with many dependencies', () => {
      const steps = [
        createStep('step_0', 'Task A'),
        createStep('step_1', 'Task B'),
        createStep('step_2', 'Task C'),
        createStep('step_3', 'Task D'),
        createStep('step_4', 'Task E'),
        createStep('step_5', 'Task F'),
        createStep('step_6', 'Complex', [
          'step_0',
          'step_1',
          'step_2',
          'step_3',
          'step_4',
          'step_5',
        ]),
      ];
      const plan = createOrchPlan('plan_1', steps);

      const warnings = preview.generateWarnings(plan);
      expect(warnings.some(w => w.includes('bottlenecks'))).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const stepA: ExecutionStep = {
        stepId: 'step_0',
        request: {
          requestId: 'req_0',
          taskName: 'Task A',
          payload: {},
        },
        dependsOn: ['step_1'],
        status: 'pending',
      };
      const stepB: ExecutionStep = {
        stepId: 'step_1',
        request: {
          requestId: 'req_1',
          taskName: 'Task B',
          payload: {},
        },
        dependsOn: ['step_0'],
        status: 'pending',
      };
      const plan = createOrchPlan('plan_1', [stepA, stepB]);

      const warnings = preview.generateWarnings(plan);
      expect(warnings.some(w => w.includes('Circular'))).toBe(true);
    });
  });

  describe('formatPreview', () => {
    it('should format preview as string', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps);
      const result = preview.preview(plan);

      const formatted = preview.formatPreview(result);
      expect(formatted).toContain('Execution Plan Preview');
      expect(formatted).toContain('Task A');
      expect(formatted).toContain('Total Items');
    });

    it('should include warnings in formatted output', () => {
      const plan = createOrchPlan('plan_1', []);
      const result = preview.preview(plan);

      const formatted = preview.formatPreview(result);
      expect(formatted).toContain('Warnings');
    });
  });

  describe('formatTree', () => {
    it('should format as tree structure', () => {
      const steps = [
        createStep('step_0', 'Root'),
        createStep('step_1', 'Child A', ['step_0']),
        createStep('step_2', 'Child B', ['step_0']),
      ];
      const plan = createOrchPlan('plan_1', steps);
      const result = preview.preview(plan);

      const tree = preview.formatTree(result);
      expect(tree).toContain('Execution Plan Tree');
      expect(tree).toContain('Root');
      expect(tree).toContain('Child A');
      expect(tree).toContain('Child B');
    });

    it('should use tree connectors', () => {
      const steps = [createStep('step_0', 'Root'), createStep('step_1', 'Child', ['step_0'])];
      const plan = createOrchPlan('plan_1', steps);
      const result = preview.preview(plan);

      const tree = preview.formatTree(result);
      expect(tree).toContain('└──');
    });
  });

  describe('formatTimeline', () => {
    it('should format as timeline', () => {
      const steps = [createStep('step_0', 'Task A'), createStep('step_1', 'Task B')];
      const plan = createOrchPlan('plan_1', steps);
      const result = preview.preview(plan);

      const timeline = preview.formatTimeline(result);
      expect(timeline).toContain('Execution Timeline');
      expect(timeline).toContain('Task A');
      expect(timeline).toContain('Task B');
    });

    it('should include risk indicators', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps);
      const result = preview.preview(plan);

      const timeline = preview.formatTimeline(result);
      expect(timeline).toMatch(/\[[HML]\]/);
    });
  });

  describe('integration with orchestration types', () => {
    it('should work with OrchestrationStrategy.AUTO', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps, OrchestrationStrategy.AUTO);

      const result = preview.preview(plan);
      expect(result).toBeDefined();
    });

    it('should work with OrchestrationStrategy.PARALLEL', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps, OrchestrationStrategy.PARALLEL);

      const result = preview.preview(plan);
      expect(result).toBeDefined();
    });

    it('should work with OrchestrationStrategy.SEQUENTIAL', () => {
      const steps = [createStep('step_0', 'Task A')];
      const plan = createOrchPlan('plan_1', steps, OrchestrationStrategy.SEQUENTIAL);

      const result = preview.preview(plan);
      expect(result).toBeDefined();
    });
  });
});
