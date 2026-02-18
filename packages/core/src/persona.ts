import { randomUUID } from "node:crypto";
import { createJsonRepository, type Repository } from "./repository.js";
import type { ProjectContext } from "./project-resolver.js";

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

export function createPersonaModule(ctx: ProjectContext) {
  const repo: Repository<Persona> = createJsonRepository<Persona>("personas.json", ctx.dataDir);

  return {
    create(input: CreatePersonaInput): Persona {
      const personas = repo.findAll();

      if (personas.some((p) => p.name === input.name)) {
        throw new Error(`Persona with name "${input.name}" already exists`);
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
      repo.saveAll(personas);

      return persona;
    },

    get(id: string): Persona | undefined {
      return repo.findAll().find((p) => p.id === id);
    },

    getByName(name: string): Persona | undefined {
      return repo.findAll().find((p) => p.name === name);
    },

    list(): Persona[] {
      return repo.findAll();
    },

    update(id: string, input: UpdatePersonaInput): Persona | undefined {
      const personas = repo.findAll();
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
        updatedAt: new Date().toISOString(),
      };

      personas[index] = updated;
      repo.saveAll(personas);

      return updated;
    },

    delete(id: string): boolean {
      const personas = repo.findAll();
      const index = personas.findIndex((p) => p.id === id);

      if (index === -1) {
        return false;
      }

      personas.splice(index, 1);
      repo.saveAll(personas);

      return true;
    },
  };
}

export type PersonaModule = ReturnType<typeof createPersonaModule>;
