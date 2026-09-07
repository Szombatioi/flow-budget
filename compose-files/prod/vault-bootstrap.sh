#!/bin/sh
# Idempotent Vault bootstrap for the FlowBudget deployment.
#
# On first run:  init the Vault, save unseal keys + root token to /vault/secrets/init.json,
#                unseal, enable transit + kek, create flowbudget policy + AppRole,
#                write role_id + secret_id to /vault/secrets/approle.env.
# On restarts:   detect existing init, unseal from saved keys, verify AppRole role_id,
#                rotate secret_id if the app's file is missing.
#
# SECURITY: init.json contains the unseal keys AND the root token. It lives on the same
# host as the Vault storage — this is a single-node school-project trade-off. For real
# production, move init.json off-host after first boot and use manual unseal.

set -eu

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
SECRETS_DIR="/vault/secrets"
INIT_FILE="$SECRETS_DIR/init.json"
APPROLE_ENV="$SECRETS_DIR/approle.env"
POLICY_FILE="/vault/config/flowbudget-policy.hcl"
KEY_NAME="flowbudget-kek"
ROLE_NAME="flowbudget"

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

echo "[bootstrap] Waiting for Vault to accept requests..."
for i in $(seq 1 60); do
  if wget -q -O - "$VAULT_ADDR/v1/sys/health?standbyok=true&sealedcode=200&uninitcode=200" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

status_json=$(wget -q -O - "$VAULT_ADDR/v1/sys/seal-status")
initialized=$(echo "$status_json" | grep -o '"initialized":[a-z]*' | cut -d: -f2)

if [ "$initialized" != "true" ]; then
  echo "[bootstrap] Vault not initialized — initializing (1 unseal key, threshold 1)."
  vault operator init -key-shares=1 -key-threshold=1 -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
fi

UNSEAL_KEY=$(grep -o '"unseal_keys_b64":\[[^]]*\]' "$INIT_FILE" | sed 's/.*\["\([^"]*\)".*/\1/')
ROOT_TOKEN=$(grep -o '"root_token":"[^"]*"' "$INIT_FILE" | sed 's/.*:"\([^"]*\)"/\1/')

sealed=$(echo "$status_json" | grep -o '"sealed":[a-z]*' | cut -d: -f2)
if [ "$sealed" = "true" ] || [ "$initialized" != "true" ]; then
  echo "[bootstrap] Unsealing Vault."
  vault operator unseal "$UNSEAL_KEY" >/dev/null
fi

export VAULT_TOKEN="$ROOT_TOKEN"

# Wait until unsealed and unsealed status can be queried
for i in $(seq 1 30); do
  if vault status >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[bootstrap] Ensuring transit engine..."
if ! vault secrets list -format=json | grep -q '"transit/"'; then
  vault secrets enable -path=transit transit
fi

echo "[bootstrap] Ensuring KEK '$KEY_NAME'..."
if ! vault read "transit/keys/$KEY_NAME" >/dev/null 2>&1; then
  vault write -f "transit/keys/$KEY_NAME"
fi

echo "[bootstrap] Ensuring flowbudget policy..."
vault policy write flowbudget "$POLICY_FILE"

echo "[bootstrap] Ensuring AppRole auth..."
if ! vault auth list -format=json | grep -q '"approle/"'; then
  vault auth enable approle
fi

vault write "auth/approle/role/$ROLE_NAME" \
  token_policies="flowbudget" \
  token_ttl=1h \
  token_max_ttl=24h \
  secret_id_ttl=0 \
  secret_id_num_uses=0 \
  > /dev/null

ROLE_ID=$(vault read -field=role_id "auth/approle/role/$ROLE_NAME/role-id")

# (Re)issue a secret_id if the app's env file is missing (fresh volume) or empty.
if [ ! -s "$APPROLE_ENV" ]; then
  SECRET_ID=$(vault write -f -field=secret_id "auth/approle/role/$ROLE_NAME/secret-id")
  cat > "$APPROLE_ENV" <<EOF
Kms__RoleId=$ROLE_ID
Kms__SecretId=$SECRET_ID
EOF
  chmod 600 "$APPROLE_ENV"
  echo "[bootstrap] Issued a fresh secret_id and wrote $APPROLE_ENV"
else
  # Keep role_id in sync (secret_id we leave alone unless the file was missing).
  if ! grep -q "Kms__RoleId=$ROLE_ID" "$APPROLE_ENV"; then
    sed -i "s|^Kms__RoleId=.*|Kms__RoleId=$ROLE_ID|" "$APPROLE_ENV"
  fi
  echo "[bootstrap] Existing approle.env preserved."
fi

echo "[bootstrap] Done."
