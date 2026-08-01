#!/bin/sh
set -eu

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

psql \
  --host=postgres \
  --username="${POSTGRES_USER:?POSTGRES_USER is required}" \
  --dbname="${POSTGRES_DB:?POSTGRES_DB is required}" \
  --set=ON_ERROR_STOP=1 \
  --command='CREATE SCHEMA IF NOT EXISTS n8n;'
