import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorageDir } from "./storage.js";

export interface Persona {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  name: string;
  description?: string;
  systemPrompt?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
}

function getStoragePath(): string {
  return join(getStorageDir(), "personas.json");
}

function loadPersonas(): Persona[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as Persona[];
}

function savePersonas(personas: Persona[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(personas, null, 2));
}

export function createPersona(input: CreatePersonaInput): Persona {
  const personas = loadPersonas();

  if (personas.some((p) => p.name === input.name)) {
    throw new Error(
      `Persona with name "${input.name}" already exists`
    );
  }

  const now = new Date().toISOString();
  const persona: Persona = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt,
    createdAt: now,
    updatedAt: now,
  };

  personas.push(persona);
  savePersonas(personas);

  return persona;
}

export function getPersona(id: string): Persona | undefined {
  const personas = loadPersonas();
  return personas.find((p) => p.id === id);
}

export function getPersonaByName(name: string): Persona | undefined {
  const personas = loadPersonas();
  return personas.find((p) => p.name === name);
}

export function listPersonas(): Persona[] {
  return loadPersonas();
}

export function updatePersona(
  id: string,
  input: UpdatePersonaInput
): Persona | undefined {
  const personas = loadPersonas();
  const index = personas.findIndex((p) => p.id === id);

  if (index === -1) {
    return undefined;
  }

  const persona = personas[index];

  if (
    input.name &&
    personas.some((p) => p.name === input.name && p.id !== id)
  ) {
    throw new Error(
      `Persona with name "${input.name}" already exists`
    );
  }

  const updated: Persona = {
    ...persona,
    name: input.name ?? persona.name,
    description: input.description ?? persona.description,
    systemPrompt: input.systemPrompt ?? persona.systemPrompt,
    updatedAt: new Date().toISOString(),
  };

  personas[index] = updated;
  savePersonas(personas);

  return updated;
}

export function deletePersona(id: string): boolean {
  const personas = loadPersonas();
  const index = personas.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  personas.splice(index, 1);
  savePersonas(personas);

  return true;
}
