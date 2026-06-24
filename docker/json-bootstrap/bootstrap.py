import json
import os
import re
import ssl
import sys
import time
from pathlib import Path

import pyexasol

IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,127}$")


def env(name, default=None):
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def ident(value):
    if not IDENTIFIER.match(value):
        raise RuntimeError(f"Unsafe SQL identifier: {value!r}")
    return value.upper()


def sql_string(value):
    return "'" + str(value).replace("'", "''") + "'"


def password_literal(value):
    return '"' + str(value).replace('"', '""') + '"'


def connect_with_retry(dsn, user, password, retries=90):
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            return pyexasol.connect(
                dsn=dsn,
                user=user,
                password=password,
                encryption=True,
                websocket_sslopt={"cert_reqs": ssl.CERT_NONE},
            )
        except Exception as exc:  # noqa: BLE001 - startup retry should log any connector error
            last_error = exc
            print(f"Waiting for Exasol ({attempt}/{retries}): {exc}", flush=True)
            time.sleep(2)
    raise RuntimeError(f"Could not connect to Exasol: {last_error}")


def execute_ignore(connection, sql, ignored_fragments):
    try:
        connection.execute(sql)
    except Exception as exc:  # noqa: BLE001 - pyexasol wraps SQL errors by driver version
        message = str(exc).lower()
        if not any(fragment in message for fragment in ignored_fragments):
            raise


def load_rows(sample_path):
    rows = []
    with sample_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            item = json.loads(line)
            rows.append(
                (
                    item["event_id"],
                    item["customer_id"],
                    item["event_type"],
                    float(item.get("amount") or 0),
                    item["event_ts"],
                    json.dumps(item, sort_keys=True),
                    item.get("payload", "{}"),
                )
            )
    return rows


def main():
    host = env("EXASOL_HOST", "exanano")
    port = env("EXASOL_PORT", "8563")
    sys_user = env("EXASOL_SYS_USER", "sys")
    sys_password = env("EXASOL_SYS_PASSWORD", "exasol")
    readonly_user = ident(env("MCP_READONLY_USER", "MCP_READONLY"))
    readonly_password = env("MCP_READONLY_PASSWORD")
    dataset = ident(env("DATASET_NAME", "customer_events"))
    schema = ident(env("ANALYTICS_SCHEMA", "ANALYTICS"))
    sample_path = Path(env("SAMPLE_DATA_PATH", "/app/samples/customer_events.ndjson"))

    connection = connect_with_retry(f"{host}:{port}", sys_user, sys_password)
    print("Connected to Exasol", flush=True)

    execute_ignore(connection, f"CREATE SCHEMA {schema}", ["already exists"])
    execute_ignore(connection, f"CREATE USER {readonly_user} IDENTIFIED BY {password_literal(readonly_password)}", ["already exists", "conflicts with another user or role name"])
    connection.execute(f"ALTER USER {readonly_user} IDENTIFIED BY {password_literal(readonly_password)}")
    connection.execute(f"GRANT CREATE SESSION TO {readonly_user}")

    table = f"{schema}.{dataset}"
    raw_table = f"{schema}.{dataset}_RAW"
    connection.execute(f"DROP TABLE IF EXISTS {table}")
    connection.execute(f"DROP TABLE IF EXISTS {raw_table}")
    connection.execute(
        f"""
        CREATE TABLE {raw_table} (
            EVENT_ID VARCHAR(64),
            CUSTOMER_ID VARCHAR(64),
            EVENT_TYPE VARCHAR(64),
            AMOUNT DECIMAL(18,2),
            EVENT_TS VARCHAR(40),
            RAW_JSON VARCHAR(2000000),
            PAYLOAD_JSON VARCHAR(2000000)
        )
        """
    )

    rows = load_rows(sample_path)
    insert_sql = f"INSERT INTO {raw_table} (EVENT_ID, CUSTOMER_ID, EVENT_TYPE, AMOUNT, EVENT_TS, RAW_JSON, PAYLOAD_JSON) VALUES"
    for row in rows:
        connection.execute(
            f"{insert_sql} ("
            f"{sql_string(row[0])}, "
            f"{sql_string(row[1])}, "
            f"{sql_string(row[2])}, "
            f"{row[3]}, "
            f"{sql_string(row[4])}, "
            f"{sql_string(row[5])}, "
            f"{sql_string(row[6])}"
            f")"
        )
    connection.execute(f"CREATE VIEW {table} AS SELECT * FROM {raw_table}")
    connection.execute(f"GRANT USAGE ON SCHEMA {schema} TO {readonly_user}")
    connection.execute(f"GRANT SELECT ON {raw_table} TO {readonly_user}")
    connection.execute(f"GRANT SELECT ON {table} TO {readonly_user}")

    count = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchval()
    print(f"Bootstrap complete: {table} contains {count} rows", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - container entrypoint should report fatal error
        print(f"Bootstrap failed: {exc}", file=sys.stderr, flush=True)
        raise
