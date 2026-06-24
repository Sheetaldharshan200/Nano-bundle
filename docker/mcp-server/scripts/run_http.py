import logging
import os
import sys
import warnings

EXPECTED_NO_AUTH_WARNING = "The server has started without authentication."


class ExpectedLocalWarningFilter(logging.Filter):
    def filter(self, record):
        return EXPECTED_NO_AUTH_WARNING not in record.getMessage()


def configure_noise_filters():
    logging.getLogger().addFilter(ExpectedLocalWarningFilter())
    warnings.filterwarnings(
        "ignore",
        message='Field name "schema" in "QualifiedDBObject" shadows an attribute in parent "DBObject"',
        category=UserWarning,
        module="exasol.ai.mcp.server.tools.schema.db_output_schema",
    )


def main():
    configure_noise_filters()
    from exasol.ai.mcp.server.main import main_http

    try:
        port = int(os.getenv("MCP_PORT", "7766"))
    except ValueError as exc:
        raise RuntimeError("MCP_PORT must be an integer") from exc

    callback = main_http.callback
    callback(
        transport=os.getenv("MCP_TRANSPORT", "http"),
        host=os.getenv("MCP_HOST", "0.0.0.0"),
        port=port,
        no_auth=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - container entrypoint should fail loudly
        print(f"MCP server failed: {exc}", file=sys.stderr, flush=True)
        raise