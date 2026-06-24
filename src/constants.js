export const COMMANDS = [
  "start",
  "stop",
  "status",
  "configure",
  "logs",
  "smoke-test",
  "update",
  "rollback",
  "reset",
  "print-mcp-config",
  "install-client-config",
  "autostart",
  "doctor"
];

export const DEFAULTS = Object.freeze({
  sysPassword: "exasol",
  sqlHost: "127.0.0.1",
  sqlPort: "8563",
  mcpHost: "127.0.0.1",
  mcpPort: "7766",
  datasetName: "customer_events",
  useSampleData: "true",
  mcpReadonlyUser: "MCP_READONLY"
});

export const ENV_KEYS = Object.freeze({
  exasolNanoImage: "EXASOL_NANO_IMAGE",
  sysPassword: "EXASOL_SYS_PASSWORD",
  mcpReadonlyPassword: "MCP_READONLY_PASSWORD",
  sqlHost: "EXASOL_SQL_HOST",
  sqlPort: "EXASOL_SQL_PORT",
  mcpHost: "MCP_HOST",
  mcpPort: "MCP_PORT",
  datasetName: "DATASET_NAME",
  useSampleData: "USE_SAMPLE_DATA",
  mcpReadonlyUser: "MCP_READONLY_USER"
});

export const SERVICES = Object.freeze({
  database: "exanano",
  bootstrap: "json-bootstrap",
  mcp: "mcp-server"
});

export const RESET_CONFIRMATION = "delete-local-exasol-json-mcp";
