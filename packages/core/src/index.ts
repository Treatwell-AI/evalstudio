export { getStatus, type Status } from "./status.js";
export type { Message } from "./types.js";
export {
  createJsonRepository,
  type Repository,
} from "./repository.js";
export {
  resolveWorkspace,
  resolveProject,
  resolveProjectFromCwd,
  listProjects,
  createProject,
  deleteProject,
  initWorkspace,
  CONFIG_FILENAME,
  ERR_NO_PROJECT,
  type ProjectContext,
  type ProjectInfo,
  type InitWorkspaceResult,
  // Legacy compatibility
  getStorageDir,
  setStorageDir,
  resetStorageDir,
  getConfigPath,
  setConfigDir,
} from "./project-resolver.js";
export {
  readWorkspaceConfig,
  writeWorkspaceConfig,
  updateWorkspaceConfig,
  getProjectConfig,
  updateProjectConfig,
  redactApiKey,
  type StorageType,
  type StorageConfig,
  type FilesystemStorageConfig,
  type PostgresStorageConfig,
  type WorkspaceConfig,
  type ProjectEntry,
  type UpdateWorkspaceConfigInput,
  type UpdateProjectConfigInput,
  type ProjectConfig,
  type LLMSettings,
  type LLMModelSettings,
} from "./project.js";
export {
  createPersonaModule,
  type PersonaModule,
  type CreatePersonaInput,
  type Persona,
  type UpdatePersonaInput,
} from "./persona.js";
export {
  createScenarioModule,
  type ScenarioModule,
  type CreateScenarioInput,
  type FailureCriteriaMode,
  type Scenario,
  type UpdateScenarioInput,
} from "./scenario.js";
export {
  createEvalModule,
  type EvalModule,
  type EvalModuleDeps,
  type CreateEvalInput,
  type Eval,
  type EvalWithRelations,
  type UpdateEvalInput,
} from "./eval.js";
export {
  getLLMProviderFromProjectConfig,
  getDefaultModels,
  type LLMProvider,
  type LLMProviderConfig,
  type ModelGroup,
  type ProviderType,
} from "./llm-provider.js";
export {
  createConnectorModule,
  getConnectorTypes,
  type ConnectorModule,
  type Connector,
  type ConnectorConfig,
  type ConnectorInvokeInput,
  type ConnectorInvokeResult,
  type ConnectorTestResult,
  type ConnectorType,
  type CreateConnectorInput,
  type HttpConnectorConfig,
  type LangGraphConnectorConfig,
  type UpdateConnectorInput,
} from "./connector.js";
export {
  createRunModule,
  type RunModule,
  type RunModuleDeps,
  type CreatePlaygroundRunInput,
  type CreateRunInput,
  type ListRunsOptions,
  type Run,
  type RunMetadata,
  type RunResult,
  type RunStatus,
  type UpdateRunInput,
} from "./run.js";
export {
  createExecutionModule,
  type ExecutionModule,
  type CreateExecutionInput,
  type Execution,
} from "./execution.js";
export {
  createProjectModules,
  type ProjectModules,
} from "./module-factory.js";
export { type StorageProvider } from "./storage-provider.js";
export { createFilesystemStorage } from "./filesystem-storage.js";
export { createStorageProvider, resolveConnectionString } from "./storage-factory.js";
export {
  buildTestAgentSystemPrompt,
  buildTestAgentMessages,
  type BuildTestAgentPromptInput,
} from "./prompt.js";
export { RunProcessor, type RunProcessorOptions } from "./run-processor.js";
export {
  evaluateCriteria,
  type CriteriaEvaluationResult,
  type EvaluateCriteriaInput,
} from "./evaluator.js";
export {
  generatePersonaMessage,
  type GeneratePersonaMessageInput,
  type GeneratePersonaMessageResult,
} from "./persona-generator.js";
export {
  chatCompletion,
  getDefaultModelForProvider,
  type ChatCompletionMessage,
  type ChatCompletionOptions,
  type ChatCompletionResult,
} from "./llm-client.js";
