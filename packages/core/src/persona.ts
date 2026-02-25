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
      const duplicates = await repo.findBy({ name: input.name });
      if (duplicates.length > 0) {
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

      await repo.save(persona);
      return persona;
    },

    async get(id: string): Promise<Persona | undefined> {
      return repo.findById(id);
    },

    async getByName(name: string): Promise<Persona | undefined> {
      const results = await repo.findBy({ name });
      return results[0];
    },

    async list(): Promise<Persona[]> {
      return repo.findAll();
    },

    async update(id: string, input: UpdatePersonaInput): Promise<Persona | undefined> {
      const persona = await repo.findById(id);
      if (!persona) return undefined;

      if (input.name) {
        const duplicates = await repo.findBy({ name: input.name });
        if (duplicates.some((p) => p.id !== id)) {
          throw new Error(`Persona with name "${input.name}" already exists`);
        }
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

      await repo.save(updated);
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      return repo.deleteById(id);
    },
  };
}

export type PersonaModule = ReturnType<typeof createPersonaModule>;
