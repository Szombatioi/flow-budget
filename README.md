## FlowBudget

This repository contains two implementations:

- `FlowBudget/` — the original ASP.NET Core + Blazor WebAssembly solution (setup below).
- `flowbudget-js/` — the Next.js + NestJS + PostgreSQL implementation. See [flowbudget-js/README.md](flowbudget-js/README.md).

## ASP.NET solution — local dev setup

### Database
```sh
docker compose -f compose-files/db-compose.yaml up -d
```
Or standalone:
```sh
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Password123" \
  -p 1433:1433 \
  --name mssql \
  --hostname mssql \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

### Vault (KMS for envelope encryption)
```sh
docker compose -f compose-files/vault-compose.yaml up -d
```
The `vault-init` sidecar enables the `transit` engine and creates the `flowbudget-kek` key on first startup. Dev root token: `flowbudget-dev-token`. UI: <http://localhost:8200>.

> **Warning:** dev-mode Vault stores keys in memory and re-generates them on every restart. Only for local development.

### Everything at once
```sh
docker compose -f compose-files/db-compose.yaml -f compose-files/vault-compose.yaml up -d
```
