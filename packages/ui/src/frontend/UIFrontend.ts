/**
 * @organic/ui - UIFrontend: standard functional interface for TUI and WebUI
 *
 * This abstract base class IS the standard functional interface that every future TUI
 * and WebUI must implement. It defines the full surface of Organic-Interface features
 * (`systems`, `conversation`, `tasks`, `workflow`, `prompt`, `fileref`, `config`,
 * `security`, `uiops`, `recording`) and provides a default stub for EVERY method.
 *
 * Contract rule (see `docs/feature-021-ui-frontend-interface.md`):
 *  - A method MUST either be implemented by the frontend (Tier A required methods) or
 *    intentionally left as a stub.
 *  - The base stubs satisfy the "acceptable stub" requirement: they fail loudly with
 *    `NotImplementedError` (never silent) and are reported by `getCoverage()`.
 *  - `getCoverage()` audits the frontend and flags any Tier A method that was left as a
 *    stub, turning "implement everything or stub acceptably" into a checkable guarantee.
 */

import { NotImplementedError } from './errors.js';
import {
  FRONTEND_CAPABILITIES,
  getFrontendCoverage,
  type FrontendCoverageReport,
  type FrontendMethodCoverage,
} from './capabilities.js';
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalResult,
  AuditLogEntry,
  ConfigUpdate,
  ConfigWizardDescriptor,
  CreateSessionInput,
  DependencyInfo,
  FileReferenceDescriptor,
  FrontendHealth,
  FrontendInfo,
  FrontendKind,
  FrontendUIState,
  LogEntry,
  MessageResult,
  OrchestrationPlan,
  PromptDescriptor,
  PromptInput,
  PromptPreviewInput,
  PromptPreviewResult,
  PromptVersionInfo,
  RecordingDescriptor,
  RecordingStartInput,
  ReplayInput,
  ReplaySummary,
  SecurityPresetDescriptor,
  SendMessageInput,
  SessionDescriptor,
  StreamEvent,
  SymbolInfo,
  TaskInfo,
  TaskInput,
  UIOperationInput,
  UIOperationResult,
  UIPermissionLevel,
  WorkflowDescriptor,
  WorkflowExecutionInfo,
} from './types.js';

/**
 * Options shared by all frontends.
 */
export interface FrontendOptions {
  kind: FrontendKind;
  name: string;
  version: string;
  /**
   * Method names intentionally left as stubs, mapped to a human-readable reason.
   * Declaring a stub here makes it "acceptable" and documents why a feature is absent
   * (e.g. `{ 'prompt.rollbackPrompt': 'deferred to v2' }`).
   */
  stubs?: Record<string, string>;
  /** Additional metadata surfaced via `getInfo()` */
  metadata?: Record<string, unknown>;
}

/**
 * The standard functional interface that TUI and WebUI must implement.
 *
 * Every method ships a default stub that throws `NotImplementedError`. Subclasses
 * override the methods they support. Use `getCoverage()` to audit completeness and
 * `declareStub()` to mark intentional (acceptable) stubs.
 */
export abstract class UIFrontend {
  public readonly kind: FrontendKind;
  public readonly name: string;
  public readonly version: string;

  private readonly metadata: Record<string, unknown>;
  private readonly stubReasons: Record<string, string | undefined>;

