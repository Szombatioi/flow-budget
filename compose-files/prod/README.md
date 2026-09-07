# FlowBudget — production deploy runbook

Single-node Docker deployment: SQL Server + Vault (envelope encryption) + FlowBudget app + a one-shot Vault bootstrap sidecar. Migrations apply automatically on app startup; the admin user is seeded on first boot.

## First-time setup

```sh
# 1. Clone
git clone <repo> flow-budget
cd flow-budget

# 2. Configure secrets
cp compose-files/prod/env.example .env
$EDITOR .env      # fill in PUBLIC_BASE_URL, SQL_SA_PASSWORD, ADMIN_PASSWORD (at minimum)

# 3. Build + start everything
docker compose -f docker-compose.prod.yml up -d --build
```

That's it. Watch the logs:

```sh
docker compose -f docker-compose.prod.yml logs -f flowbudget
```

Expected sequence:
1. `flowbudget_vault` — server starts, seals itself (first boot has no data).
2. `flowbudget_vault_bootstrap` — inits Vault, unseals, enables `transit`, creates `flowbudget-kek`, provisions AppRole. Exits with code 0. **Its output volume now contains the unseal key and root token** (`vault-secrets:/vault/secrets/init.json`).
3. `flowbudget_db` — SQL Server healthchecks pass.
4. `flowbudget_app` — reads AppRole credentials from the shared volume, migrates the DB, seeds admin, starts Kestrel on `:5288`.

Open `${PUBLIC_BASE_URL}` and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Restarts

`docker compose ... up -d` again re-runs `vault-bootstrap`. It's idempotent: detects the existing init file, unseals from it, keeps the existing AppRole. The app picks the same `Kms__RoleId` / `Kms__SecretId` back up and continues where it left off. **No data loss on restart.**

## Where the sensitive material lives

| Secret | Location | Notes |
|---|---|---|
| Vault unseal key + root token | `vault-secrets` volume → `/vault/secrets/init.json` | Owned by the Vault container. If the host is compromised, so is Vault. Move this file off-host for a real production posture (see "Hardening"). |
| Vault storage (wrapped DEKs never leave here decrypted) | `vault-data` volume → `/vault/file` | Backing store for KEK material. |
| AppRole role_id + secret_id | `vault-secrets` volume → `/vault/secrets/approle.env` | Mounted read-only into the app container. |
| SQL data | `sqldata` volume | Contains ciphertext for `Expenditure.NameEnc`, `Expenditure.DescriptionEnc`, `ApplicationUser.ApiKeyEnc` — unreadable without Vault. |
| App logs | `flowbudget-logs` volume | Serilog rolls daily, keeps 30. |

## TLS

The app image bakes a self-signed cert (`/app/certs/aspnetapp.pfx`, password from `CERT_PASSWORD`). Browsers warn on it. Two real options:

**A. Put a reverse proxy (Caddy / nginx / Traefik) in front.** Bind the app to `127.0.0.1:5288`, terminate TLS at the proxy with Let's Encrypt.

**B. Replace the baked cert.** Mount your own PFX at `/app/certs/aspnetapp.pfx` and set `CERT_PASSWORD`.

## Operations

**Verify encryption is actually engaged:**
```sh
docker exec -it flowbudget_db /opt/mssql-tools*/bin/sqlcmd \
  -S localhost -U sa -P "$SQL_SA_PASSWORD" -d flow-budget \
  -Q "SELECT TOP 5 Id, DATALENGTH(NameEnc) AS n, DATALENGTH(DescriptionEnc) AS d FROM Expenditures"
```
Every row should show non-null byte counts. Try to read the raw column and confirm it's a `varbinary(max)` blob, not readable text.

**Rotate the DEK for a user (advanced):** unwrap current W-DEK, generate new DEK, re-encrypt all their rows in a transaction, wrap new DEK, save. Not automated yet — see the plan file's KEK rotation notes.

**Reset the admin password:** stop the app, `docker exec flowbudget_db sqlcmd` a `UPDATE AspNetUsers SET PasswordHash=NULL ...` etc. — or just wipe the admin user; the seeder recreates it on next boot with the new `ADMIN_PASSWORD` from `.env`.

## Hardening (beyond a school-project deployment)

- Move `/vault/secrets/init.json` off-host after first boot; unseal manually on every restart (drop the auto-unseal from `vault-bootstrap.sh`).
- Or wire up cloud KMS auto-unseal (AWS/Azure/GCP) — Vault's built-in feature.
- Run Vault as HA on 3+ nodes with the `raft` storage backend.
- Rotate `secret_id` on a schedule and stream it to the app via `vault agent` rather than the shared volume.
- Bind SQL Server to the internal network only; use a proper DB user with least-privilege permissions (not `sa`).
- Turn on Vault audit logging to a file volume for forensics.

## Troubleshooting

**App crashes with "Kms auth is not configured".** The `vault-bootstrap` sidecar didn't complete or didn't write `approle.env`. `docker compose logs vault-bootstrap`.

**App crashes with `SqlException: A network-related or instance-specific error`.** SQL container isn't up. `docker compose logs sqledge`. Usually the SA password doesn't meet complexity requirements — needs upper + lower + digit and ≥ 8 chars.

**"Vault sealed" in bootstrap logs.** The bootstrap is unsealing it — should recover in a few seconds. If it persists, the `init.json` was deleted or corrupted; you'd need to `docker volume rm flow-budget_vault-data flow-budget_vault-secrets` (⚠️ this deletes the KEK — all encrypted user data becomes unreadable) and start fresh.

**Change `PUBLIC_BASE_URL` after deploy.** Edit `.env`, `docker compose -f docker-compose.prod.yml up -d flowbudget` to recreate just the app container.
