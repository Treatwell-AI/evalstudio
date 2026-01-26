import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLLMProvider } from "./llm-provider.js";
import { getStorageDir } from "./storage.js";

/**
 * LLM settings for a specific use-case (evaluation or persona generation)
 */
export interface LLMUseCaseSettings {
  providerId: string;
  model?: string;
}

/**
 * Project-level LLM configuration for different use-cases
 */
export interface ProjectLLMSettings {
  /** LLM settings for evaluation/judging conversations */
  evaluation?: LLMUseCaseSettings;
  /** LLM settings for persona response generation */
  persona?: LLMUseCaseSettings;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Default LLM settings for the project */
  llmSettings?: ProjectLLMSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  llmSettings?: ProjectLLMSettings;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  /** Set to null to clear LLM settings */
  llmSettings?: ProjectLLMSettings | null;
}

function getStoragePath(): string {
  return join(getStorageDir(), "projects.json");
}

function loadProjects(): Project[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as Project[];
}

function saveProjects(projects: Project[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(projects, null, 2));
}

export function createProject(input: CreateProjectInput): Project {
  const projects = loadProjects();

  if (projects.some((p) => p.name === input.name)) {
    throw new Error(`Project with name "${input.name}" already exists`);
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    llmSettings: input.llmSettings,
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);
  saveProjects(projects);

  return project;
}

export function getProject(id: string): Project | undefined {
  const projects = loadProjects();
  return projects.find((p) => p.id === id);
}

export function getProjectByName(name: string): Project | undefined {
  const projects = loadProjects();
  return projects.find((p) => p.name === name);
}

export function listProjects(): Project[] {
  return loadProjects();
}

export function updateProject(
  id: string,
  input: UpdateProjectInput
): Project | undefined {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) {
    return undefined;
  }

  if (input.name && projects.some((p) => p.name === input.name && p.id !== id)) {
    throw new Error(`Project with name "${input.name}" already exists`);
  }

  // Validate LLM settings if provided
  if (input.llmSettings) {
    const { evaluation, persona } = input.llmSettings;
    if (evaluation?.providerId) {
      const provider = getLLMProvider(evaluation.providerId);
      if (!provider) {
        throw new Error(
          `LLM Provider with id "${evaluation.providerId}" not found`
        );
      }
      if (provider.projectId !== id) {
        throw new Error("Evaluation LLM Provider does not belong to this project");
      }
    }
    if (persona?.providerId) {
      const provider = getLLMProvider(persona.providerId);
      if (!provider) {
        throw new Error(
          `LLM Provider with id "${persona.providerId}" not found`
        );
      }
      if (provider.projectId !== id) {
        throw new Error("Persona LLM Provider does not belong to this project");
      }
    }
  }

  const project = projects[index];

  // Handle llmSettings: null clears, undefined keeps existing, object updates
  let newLLMSettings: ProjectLLMSettings | undefined;
  if (input.llmSettings === null) {
    newLLMSettings = undefined;
  } else if (input.llmSettings !== undefined) {
    newLLMSettings = input.llmSettings;
  } else {
    newLLMSettings = project.llmSettings;
  }

  const updated: Project = {
    ...project,
    name: input.name ?? project.name,
    description: input.description ?? project.description,
    llmSettings: newLLMSettings,
    updatedAt: new Date().toISOString(),
  };

  projects[index] = updated;
  saveProjects(projects);

  return updated;
}

export function deleteProject(id: string): boolean {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  projects.splice(index, 1);
  saveProjects(projects);

  return true;
}
