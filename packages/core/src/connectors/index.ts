/**
 * Connector implementations
 *
 * This directory contains the strategy implementations for each connector type.
 * Each connector is responsible for:
 * - Building test and invoke requests
 * - Parsing responses from the target system
 *
 * To add a new connector type:
 * 1. Create a new file in this directory (e.g., myconnector.ts)
 * 2. Implement the ConnectorStrategy interface
 * 3. Export the strategy
 * 4. Add it to the connectorStrategies registry in connector.ts
 */

export type { ConnectorStrategy, ConnectorRequestConfig, ConnectorResponseMetadata } from "./base.js";
export { buildRequestHeaders } from "./base.js";
export { langGraphStrategy } from "./langgraph.js";
