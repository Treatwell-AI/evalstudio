import { readWorkspaceConfig, type StorageConfig } from "./project.js";
import { createFilesystemStorage } from "./filesystem-storage.js";
import type { StorageProvider } from "./storage-provider.js";

/**
 * Resolves a ${VAR} placeholder in the connection string from environment variables.
 * Falls back to EVALSTUDIO_DATABASE_URL if connectionString is not set.
 */
export function resolveConnectionString(storageConfig: { connectionString?: string }): string {
  let connStr = storageConfig.connectionString;

  if (connStr) {
    // Resolve ${VAR} placeholders
    connStr = connStr.replace(/\$\{(\w+)\}/g, (_match, varName) => {
      const value = process.env[varName];
      if (!value) {
        throw new Error(
          `Environment variable ${varName} is not set (referenced in storage.connectionString)`
        );
      }
      return value;
    });
    return connStr;
  }

  // Fallback to EVALSTUDIO_DATABASE_URL env var
  const envUrl = process.env.EVALSTUDIO_DATABASE_URL;
  if (envUrl) return envUrl;

  throw new Error(
    "PostgreSQL connection string not configured.\n" +
    "Set it in evalstudio.config.json under storage.connectionString,\n" +
    "or set the EVALSTUDIO_DATABASE_URL environment variable."
  );
}

/**
 * Creates the appropriate StorageProvider based on workspace config.
 *
 * - When storage.type is "postgres", dynamically imports @evalstudio/postgres.
 *   The package must be installed separately — core has no dependency on it.
 * - When storage is omitted or type is "filesystem", returns FilesystemStorageProvider.
 */
export async function createStorageProvider(workspaceDir: string): Promise<StorageProvider> {
  let storageConfig: StorageConfig | undefined;
  try {
    const config = readWorkspaceConfig(workspaceDir);
    storageConfig = config.storage;
  } catch {
    // No workspace config yet (e.g., during init) — default to filesystem
  }

  if (storageConfig?.type === "postgres") {
    let mod: { createPostgresStorage: (connectionString: string) => Promise<StorageProvider> };
    try {
      // Use a variable so TypeScript doesn't try to resolve the optional package at compile time
      const pgPackage = "@evalstudio/postgres";
      mod = await import(pgPackage);
    } catch {
      throw new Error(
        "PostgreSQL storage requires the @evalstudio/postgres package.\n" +
        "Install it with: npm install @evalstudio/postgres"
      );
    }
    const connectionString = resolveConnectionString(storageConfig);
    console.log("[Storage] Connecting to PostgreSQL...");
    const storage = await mod.createPostgresStorage(connectionString);
    console.log("[Storage] PostgreSQL connected");
    return storage;
  }

  return createFilesystemStorage(workspaceDir);
}