  constructor(options: FrontendOptions) {
    this.kind = options.kind;
    this.name = options.name;
    this.version = options.version;
    this.metadata = { ...(options.metadata ?? {}) };
    this.stubReasons = { ...(options.stubs ?? {}) };

    for (const method of Object.keys(this.stubReasons)) {
      if (!(method in this)) {
        throw new Error(
          `UIFrontend: declared stub '${method}' is not a known interface method. ` +
            `Valid methods: ${FRONTEND_CAPABILITIES.flatMap(g => g.methods.map(m => `${g.id}.${m.name}`)).join(', ')}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stub support
  // -------------------------------------------------------------------------

  /**
   * Mark a method as an intentional (acceptable) stub with a reason.
   * Must be called with a fully-qualified key like `workflow.rollbackWorkflow`;
   * the method key is scoped to its capability group.
   */
  declareStub(feature: string, reason: string): void {
    const [group, method] = feature.split('.');
    if (!group || !method) {
      throw new Error(`declareStub expects '<group>.<method>', got '${feature}'`);
    }
    const known = FRONTEND_CAPABILITIES.find(g => g.id === group)?.methods.some(
      m => m.name === method
    );
    if (!known) {
      throw new Error(`declareStub: unknown feature '${feature}'`);
    }
    this.stubReasons[method] = reason;
  }

  /** Record a reason for a stub by its bare method name (used internally). */
  protected _stub(feature: string, hint?: string): never {
    const reason = hint ?? this.stubReasons[feature.split('.')[1]];
    throw new NotImplementedError(feature, reason);
  }

  /**
   * Audit this frontend against the full standard interface.
   * `conformat` is false while any Tier A (required) method is still a stub.
   */
  getCoverage(): FrontendCoverageReport {
    return getFrontendCoverage(this, UIFrontend.prototype, this.stubReasons);
  }

  /** List every standard method with its per-method coverage. */
  listCapabilities(): FrontendMethodCoverage[] {
    return this.getCoverage().capabilities.flatMap(g => g.methods);
  }

  // -------------------------------------------------------------------------
  // system — System & Runtime
  // -------------------------------------------------------------------------

  /** Return frontend identity/metadata. */
  async getInfo(): Promise<FrontendInfo> {
    return {
      name: this.name,
      version: this.version,
      kind: this.kind,
      metadata: this.metadata,
    };
  }

  /** Check frontend health. */
  async healthCheck(): Promise<FrontendHealth> {
    return { ok: true, status: 'ok' };
  }

  /** Fetch recent logs (optional). */
  async getLogs(filter?: { level?: LogEntry['level']; limit?: number }): Promise<LogEntry[]> {
    void filter;
    return this._stub('system.getLogs');
  }

  // -------------------------------------------------------------------------
  // conversation — Conversation & Sessions
  // -------------------------------------------------------------------------

  /** Create (or resume) a conversation session. */
  async createSession(input: CreateSessionInput): Promise<SessionDescriptor> {
    void input;
    return this._stub('conversation.createSession');
  }

  /** List existing sessions. */
  async listSessions(): Promise<SessionDescriptor[]> {
    return this._stub('conversation.listSessions');
  }

  /** Load an existing session into the frontend. */
  async loadSession(sessionId: string): Promise<SessionDescriptor> {
    void sessionId;
    return this._stub('conversation.loadSession');
  }

  /** Delete a conversation session (optional). */
  async deleteSession(sessionId: string): Promise<void> {
    void sessionId;
    return this._stub('conversation.deleteSession');
  }

  /** Send a message and await the complete assistant reply. */
  async sendMessage(input: SendMessageInput): Promise<MessageResult> {
    void input;
    return this._stub('conversation.sendMessage');
  }

  /** Stream an assistant reply as a sequence of events (optional). */
  async streamMessage(input: SendMessageInput): Promise<AsyncIterable<StreamEvent>> {
    void input;
    return this._stub('conversation.streamMessage');
  }

  // -------------------------------------------------------------------------
  // tasks — Agent Tasks & Orchestration
  // -------------------------------------------------------------------------

  /** Submit an agent task. */
  async submitTask(input: TaskInput): Promise<TaskInfo> {
    void input;
    return this._stub('tasks.submitTask');
  }

  /** Poll a task status. */
  async getTaskStatus(taskId: string): Promise<TaskInfo> {
    void taskId;
    return this._stub('tasks.getTaskStatus');
  }

  /** List tracked tasks. */
  async listTasks(filter?: { status?: TaskInfo['status'] }): Promise<TaskInfo[]> {
    void filter;
    return this._stub('tasks.listTasks');
  }

  /** Cancel a running/queued task. */
  async cancelTask(taskId: string): Promise<void> {
    void taskId;
    return this._stub('tasks.cancelTask');
  }

  /** Preview an orchestration plan for approval (optional). */
  async previewPlan(input: TaskInput): Promise<OrchestrationPlan> {
    void input;
    return this._stub('tasks.previewPlan');
  }

  /** Approve/reject a previewed orchestration plan (optional). */
  async decidePlan(planId: string, decision: ApprovalDecision): Promise<void> {
    void planId;
    void decision;
    return this._stub('tasks.decidePlan');
  }

  // -------------------------------------------------------------------------
  // workflow — Workflow Engine
  // -------------------------------------------------------------------------

  /** List workflow definitions. */
  async listWorkflows(): Promise<WorkflowDescriptor[]> {
    return this._stub('workflow.listWorkflows');
  }

  /** Create a workflow definition. */
  async createWorkflow(input: WorkflowDescriptor): Promise<WorkflowDescriptor> {
    void input;
    return this._stub('workflow.createWorkflow');
  }

  /** Update a workflow definition (optional). */
  async updateWorkflow(
    workflowId: string,
    update: Partial<WorkflowDescriptor>
  ): Promise<WorkflowDescriptor> {
    void workflowId;
    void update;
    return this._stub('workflow.updateWorkflow');
  }

  /** Delete a workflow definition. */
  async deleteWorkflow(workflowId: string): Promise<void> {
    void workflowId;
    return this._stub('workflow.deleteWorkflow');
  }

  /** Run a workflow. */
  async runWorkflow(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecutionInfo> {
    void workflowId;
    void input;
    return this._stub('workflow.runWorkflow');
  }

  /** Pause a running workflow execution (optional). */
  async pauseWorkflow(executionId: string): Promise<void> {
    void executionId;
    return this._stub('workflow.pauseWorkflow');
  }

  /** Resume a paused workflow execution (optional). */
  async resumeWorkflow(executionId: string): Promise<void> {
    void executionId;
    return this._stub('workflow.resumeWorkflow');
  }

  /** Fetch a workflow execution status. */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecutionInfo> {
    void executionId;
    return this._stub('workflow.getWorkflowExecution');
  }

  // -------------------------------------------------------------------------
  // prompt — Prompt Management
  // -------------------------------------------------------------------------

  /** List prompt templates. */
  async listPrompts(filter?: { category?: string; tags?: string[] }): Promise<PromptDescriptor[]> {
    void filter;
    return this._stub('prompt.listPrompts');
  }

  /** Get a prompt template. */
  async getPrompt(promptId: string): Promise<PromptDescriptor> {
    void promptId;
    return this._stub('prompt.getPrompt');
  }

  /** Create a prompt template. */
  async createPrompt(input: PromptInput): Promise<PromptDescriptor> {
    void input;
    return this._stub('prompt.createPrompt');
  }

  /** Update a prompt template. */
  async updatePrompt(promptId: string, update: Partial<PromptInput>): Promise<PromptDescriptor> {
    void promptId;
    void update;
    return this._stub('prompt.updatePrompt');
  }

  /** Delete a prompt template. */
  async deletePrompt(promptId: string): Promise<void> {
    void promptId;
    return this._stub('prompt.deletePrompt');
  }

  /** Render a prompt template with variables (optional). */
  async previewPrompt(input: PromptPreviewInput): Promise<PromptPreviewResult> {
    void input;
    return this._stub('prompt.previewPrompt');
  }

  /** List available versions of a prompt (optional). */
  async listPromptVersions(promptId: string): Promise<PromptVersionInfo[]> {
    void promptId;
    return this._stub('prompt.listPromptVersions');
  }

  /** Roll a prompt back to a specific version (optional). */
  async rollbackPrompt(promptId: string, version: string): Promise<PromptDescriptor> {
    void promptId;
    void version;
    return this._stub('prompt.rollbackPrompt');
  }

  // -------------------------------------------------------------------------
  // fileref — File Reference
  // -------------------------------------------------------------------------

  /** Reference a file into the active context. */
  async referenceFile(path: string): Promise<FileReferenceDescriptor> {
    void path;
    return this._stub('fileref.referenceFile');
  }

  /** Reference a directory into the active context (optional). */
  async referenceDirectory(path: string): Promise<FileReferenceDescriptor> {
    void path;
    return this._stub('fileref.referenceDirectory');
  }

  /** List active file references. */
  async listReferences(): Promise<FileReferenceDescriptor[]> {
    return this._stub('fileref.listReferences');
  }

  /** Remove a file reference. */
  async removeReference(referenceId: string): Promise<void> {
    void referenceId;
    return this._stub('fileref.removeReference');
  }

  /** Get parsed symbols for a referenced file (optional). */
  async getFileSymbols(path: string): Promise<SymbolInfo[]> {
    void path;
    return this._stub('fileref.getFileSymbols');
  }

  /** Get dependency edges for a referenced file (optional). */
  async getFileDependencies(path: string): Promise<DependencyInfo[]> {
    void path;
    return this._stub('fileref.getFileDependencies');
  }

  // -------------------------------------------------------------------------
  // config — Configuration
  // -------------------------------------------------------------------------

  /** Read the effective configuration. */
  async getAllConfig(): Promise<Record<string, unknown>> {
    return this._stub('config.getAllConfig');
  }

  /** Apply configuration updates. */
  async updateConfig(update: ConfigUpdate): Promise<Record<string, unknown>> {
    void update;
    return this._stub('config.updateConfig');
  }

  /** Reset configuration for a scope (optional). */
  async resetConfig(scope: string): Promise<void> {
    void scope;
    return this._stub('config.resetConfig');
  }

  /** List available configuration wizards (optional). */
  async listConfigWizards(): Promise<ConfigWizardDescriptor[]> {
    return this._stub('config.listConfigWizards');
  }

  /** Run a configuration wizard. */
  async runConfigWizard(wizardId: string): Promise<Record<string, unknown>> {
    void wizardId;
    return this._stub('config.runConfigWizard');
  }

  // -------------------------------------------------------------------------
  // security — Security & Approval
  // -------------------------------------------------------------------------

  /** List security presets and the active one. */
  async getSecurityPresets(): Promise<SecurityPresetDescriptor[]> {
    return this._stub('security.getSecurityPresets');
  }

  /** Activate a security preset. */
  async setSecurityPreset(presetId: string): Promise<void> {
    void presetId;
    return this._stub('security.setSecurityPreset');
  }

  /** Present an approval request to the user. */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    void request;
    return this._stub('security.requestApproval');
  }

  /** Record a user decision for an outstanding approval. */
  async respondApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    void requestId;
    void decision;
    return this._stub('security.respondApproval');
  }

  /** List audit/log entries (optional). */
  async listAuditLogs(filter?: { limit?: number }): Promise<AuditLogEntry[]> {
    void filter;
    return this._stub('security.listAuditLogs');
  }

  // -------------------------------------------------------------------------
  // uiops — UI as a Tool
  // -------------------------------------------------------------------------

  /** Execute a UI operation on behalf of an agent. */
  async runUIOperation(input: UIOperationInput): Promise<UIOperationResult> {
    void input;
    return this._stub('uiops.runUIOperation');
  }

  /** Return the UI elements the current frontend exposes to the agent. */
  async getUIState(): Promise<FrontendUIState> {
    return this._stub('uiops.getUIState');
  }

  /** Adjust the agent permission level for UI operations (optional). */
  async setUIPermissionLevel(level: UIPermissionLevel): Promise<void> {
    void level;
    return this._stub('uiops.setUIPermissionLevel');
  }

  // -------------------------------------------------------------------------
  // recording — Operation Recording & Replay
  // -------------------------------------------------------------------------

  /** Start recording operations. */
  async startRecording(input: RecordingStartInput): Promise<RecordingDescriptor> {
    void input;
    return this._stub('recording.startRecording');
  }

  /** Stop recording. */
  async stopRecording(recordingId: string): Promise<RecordingDescriptor> {
    void recordingId;
    return this._stub('recording.stopRecording');
  }

  /** List saved recordings. */
  async listRecordings(): Promise<RecordingDescriptor[]> {
    return this._stub('recording.listRecordings');
  }

  /** Replay a recording (optional). */
  async replayRecording(input: ReplayInput): Promise<ReplaySummary> {
    void input;
    return this._stub('recording.replayRecording');
  }

  /** Diff two recordings (optional). */
  async diffRecordings(a: string, b: string): Promise<unknown> {
    void a;
    void b;
    return this._stub('recording.diffRecordings');
  }
}
