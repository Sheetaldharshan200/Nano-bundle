export function renderMcpSettings() {
  return {
    enable_read_query: true,
    enable_write_query: false,
    enable_summarize_table: false,
    enable_query_profiling: false,
    enable_read_bucketfs: false,
    enable_write_bucketfs: false,
    schemas: {
      like_pattern: "ANALYTICS"
    },
    views: {
      enable: true
    },
    functions: {
      enable: false
    },
    scripts: {
      enable: false
    },
    language: "english"
  };
}

export function renderCompose(config, manifest) {
  return `name: exasol-json-mcp
services:
  exanano:
    image: ${config.exasolNanoImage || manifest.versions.exasolNanoImage}
    shm_size: "512m"
    ports:
      - "${config.sqlHost}:${config.sqlPort}:8563"
    environment:
      EXASOL_PASSWORD: "${escapeYaml(config.sysPassword)}"
    volumes:
      - exa-data:/exa

  json-bootstrap:
    image: ${manifest.versions.jsonBootstrapImage}
    depends_on:
      exanano:
        condition: service_started
    environment:
      EXASOL_HOST: exanano
      EXASOL_PORT: "8563"
      EXASOL_SYS_USER: sys
      EXASOL_SYS_PASSWORD: "${escapeYaml(config.sysPassword)}"
      MCP_READONLY_USER: "${escapeYaml(config.mcpReadonlyUser)}"
      MCP_READONLY_PASSWORD: "${escapeYaml(config.mcpReadonlyPassword)}"
      DATASET_NAME: "${escapeYaml(config.datasetName)}"
      USE_SAMPLE_DATA: "${escapeYaml(config.useSampleData)}"

  mcp-server:
    image: ${manifest.versions.mcpServerImage}
    depends_on:
      json-bootstrap:
        condition: service_completed_successfully
    ports:
      - "${config.mcpHost}:${config.mcpPort}:7766"
    environment:
      EXASOL_HOST: exanano
      EXASOL_PORT: "8563"
      EXASOL_USER: "${escapeYaml(config.mcpReadonlyUser)}"
      EXASOL_PASSWORD: "${escapeYaml(config.mcpReadonlyPassword)}"
      EXA_MCP_SETTINGS: /app/settings.json
      EXA_SSL_CERT_VALIDATION: "no"
    volumes:
      - ./mcp/settings.json:/app/settings.json:ro

volumes:
  exa-data:
`;
}

export function renderMcpClientConfig(config) {
  return JSON.stringify({
    mcpServers: {
      exasol_nano: {
        url: `http://localhost:${config.mcpPort}/mcp`
      }
    }
  }, null, 2);
}

export function renderFirstPrompt(config) {
  const table = config.datasetName.toUpperCase();
  return `Use the connected Exasol MCP server. List available schemas, describe ANALYTICS.${table}, then run SELECT COUNT(*) FROM ANALYTICS.${table}.`;
}

export function renderReadyOutput(config) {
  return `Ready.\n\nExasol SQL:\n  Host: ${config.sqlHost}\n  Port: ${config.sqlPort}\n\nMCP Server:\n  URL: http://localhost:${config.mcpPort}/mcp\n\nAdd this MCP config to your AI client:\n\n${renderMcpClientConfig(config)}\n\nPaste this first prompt into your AI client:\n\n${renderFirstPrompt(config)}\n\nAfter your AI client responds, return here and type:\n  completed\n\nTo close without testing, type:\n  exit\n`;
}

function escapeYaml(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

