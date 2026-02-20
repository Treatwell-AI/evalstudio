import { Command } from "commander";
import {
  resolveWorkspace,
  readWorkspaceConfig,
  resolveConnectionString,
  type StorageProvider,
} from "@evalstudio/core";

export const dbCommand = new Command("db")
  .description("Database management commands");

/**
 * Resolves the PostgreSQL connection string from (in order):
 * 1. --connection-string CLI option
 * 2. Workspace config (evalstudio.config.json)
 * 3. EVALSTUDIO_DATABASE_URL env var
 */
function resolveDbConnectionString(optionValue?: string): string {
  if (optionValue) return optionValue;

  // Try workspace config
  try {
    const workspaceDir = resolveWorkspace();
    const config = readWorkspaceConfig(workspaceDir);
    if (config.storage?.type === "postgres") {
      return resolveConnectionString(config.storage);
    }
  } catch {
    // No workspace found — fall through to env var
  }

  const envUrl = process.env.EVALSTUDIO_DATABASE_URL;
  if (envUrl) return envUrl;

  console.error(
    "No PostgreSQL connection string found.\n\n" +
    "Provide one via:\n" +
    "  --connection-string <url>\n" +
    "  EVALSTUDIO_DATABASE_URL environment variable\n" +
    "  storage.connectionString in evalstudio.config.json"
  );
  process.exit(1);
}

dbCommand
  .command("init")
  .description("Create PostgreSQL tables and a default project if none exist")
  .option("-c, --connection-string <url>", "PostgreSQL connection string")
  .action(async (options: { connectionString?: string }) => {
    const connectionString = resolveDbConnectionString(options.connectionString);

    let initSchema: (connectionString: string) => Promise<void>;
    let createPostgresStorage: (connectionString: string) => Promise<StorageProvider>;
    try {
      const pgPackage = "@evalstudio/postgres";
      const mod = await import(pgPackage);
      initSchema = mod.initSchema;
      createPostgresStorage = mod.createPostgresStorage;
    } catch {
      console.error(
        "PostgreSQL storage requires the @evalstudio/postgres package.\n" +
        "Install it with: npm install @evalstudio/postgres"
      );
      process.exit(1);
    }

    console.log("Initializing database...");
    await initSchema(connectionString);
    console.log("Database ready.");

    const storage = await createPostgresStorage(connectionString);
    const projects = await storage.listProjects();

    if (projects.length === 0) {
      const project = await storage.createProject("default");
      console.log(`Created default project: ${project.name} (${project.id.slice(0, 8)})`);
    } else {
      console.log(`Found ${projects.length} existing project(s).`);
    }
  });

dbCommand
  .command("status")
  .description("Show applied and pending database migrations")
  .option("-c, --connection-string <url>", "PostgreSQL connection string")
  .action(async (options: { connectionString?: string }) => {
    const connectionString = resolveDbConnectionString(options.connectionString);

    let getMigrationStatus: (connectionString: string) => Promise<{ applied: Array<{ version: number; name: string; appliedAt: Date }>; pending: Array<{ version: number; name: string }> }>;
    try {
      const pgPackage = "@evalstudio/postgres";
      const mod = await import(pgPackage);
      getMigrationStatus = mod.getMigrationStatus;
    } catch {
      console.error(
        "PostgreSQL storage requires the @evalstudio/postgres package.\n" +
        "Install it with: npm install @evalstudio/postgres"
      );
      process.exit(1);
    }

    const status = await getMigrationStatus(connectionString);

    if (status.applied.length > 0) {
      console.log("Applied migrations:");
      for (const m of status.applied) {
        const date = new Date(m.appliedAt).toISOString();
        console.log(`  ${m.name}  (applied ${date})`);
      }
    } else {
      console.log("No migrations applied yet.");
    }

    if (status.pending.length > 0) {
      console.log("\nPending migrations:");
      for (const m of status.pending) {
        console.log(`  ${m.name}  (not yet applied)`);
      }
    }
  });
