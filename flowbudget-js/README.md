# FlowBudget — Next.js + NestJS

A TypeScript re-implementation of FlowBudget: a pocket-based daily budgeting app. The backend follows the
ASP.NET solution (`../FlowBudget/FlowBudget/FlowBudget`), the frontend follows the Blazor client
(`../FlowBudget/FlowBudget/FlowBudget.Client`).

| Part       | Stack                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| `frontend` | Next.js 16 (App Router), React 19, MUI 9 + MUI X (charts, date pickers), next-intl (en, hu), TanStack Query |
| `backend`  | NestJS 12, TypeORM 1.x, PostgreSQL, Better Auth (self-hosted auth), ExcelJS                      |

## How it works

- **Budget model** — an account's _distributable money_ (incomes − fixed expenses) is split between the pockets of
  the active _division plan_ by ratio, then evenly across the days of the month. Each day starts with its share plus
  the previous day's leftover (or overspending); the chain restarts every month.
- **Versioning** — changing an income, fixed expense or pocket ratio creates a new version effective from a chosen
  month, so past months keep their numbers. Deleting ends the lineage from the current month instead of rewriting
  history.
- **Authentication** — [Better Auth](https://better-auth.com) runs inside the NestJS backend (`/api/auth/*`) and stores
  users and sessions in the same PostgreSQL database (`auth_*` tables). The login and register pages are part of the
  Next.js app. The Next.js proxy (`src/proxy.ts`) forwards `/api/*` to the backend, so the session cookie is
  first-party and the backend URL can be changed at runtime.
- **Encryption at rest** — expenditure names/descriptions and the user's Gemini API key are encrypted with AES-256-GCM
  using a per-user data key, which is wrapped by a key-encryption key from the environment (`KMS_PROVIDER=local`) or
  HashiCorp Vault Transit (`KMS_PROVIDER=vault`).
- **Receipt scanning** — users can store their own Google Gemini API key in Settings and let the model extract the
  items of a receipt photo.

## Running with Docker

```sh
cp .env.example .env   # then set POSTGRES_PASSWORD, BETTER_AUTH_SECRET and KMS_LOCAL_KEYS
docker compose up --build
```

The app is served on <http://localhost:3000>. Database migrations (both Better Auth's and TypeORM's) run automatically
when the backend starts; currencies and the default categories are seeded.

## Local development

Requirements: Node.js 22.13+ and PostgreSQL 14+.

```sh
# backend (http://localhost:3001)
cd backend
cp .env.example .env   # point DATABASE_URL at your database
npm install
npm run start:dev

# frontend (http://localhost:3000), in another terminal
cd frontend
npm install
npm run dev            # BACKEND_URL defaults to http://localhost:3001
```

### Environment variables

Backend (see `.env.example` for details):

| Variable                                     | Description                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_SSL`               | PostgreSQL connection                                                      |
| `PORT`                                       | HTTP port (default `3001`)                                                 |
| `BETTER_AUTH_URL`                            | Public URL of the frontend (cookies and CSRF checks are bound to it)       |
| `BETTER_AUTH_SECRET`                         | ≥ 32 random characters                                                     |
| `TRUSTED_ORIGINS`                            | Extra allowed origins, comma separated                                     |
| `MIN_PASSWORD_LENGTH`                        | Default `8`                                                                |
| `KMS_PROVIDER`                               | `local` or `vault`                                                         |
| `KMS_LOCAL_KEYS`, `KMS_CURRENT_KEY_VERSION`  | `1:<base64 32-byte key>,2:...` and the version used for new users          |
| `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_KEY_NAME`| Vault Transit settings                                                     |
| `GEMINI_MODEL`, `GEMINI_API_BASE`            | Receipt scanning model / endpoint                                          |
| `UPLOAD_MAX_BYTES`                           | Receipt upload limit (default 10 MB)                                       |
| `TZ`                                         | Timezone used to decide what "today" is                                    |

Frontend: `BACKEND_URL` (where the proxy forwards `/api/*`, read at runtime).

### Database migrations

```sh
cd backend
npm run migration:generate -- src/database/migrations/<Name>   # after changing entities
npm run migration:run
```

## Tests

```sh
cd backend
npm test            # unit tests (dates, versioning)
npm run test:e2e    # API end-to-end test; needs the backend running and DATABASE_URL set
```

## API overview

All endpoints except `/health*` and `/api/auth/*` require a session.

| Area            | Endpoints                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| User            | `GET /api/user`, `PUT /api/user/{profile,password,preferences,api-key}`, `POST /api/user/api-key/reveal`     |
| Accounts        | `GET/POST /api/accounts`, `PUT/DELETE /api/accounts/:id`, `GET /api/currencies`                             |
| Categories      | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id`                                                |
| Incomes & fixed | `GET /api/{incomes,fixed-expenses}/:accountId`, `POST /api/{incomes,fixed-expenses}`, `PUT/DELETE .../:id`  |
| Plans           | `GET /api/plans/:accountId`, `GET /api/plans/:accountId/effective?date=`, `POST /api/plans`, `PUT/DELETE /api/plans/:id`, `POST /api/plans/:id/activate` |
| Pockets         | `GET/POST /api/pockets/:planId`, `PUT /api/pockets/:id`, `DELETE /api/pockets/:id?targetPocketId=`          |
| Daily budgets   | `GET /api/daily-expenses/:pocketId?date=`, `.../time-series`, `.../budget-series`, `.../in-range`, `POST .../receipt` |
| Expenditures    | `GET /api/expenditures` (filters + paging), `POST /api/expenditures` (batch), `PUT/DELETE /api/expenditures/:id`, `GET /api/expenditures/stats`, `POST /api/expenditures/export` |
| Wishlists       | `GET/POST /api/wishlists`, `GET/DELETE /api/wishlists/:id`, `POST /api/wishlists/:id/{activate,deactivate,move}`, `POST /api/wishlists/:id/align/:dayId`, `DELETE /api/wishlists/align/:dayId` |
| Health          | `GET /health`, `GET /health/ready`                                                                          |

Errors are returned as `{ "error": "<code>", "message": "..." }`; the codes double as translation keys in the frontend.
