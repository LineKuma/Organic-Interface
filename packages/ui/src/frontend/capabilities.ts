/**
 * @organic/ui - standard frontend capability registry
 *
 * The source of truth for the standard functional interface that every TUI and WebUI
 * frontend must implement (or provide an acceptable stub for). `FRONTEND_CAPABILITIES`
 * enumerates every capability group and its interface methods; `getFrontendCoverage()`
 * audits a concrete frontend instance against this registry.
 */

/**
 * A single standard interface method within a capability group.
 */
export interface CapabilityMethodDefinition {
  /** Method name, implemented on `UIFrontend` (and subclasses) */
  name: string;
  /**
   * Tier A (`required: true`) methods MUST ship a working implementation in every
   * frontend. Tier B (`required: false`) methods may keep the base stub, but every
   * method must still be present (implemented or stubbed) so the full surface is stable.
   */
  required: boolean;
}

/**
 * A capability group (e.g. `conversation`, `workflow`) and its interface methods.
 */
export interface CapabilityGroupDefinition {
  /** Capability group id */
  id: string;
  /** Human-readable capability name */
  title: string;
  /** Interface methods belonging to this group */
  methods: CapabilityMethodDefinition[];
}

/**
 * The standard functional interface, expressed as capability groups.
 *
 * This is the contract that both TUI and WebUI MUST implement. It is derived from the
 * full set of Organic-Interface features (see `docs/feature-021-ui-frontend-interface.md`).
 */
export const FRONTEND_CAPABILITIES: readonly CapabilityGroupDefinition[] = [
  {
    id: 'system',
    title: 'System & Runtime',
    methods: [
      { name: 'getInfo', required: true },
      { name: 'healthCheck', required: true },
      { name: 'getLogs', required: false },
    ],
  },
  {
    id: 'conversation',
    title: 'Conversation & Sessions',
    methods: [
      { name: 'createSession', required: true },
      { name: 'listSessions', required: true },
      { name: 'loadSession', required: true },
      { name: 'deleteSession', required: false },
      { name: 'sendMessage', required: true },
      { name: 'streamMessage', required: false },
    ],
  },
  {
    id: 'tasks',
    title: 'Agent Tasks & Orchestration',
    methods: [
      { name: 'submitTask', required: true },
      { name: 'getTaskStatus', required: true },
      { name: 'listTasks', required: true },
      { name: 'cancelTask', required: true },
      { name: 'previewPlan', required: false },
      { name: 'decidePlan', required: false },
    ],
  },
  {
    id: 'workflow',
    title: 'Workflow Engine',
    methods: [
      { name: 'listWorkflows', required: true },
      { name: 'createWorkflow', required: true },
      { name: 'updateWorkflow', required: false },
      { name: 'deleteWorkflow', required: true },
      { name: 'runWorkflow', required: true },
      { name: 'pauseWorkflow', required: false },
      { name: 'resumeWorkflow', required: false },
      { name: 'getWorkflowExecution', required: true },
    ],
  },
  {
    id: 'prompt',
    title: 'Prompt Management',
    methods: [
      { name: 'listPrompts', required: true },
      { name: 'getPrompt', required: true },
      { name: 'createPrompt', required: true },
      { name: 'updatePrompt', required: true },
      { name: 'deletePrompt', required: true },
      { name: 'previewPrompt', required: false },
      { name: 'listPromptVersions', required: false },
      { name: 'rollbackPrompt', required: false },
    ],
  },
  {
    id: 'fileref',
    title: 'File Reference',
    methods: [
      { name: 'referenceFile', required: true },
      { name: 'referenceDirectory', required: false },
      { name: 'listReferences', required: true },
      { name: 'removeReference', required: true },
      { name: 'getFileSymbols', required: false },
      { name: 'getFileDependencies', required: false },
    ],
  },
  {
    id: 'config',
    title: 'Configuration',
    methods: [
      { name: 'getAllConfig', required: true },
      { name: 'updateConfig', required: true },
      { name: 'resetConfig', required: false },
      { name: 'listConfigWizards', required: false },
      { name: 'runConfigWizard', required: true },
    ],
  },
  {
    id: 'security',
    title: 'Security & Approval',
    methods: [
      { name: 'getSecurityPresets', required: true },
      { name: 'setSecurityPreset', required: true },
      { name: 'requestApproval', required: true },
      { name: 'respondApproval', required: true },
      { name: 'listAuditLogs', required: false },
    ],
  },
  {
    id: 'uiops',
    title: 'UI as a Tool',
    methods: [
      { name: 'runUIOperation', required: true },
      { name: 'getUIState', required: true },
      { name: 'setUIPermissionLevel', required: false },
    ],
  },
  {
    id: 'recording',
    title: 'Operation Recording & Replay',
    methods: [
      { name: 'startRecording', required: true },
      { name: 'stopRecording', required: true },
      { name: 'listRecordings', required: true },
      { name: 'replayRecording', required: false },
      { name: 'diffRecordings', required: false },
    ],
  },
];

