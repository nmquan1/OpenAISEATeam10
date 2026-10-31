# Deploy the shared-workspace MVP

This guide prepares **Cloudflare Pages frontend + Render API + Supabase database**. The app has no login: every visitor can read the same run history and use the same AI allowance. The deployment below is an MVP/demo configuration, not a service with private customer workspaces.

No live cloud deployment, database migration or OpenAI request was performed as part of the implementation checks. Values below are placeholders; create/configure the services before substituting real values. Infrastructure free tiers do not make OpenAI inference free.

## 1. Prepare the database

Create a Supabase project. Supabase is used only for PostgreSQL/REST storage; do not configure application login, sessions, email redirects or frontend Supabase credentials.

In the SQL editor, review and apply [`backend/src/store/supabase.sql`](../backend/src/store/supabase.sql). It creates shared run snapshots and a UTC daily AI-attempt counter. RLS is enabled, anon/authenticated access is revoked, and the quota function is executable only by `service_role`. The server uses its service-role key; browser clients access data through the API.

Use a fresh schema for this migration. If an earlier experimental version created tables with `user_id` or `auth.users` references, `CREATE TABLE IF NOT EXISTS` will not convert them: back up and review a separate migration before applying this shared-workspace design. The script does not delete old data.

Keep these two values for the **backend environment only**:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
RUN_STORE=supabase
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to frontend/Pages variables, a `VITE_` variable, Git or screenshots. The app makes no Supabase calls from the browser and needs no public anon key.

## 2. Configure the Render API

Create a Render Web Service from this repository, with the repository root as its root directory. Use the checked-in `render.yaml`/Dockerfile when available, or the equivalent Node configuration:

| Setting       | Value                                  |
| ------------- | -------------------------------------- |
| Runtime       | Node 22 or the repository Docker image |
| Build command | `npm ci && npm run build`              |
| Start command | `npm start`                            |
| Health path   | `/api/health`                          |

Set backend environment variables, replacing hostnames with the actual allocated domains:

```dotenv
HOST=0.0.0.0
ALLOWED_HOSTS=<api-name>.onrender.com,localhost,127.0.0.1
ALLOWED_ORIGINS=https://<frontend-name>.pages.dev,https://<api-name>.onrender.com
RUN_STORE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
AI_DAILY_CALL_LIMIT=20
OPENAI_API_KEY=<server-only-openai-key>
OPENAI_MODEL=<model-enabled-in-your-project>
OPENAI_TIMEOUT_MS=60000
OPENAI_MAX_OUTPUT_TOKENS=4096
```

Render supplies `PORT`; the server reads it. Keep the runtime URL in `ALLOWED_HOSTS` without `https://` or a port; keep full browser origins in `ALLOWED_ORIGINS`. These are exact lists. Add a custom domain explicitly when you use one. The API does not trust arbitrary forwarded headers.

Without the OpenAI key/model, health and deterministic evaluation still work; recommendation returns 503. Choose a model your OpenAI project can access with Responses and strict Structured Outputs. Optional pricing-rate variables only estimate cost; the global call cap is not a monetary spending limit.

Use **`RUN_STORE=supabase` on Render Free**. Free services can sleep after 15 idle minutes, take roughly a minute to wake and lose local filesystem changes on restart/redeploy/spin-down. The local JSON store cannot provide durable history or quotas there. Free hosting is appropriate for this demo's availability expectations. [Render free-service limits](https://render.com/docs/free)

## 3. Configure Cloudflare Pages

Create a Pages project connected to this repository. Keep the repository root as the build root so npm workspaces and shared contracts are available.

| Setting                     | Value                                               |
| --------------------------- | --------------------------------------------------- |
| Build command               | `npm ci && npm run build`                           |
| Output directory            | `frontend/dist`                                     |
| Node version                | `22`                                                |
| Public environment variable | `VITE_API_BASE_URL=https://<api-name>.onrender.com` |

`VITE_API_BASE_URL` is the API **origin**, without a trailing `/api`; frontend code appends `/api`. Set it before building. Vite injects public values into the bundle, so changing the API URL requires a rebuild. No Supabase or OpenAI credential belongs in Pages build variables. Cloudflare documents the Vite build/output workflow and environment settings in [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

The built frontend can also be served by the backend on Render: leave `VITE_API_BASE_URL` empty when building that same-origin version. A Pages build needs the explicit external API origin. Ensure the frontend's exact Pages production origin is included in the API CORS allowlist; preview domains are not automatically trusted.

## 4. Verify the deployed environment

After configuring the actual services:

1. Open `https://<api-name>.onrender.com/api/health`; verify schema `2.0` and safe configuration flags. This checks process/configuration, not a live provider or database transaction.
2. Open `/api/docs/` and try the complete evaluation example. Check `/api/runs` contains the result after refreshing/restarting the API.
3. Load the Pages URL, compare a basket, validate the CSV template and retrieve shared history. Check browser CORS/preflight requests succeed.
4. With a configured OpenAI project, make one deliberate recommendation request. Verify actual model, token usage, decision context and persisted result. This invokes a billable provider; stub tests do not establish live compatibility.
5. Verify the shared quota survives an API restart and another instance. Confirm the database is denying direct anon access and the browser bundle contains no server secrets.

Local automated coverage exercises API schemas, mocked database/provider errors, atomic local quotas, global quota handling and real HTTP disconnect cancellation. Live Supabase SQL execution, cloud CORS/network behavior and provider access still require the checks above.

## Guarantees and limits

| Concern                  | Local JSON                       | Supabase database                           |
| ------------------------ | -------------------------------- | ------------------------------------------- |
| Scope                    | One shared workspace             | The same shared workspace                   |
| Saved history            | Snapshot on the configured disk  | PostgreSQL rows across API restarts         |
| Daily AI cap             | Atomic within one writer process | Atomic PostgreSQL function across instances |
| Minute rates / active AI | Per backend process              | Still per backend process                   |
| Multi-instance writes    | Unsupported for the same file    | Supported through the database              |

Every accepted AI attempt consumes the workspace quota before the provider call; failed and canceled attempts remain counted. Disconnect cancellation is forwarded, but already processed tokens may still be billed. Storage failure after provider success can return an error after cost was incurred. In-memory rate windows reset on restart; a caller can use the shared allowance before another visitor does.

There is no delete/history-management API or automated retention job in this MVP. Agree on a retention policy and clean up the database through reviewed administrative operations as needed. Save only information intended for all visitors of this shared workspace. Provider prompt/input/context are sent only when requesting AI; full input/result metadata are stored for subsequent review. Forecasts remain scenario assumptions, not calibrated sales predictions.

Free-plan quotas and terms can change. Confirm current provider dashboards before relying on availability, storage retention or billing limits; the repository does not promise an always-on, zero-cost production service.
