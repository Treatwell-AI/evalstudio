import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";

export interface Persona {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  /** Relative path to the persona's generated image (e.g. "images/personas/{id}.png") */
  imageUrl?: string;
  /** HTTP headers to merge with connector headers when making requests (persona headers take precedence) */
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  headers?: Record<string, string>;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  imageUrl?: string;
  headers?: Record<string, string>;
}

export function createPersonaModule(repo: Repository<Persona>) {
  return {
    async create(input: CreatePersonaInput): Promise<Persona> {
      const personas = await repo.findAll();

      if (personas.some((p) => p.name === input.name)) {
        throw new Error(`Persona with name "${input.name}" already exists`);
      }

      const now = new Date().toISOString();
      const persona: Persona = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        systemPrompt: input.systemPrompt,
        headers: input.headers,
        createdAt: now,
        updatedAt: now,
      };

      personas.push(persona);
      await repo.saveAll(personas);

      return persona;
    },

    async get(id: string): Promise<Persona | undefined> {
      return (await repo.findAll()).find((p) => p.id === id);
    },

    async getByName(name: string): Promise<Persona | undefined> {
      return (await repo.findAll()).find((p) => p.name === name);
    },

    async list(): Promise<Persona[]> {
      return repo.findAll();
    },

    async update(id: string, input: UpdatePersonaInput): Promise<Persona | undefined> {
      const personas = await repo.findAll();
      const index = personas.findIndex((p) => p.id === id);

      if (index === -1) {
        return undefined;
      }

      const persona = personas[index];

      if (
        input.name &&
        personas.some((p) => p.name === input.name && p.id !== id)
      ) {
        throw new Error(`Persona with name "${input.name}" already exists`);
      }

      const updated: Persona = {
        ...persona,
        name: input.name ?? persona.name,
        description: input.description ?? persona.description,
        systemPrompt: input.systemPrompt ?? persona.systemPrompt,
        imageUrl: input.imageUrl ?? persona.imageUrl,
        headers: input.headers !== undefined ? input.headers : persona.headers,
        updatedAt: new Date().toISOString(),
      };

      personas[index] = updated;
      await repo.saveAll(personas);

      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const personas = await repo.findAll();
      const index = personas.findIndex((p) => p.id === id);

      if (index === -1) {
        return false;
      }

      personas.splice(index, 1);
      await repo.saveAll(personas);

      return true;
    },
  };
}

export type PersonaModule = ReturnType<typeof createPersonaModule>;
