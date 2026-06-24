#!/bin/sh
set -eu

: "${EXASOL_HOST:=exanano}"
: "${EXASOL_PORT:=8563}"
: "${EXASOL_USER:?EXASOL_USER is required}"
: "${EXASOL_PASSWORD:?EXASOL_PASSWORD is required}"
: "${MCP_HOST:=0.0.0.0}"
: "${MCP_PORT:=7766}"
: "${EXA_SSL_CERT_VALIDATION:=no}"

export EXA_DSN="${EXASOL_HOST}:${EXASOL_PORT}"
export EXA_USER="${EXASOL_USER}"
export EXA_PASSWORD="${EXASOL_PASSWORD}"

export EXA_SSL_CERT_VALIDATION

exec python /app/run_http.py
