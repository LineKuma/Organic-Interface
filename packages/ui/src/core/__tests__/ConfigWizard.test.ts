import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ConfigWizard,
  BUILTIN_WIZARDS,
  type WizardConfig,
  type WizardStep,
  type WizardResult,
} from '../ConfigWizard.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ConfigWizard', () => {
  let wizard: ConfigWizard;

  beforeEach(() => {
    wizard = new ConfigWizard();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(wizard).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run a wizard and return result', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First step',
            type: 'text',
            key: 'name',
            default: 'default-name',
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result).toBeDefined();
      expect(result.config).toHaveProperty('name', 'default-name');
      expect(result.completed).toBe(true);
    });

    it('should run multiple steps', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First step',
            type: 'text',
            key: 'name',
            default: 'test',
            required: true,
          },
          {
            id: 'step2',
            title: 'Step 2',
            description: 'Second step',
            type: 'select',
            key: 'color',
            options: ['red', 'green', 'blue'],
            default: 'blue',
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('name', 'test');
      expect(result.config).toHaveProperty('color', 'blue');
      expect(result.completed).toBe(true);
    });

    it('should skip marked steps', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First step',
            type: 'text',
            key: 'name',
            default: 'test',
            required: true,
          },
          {
            id: 'step2',
            title: 'Step 2',
            description: 'Second step',
            type: 'text',
            key: 'skip-this',
            default: 'should-be-skipped',
            required: false,
          },
        ],
      };

      wizard.skipStep('step2');
      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('name', 'test');
      expect(result.config).not.toHaveProperty('skip-this');
      expect(result.skippedSteps).toContain('step2');
    });

    it('should handle select type with default', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Select step',
            type: 'select',
            key: 'choice',
            options: ['a', 'b', 'c'],
            default: 'b',
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('choice', 'b');
    });

    it('should handle select type without default (uses first option)', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Select step',
            type: 'select',
            key: 'choice',
            options: ['a', 'b', 'c'],
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('choice', 'a');
    });

    it('should handle confirm type', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Confirm step',
            type: 'confirm',
            key: 'agree',
            default: true,
            required: false,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('agree', true);
    });

    it('should handle number type', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Number step',
            type: 'number',
            key: 'count',
            default: 42,
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('count', 42);
    });

    it('should handle multiselect type', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test Wizard',
        description: 'A test wizard',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Multiselect step',
            type: 'multiselect',
            key: 'features',
            options: ['a', 'b', 'c'],
            default: ['a', 'b'],
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.config).toHaveProperty('features');
      expect(result.config.features).toEqual(['a', 'b']);
    });
  });

  describe('runStep', () => {
    it('should run a single step', async () => {
      const step: WizardStep = {
        id: 'step1',
        title: 'Test Step',
        description: 'A test step',
        type: 'text',
        key: 'value',
        default: 'hello',
        required: true,
      };

      const value = await wizard.runStep(step);
      expect(value).toBe('hello');
    });

    it('should validate step values', async () => {
      const validate = vi.fn().mockReturnValue(true);
      const step: WizardStep = {
        id: 'step1',
        title: 'Test Step',
        description: 'A test step',
        type: 'text',
        key: 'value',
        default: 'hello',
        required: true,
        validate,
      };

      await wizard.runStep(step);
      expect(validate).toHaveBeenCalled();
    });

    it('should handle validation returning error string', async () => {
      const validate = vi.fn().mockReturnValue('Invalid value');
      const step: WizardStep = {
        id: 'step1',
        title: 'Test Step',
        description: 'A test step',
        type: 'text',
        key: 'value',
        default: 'hello',
        required: true,
        validate,
      };

      const value = await wizard.runStep(step);
      expect(value).toBe('hello');
    });
  });

  describe('skipStep', () => {
    it('should mark a step as skipped', async () => {
      wizard.skipStep('step1');

      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'Test',
            type: 'text',
            key: 'val',
            required: true,
          },
        ],
      };

      const result = await wizard.run(config);
      expect(result.skippedSteps).toContain('step1');
      expect(result.config).not.toHaveProperty('val');
    });
  });

  describe('goBack', () => {
    it('should go back to previous step', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First',
            type: 'text',
            key: 'first',
            default: 'a',
            required: true,
          },
          {
            id: 'step2',
            title: 'Step 2',
            description: 'Second',
            type: 'text',
            key: 'second',
            default: 'b',
            required: true,
          },
        ],
      };

      await wizard.run(config);
      wizard.goBack();

      const progress = wizard.getProgress();
      expect(progress.completed).toContain('first');
      expect(progress.current).toBeGreaterThanOrEqual(1);
    });

    it('should handle goBack with no history', () => {
      wizard.goBack();
      const progress = wizard.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
    });
  });

  describe('getProgress', () => {
    it('should return initial progress', () => {
      const progress = wizard.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.completed).toEqual([]);
    });

    it('should return progress after running', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First',
            type: 'text',
            key: 'key',
            default: 'val',
            required: true,
          },
        ],
      };

      await wizard.run(config);
      const progress = wizard.getProgress();
      expect(progress.total).toBe(1);
      expect(progress.completed).toContain('key');
    });
  });

  describe('saveToFile and loadFromFile', () => {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, 'organic-test-wizard-config.json');

    afterEach(async () => {
      try {
        await fs.unlink(testFile);
      } catch {
        // File may not exist
      }
    });

    it('should save result to file', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [],
      };

      await wizard.run(config);

      const result: WizardResult = {
        config: { key: 'value' },
        completed: true,
        skippedSteps: [],
      };

      await wizard.saveToFile(result, testFile);

      const content = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.config).toEqual({ key: 'value' });
      expect(parsed.completed).toBe(true);
    });

    it('should load result from file', async () => {
      const data = {
        wizardId: 'test',
        completed: true,
        skippedSteps: [],
        config: { key: 'value' },
        savedAt: new Date().toISOString(),
      };

      await fs.writeFile(testFile, JSON.stringify(data, null, 2), 'utf-8');

      const result = await wizard.loadFromFile(testFile);
      expect(result.config).toEqual({ key: 'value' });
      expect(result.completed).toBe(true);
    });

    it('should throw on save failure for invalid path', async () => {
      const result: WizardResult = {
        config: {},
        completed: false,
        skippedSteps: [],
      };

      // Use a path where the parent is a readonly directory
      await expect(wizard.saveToFile(result, '/dev/null/subdir/file.json')).rejects.toThrow();
    });

    it('should throw on load failure for non-existent file', async () => {
      await expect(wizard.loadFromFile('/nonexistent/path/file.json')).rejects.toThrow();
    });
  });

  describe('getCurrentStep', () => {
    it('should return null when no config set', () => {
      expect(wizard.getCurrentStep()).toBeNull();
    });

    it('should return current step after running', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First',
            type: 'text',
            key: 'key',
            default: 'val',
            required: true,
          },
        ],
      };

      await wizard.run(config);
      const step = wizard.getCurrentStep();
      expect(step).toBeDefined();
      expect(step!.id).toBe('step1');
    });
  });

  describe('reset', () => {
    it('should reset wizard state', async () => {
      const config: WizardConfig = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First',
            type: 'text',
            key: 'key',
            default: 'val',
            required: true,
          },
        ],
      };

      await wizard.run(config);
      wizard.reset();

      const progress = wizard.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.completed).toEqual([]);
      expect(wizard.getCurrentStep()).toBeNull();
    });
  });

  describe('BUILTIN_WIZARDS', () => {
    it('should have initial-setup wizard', () => {
      expect(BUILTIN_WIZARDS['initial-setup']).toBeDefined();
    });

    it('should have correct steps for initial-setup', () => {
      const wizard = BUILTIN_WIZARDS['initial-setup'];
      expect(wizard.steps).toHaveLength(5);
      expect(wizard.steps.map(s => s.key)).toEqual([
        'language',
        'securityPreset',
        'storageBackend',
        'telemetry',
        'defaultModel',
      ]);
    });
  });

  describe('getInitialSetupWizard', () => {
    it('should return a copy of the initial-setup wizard', () => {
      const wizard1 = ConfigWizard.getInitialSetupWizard();
      const wizard2 = ConfigWizard.getInitialSetupWizard();
      expect(wizard1).not.toBe(wizard2);
      expect(wizard1.steps).toEqual(wizard2.steps);
    });

    it('should run the initial-setup wizard', async () => {
      const wizard = new ConfigWizard();
      const config = ConfigWizard.getInitialSetupWizard();
      const result = await wizard.run(config);

      expect(result.config).toHaveProperty('language', 'en');
      expect(result.config).toHaveProperty('securityPreset', 'standard');
      expect(result.config).toHaveProperty('storageBackend', 'file');
      expect(result.config).toHaveProperty('telemetry', false);
      expect(result.config).toHaveProperty('defaultModel', 'gpt-4');
      expect(result.completed).toBe(true);
    });
  });

  describe('validation', () => {
    it('should handle validation returning true', async () => {
      const step: WizardStep = {
        id: 'step1',
        title: 'Test',
        description: 'Test',
        type: 'text',
        key: 'val',
        default: 'ok',
        required: true,
        validate: () => true,
      };

      const value = await wizard.runStep(step);
      expect(value).toBe('ok');
    });

    it('should handle validation returning false', async () => {
      const step: WizardStep = {
        id: 'step1',
        title: 'Test',
        description: 'Test',
        type: 'text',
        key: 'val',
        default: 'bad',
        required: true,
        validate: () => false,
      };

      const value = await wizard.runStep(step);
      // Value should still be returned even if validation fails
      expect(value).toBe('bad');
    });
  });
});