/**
 * Flattened method lookup: `methodGroup` map of method name -> owning group id.
 */
export const FRONTEND_METHOD_OWNER: Readonly<Record<string, string>> = FRONTEND_CAPABILITIES.reduce<
  Record<string, string>
>((acc, group) => {
  for (const method of group.methods) {
    acc[method.name] = group.id;
  }
  return acc;
}, {});

/**
 * Implementation status of a single standard method.
 */
export type FrontendMethodStatus = 'implemented' | 'stub';

/**
 * Coverage report for a single standard method.
 */
export interface FrontendMethodCoverage {
  /** Method name */
  method: string;
  /** Whether the owning group requires a real implementation (Tier A) */
  required: boolean;
  /** `implemented` when the frontend overrides the base stub */
  status: FrontendMethodStatus;
  /** User-declared reason for an intentional stub (when status === 'stub') */
  reason?: string;
}

/**
 * Coverage report for a full capability group.
 */
export interface FrontendCapabilityCoverage {
  /** Capability group id */
  group: string;
  /** Capability title */
  title: string;
  /** Per-method coverage */
  methods: FrontendMethodCoverage[];
}

/**
 * Methods that the base `UIFrontend` implements with real behaviour (not throwing stubs),
 * so they count as `implemented` even when a frontend does not override them.
 */
const BASE_REAL_METHODS: ReadonlySet<string> = new Set(['getInfo', 'healthCheck']);

/**
 * Summary coverage report for a frontend instance.
 */
export interface FrontendCoverageReport {
  /** Coverage grouped by capability */
  capabilities: FrontendCapabilityCoverage[];
  /** Total number of standard methods */
  total: number;
  /** Number of methods with a real implementation */
  implemented: number;
  /** Number of methods left as stubs */
  stubbed: number;
  /** Whether the frontend satisfies the full contract (no required method is stubbed) */
  conformat: boolean;
  /** Required (Tier A) methods that were left as stubs — these are the blockers */
  violations: string[];
  /** Method names that are stubbed together with their declared reason */
  stubReasons: Record<string, string | undefined>;
}

/**
 * Build a coverage report for a concrete frontend by comparing each method against the
 * reference stub implementation on `UIFrontend.prototype`.
 *
 * The base class ships a stub for every method. A method counts as `implemented` only
 * when the instance's own prototype overrides the base stub (i.e. it is no longer the
 * same reference as the default stub).
 *
 * @param instance - the frontend instance to audit
 * @param prototype - the base stub holder (`UIFrontend.prototype`) to compare against
 * @param stubReasons - map of method name -> declared reason for intentional stubs
 */
export function getFrontendCoverage(
  instance: object,
  prototype: object,
  stubReasons: Record<string, string | undefined> = {}
): FrontendCoverageReport {
  const self = instance as Record<string, unknown>;
  const base = prototype as Record<string, unknown>;

  const stubMethods = (method: string, required: boolean): FrontendMethodCoverage => {
    const impl = self[method];
    // A method is a stub only when it still uses the base throwing implementation
    // AND is not one of the base-real methods (getInfo / healthCheck).
    const isStub =
      !BASE_REAL_METHODS.has(method) && typeof impl === 'function' && base[method] === impl;
    return {
      method,
      required,
      status: isStub ? 'stub' : 'implemented',
      reason: isStub ? stubReasons[method] : undefined,
    };
  };

  const capabilities: FrontendCapabilityCoverage[] = FRONTEND_CAPABILITIES.map(group => ({
    group: group.id,
    title: group.title,
    methods: group.methods.map(m => stubMethods(m.name, m.required)),
  }));

  const total = capabilities.reduce((n, g) => n + g.methods.length, 0);
  let implemented = 0;
  const violations: string[] = [];
  const reasons: Record<string, string | undefined> = {};

  for (const group of capabilities) {
    for (const method of group.methods) {
      if (method.status === 'implemented') {
        implemented += 1;
      } else {
        reasons[method.method] = method.reason;
        if (method.required) {
          violations.push(`${group.group}.${method.method}`);
        }
      }
    }
  }

  return {
    capabilities,
    total,
    implemented,
    stubbed: total - implemented,
    conformat: violations.length === 0,
    violations,
    stubReasons: reasons,
  };
}
