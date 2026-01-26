import { Command } from "commander";
import {
  createConnector,
  deleteConnector,
  getConnector,
  getConnectorByName,
  getConnectorTypes,
  getProject,
  getProjectByName,
  listConnectors,
  updateConnector,
  type AuthType,
  type ConnectorType,
} from "evalstudio";

function resolveProject(identifier: string) {
  return getProject(identifier) ?? getProjectByName(identifier);
}

const validConnectorTypes: ConnectorType[] = ["http", "langgraph"];
const validAuthTypes: AuthType[] = ["none", "api-key", "bearer", "basic"];

export const connectorCommand = new Command("connector")
  .description("Manage connectors for bridging EvalStudio to external APIs")
  .addCommand(
    new Command("create")
      .description("Create a new connector configuration")
      .argument("<name>", "Connector name")
      .requiredOption("-p, --project <project>", "Project ID or name")
      .requiredOption(
        "--type <type>",
        "Connector type (http or langgraph)"
      )
      .requiredOption("--base-url <url>", "Base URL for the API endpoint")
      .option("--auth-type <authType>", "Authentication type (none, api-key, bearer, basic)")
      .option("--auth-value <value>", "Authentication value (API key, token, or base64 credentials)")
      .option("--config <json>", "Configuration as JSON string (e.g., '{\"assistantId\": \"my-agent\"}' for langgraph)")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: {
            project: string;
            type: string;
            baseUrl: string;
            authType?: string;
            authValue?: string;
            config?: string;
            json?: boolean;
          }
        ) => {
          try {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }

            if (!validConnectorTypes.includes(options.type as ConnectorType)) {
              console.error(
                `Error: Invalid type "${options.type}". Must be one of: ${validConnectorTypes.join(", ")}`
              );
              process.exit(1);
            }

            if (options.authType && !validAuthTypes.includes(options.authType as AuthType)) {
              console.error(
                `Error: Invalid auth type "${options.authType}". Must be one of: ${validAuthTypes.join(", ")}`
              );
              process.exit(1);
            }

            let config: Record<string, unknown> | undefined;
            if (options.config) {
              try {
                config = JSON.parse(options.config);
              } catch {
                console.error(`Error: Invalid JSON in --config`);
                process.exit(1);
              }
            }

            const connector = createConnector({
              projectId: project.id,
              name,
              type: options.type as ConnectorType,
              baseUrl: options.baseUrl,
              authType: options.authType as AuthType | undefined,
              authValue: options.authValue,
              config,
            });

            if (options.json) {
              console.log(JSON.stringify(connector, null, 2));
            } else {
              console.log(`Connector created successfully`);
              console.log(`  ID:       ${connector.id}`);
              console.log(`  Name:     ${connector.name}`);
              console.log(`  Project:  ${project.name}`);
              console.log(`  Type:     ${connector.type}`);
              console.log(`  Base URL: ${connector.baseUrl}`);
              if (connector.authType) {
                console.log(`  Auth:     ${connector.authType}`);
              }
              if (connector.authValue) {
                console.log(`  Auth Val: ${maskValue(connector.authValue)}`);
              }
              if (connector.config) {
                console.log(`  Config:   ${JSON.stringify(connector.config)}`);
              }
              console.log(`  Created:  ${connector.createdAt}`);
            }
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
              process.exit(1);
            }
            throw error;
          }
        }
      )
  )
  .addCommand(
    new Command("list")
      .description("List connector configurations")
      .option("-p, --project <project>", "Filter by project ID or name")
      .option("--json", "Output as JSON")
      .action((options: { project?: string; json?: boolean }) => {
        let projectId: string | undefined;

        if (options.project) {
          const project = resolveProject(options.project);
          if (!project) {
            console.error(`Error: Project "${options.project}" not found`);
            process.exit(1);
          }
          projectId = project.id;
        }

        const connectors = listConnectors(projectId);

        if (options.json) {
          console.log(JSON.stringify(connectors, null, 2));
        } else {
          if (connectors.length === 0) {
            console.log("No connectors found");
            return;
          }

          console.log("Connectors:");
          console.log("-----------");
          for (const connector of connectors) {
            const project = getProject(connector.projectId);
            console.log(`  ${connector.name} (${connector.id})`);
            if (project) {
              console.log(`    Project:  ${project.name}`);
            }
            console.log(`    Type:     ${connector.type}`);
            console.log(`    Base URL: ${connector.baseUrl}`);
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show connector details")
      .argument("<identifier>", "Connector ID")
      .option(
        "-p, --project <project>",
        "Project ID or name (for lookup by name)"
      )
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { project?: string; json?: boolean }
        ) => {
          let connector = getConnector(identifier);

          if (!connector && options.project) {
            const project = resolveProject(options.project);
            if (project) {
              connector = getConnectorByName(project.id, identifier);
            }
          }

          if (!connector) {
            console.error(`Error: Connector "${identifier}" not found`);
            process.exit(1);
          }

          const project = getProject(connector.projectId);

          if (options.json) {
            console.log(JSON.stringify(connector, null, 2));
          } else {
            console.log(`Connector: ${connector.name}`);
            console.log(`-----------`);
            console.log(`  ID:       ${connector.id}`);
            console.log(`  Name:     ${connector.name}`);
            console.log(`  Project:  ${project?.name ?? connector.projectId}`);
            console.log(`  Type:     ${connector.type}`);
            console.log(`  Base URL: ${connector.baseUrl}`);
            if (connector.authType) {
              console.log(`  Auth:     ${connector.authType}`);
            }
            if (connector.authValue) {
              console.log(`  Auth Val: ${maskValue(connector.authValue)}`);
            }
            if (connector.config) {
              console.log(`  Config:   ${JSON.stringify(connector.config)}`);
            }
            console.log(`  Created:  ${connector.createdAt}`);
            console.log(`  Updated:  ${connector.updatedAt}`);
          }
        }
      )
  )
  .addCommand(
    new Command("update")
      .description("Update a connector configuration")
      .argument("<identifier>", "Connector ID")
      .option("-n, --name <name>", "New connector name")
      .option("--type <type>", "New connector type (http or langgraph)")
      .option("--base-url <url>", "New base URL")
      .option("--auth-type <authType>", "New authentication type")
      .option("--auth-value <value>", "New authentication value")
      .option("--config <json>", "New configuration as JSON string")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: {
            name?: string;
            type?: string;
            baseUrl?: string;
            authType?: string;
            authValue?: string;
            config?: string;
            json?: boolean;
          }
        ) => {
          const existing = getConnector(identifier);

          if (!existing) {
            console.error(`Error: Connector "${identifier}" not found`);
            process.exit(1);
          }

          if (
            options.type &&
            !validConnectorTypes.includes(options.type as ConnectorType)
          ) {
            console.error(
              `Error: Invalid type "${options.type}". Must be one of: ${validConnectorTypes.join(", ")}`
            );
            process.exit(1);
          }

          if (
            options.authType &&
            !validAuthTypes.includes(options.authType as AuthType)
          ) {
            console.error(
              `Error: Invalid auth type "${options.authType}". Must be one of: ${validAuthTypes.join(", ")}`
            );
            process.exit(1);
          }

          let config: Record<string, unknown> | undefined;
          if (options.config) {
            try {
              config = JSON.parse(options.config);
            } catch {
              console.error(`Error: Invalid JSON in --config`);
              process.exit(1);
            }
          }

          try {
            const updated = updateConnector(existing.id, {
              name: options.name,
              type: options.type as ConnectorType | undefined,
              baseUrl: options.baseUrl,
              authType: options.authType as AuthType | undefined,
              authValue: options.authValue,
              config,
            });

            if (!updated) {
              console.error(`Error: Failed to update connector`);
              process.exit(1);
            }

            const project = getProject(updated.projectId);

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Connector updated successfully`);
              console.log(`  ID:       ${updated.id}`);
              console.log(`  Name:     ${updated.name}`);
              console.log(`  Project:  ${project?.name ?? updated.projectId}`);
              console.log(`  Type:     ${updated.type}`);
              console.log(`  Base URL: ${updated.baseUrl}`);
              if (updated.authType) {
                console.log(`  Auth:     ${updated.authType}`);
              }
              if (updated.authValue) {
                console.log(`  Auth Val: ${maskValue(updated.authValue)}`);
              }
              if (updated.config) {
                console.log(`  Config:   ${JSON.stringify(updated.config)}`);
              }
              console.log(`  Updated:  ${updated.updatedAt}`);
            }
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
              process.exit(1);
            }
            throw error;
          }
        }
      )
  )
  .addCommand(
    new Command("delete")
      .description("Delete a connector configuration")
      .argument("<identifier>", "Connector ID")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const existing = getConnector(identifier);

        if (!existing) {
          console.error(`Error: Connector "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = deleteConnector(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete connector`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`Connector "${existing.name}" deleted successfully`);
        }
      })
  )
  .addCommand(
    new Command("types")
      .description("List available connector types")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const types = getConnectorTypes();

        if (options.json) {
          console.log(JSON.stringify(types, null, 2));
        } else {
          console.log("Available Connector Types:");
          console.log("--------------------------");
          for (const [type, description] of Object.entries(types)) {
            console.log(`  ${type}`);
            console.log(`    ${description}`);
          }
        }
      })
  );

function maskValue(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
