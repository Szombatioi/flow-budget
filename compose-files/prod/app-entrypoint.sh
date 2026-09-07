#!/bin/sh
# Loads Vault AppRole credentials from the shared secrets volume (written by vault-bootstrap),
# then execs the FlowBudget app. Fails fast if credentials are missing.
set -eu

APPROLE_FILE="/vault/secrets/approle.env"

echo "[entrypoint] Waiting for Vault AppRole credentials at $APPROLE_FILE..."
for i in $(seq 1 60); do
  if [ -s "$APPROLE_FILE" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "$APPROLE_FILE" ]; then
  echo "[entrypoint] ERROR: $APPROLE_FILE was never populated by vault-bootstrap." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$APPROLE_FILE"
set +a

echo "[entrypoint] Vault AppRole loaded (RoleId=${Kms__RoleId%????????????}...)."
exec dotnet FlowBudget.dll
