# Market Maker frontend

React + TypeScript + Vite. The UI edits a fixed-composition basket and asks the backend to calculate scenarios; it never imports the backend engine or invents provider responses. Shared types and runtime validation come from `@market-maker/contracts`.

## Run

Install dependencies once from the repository root with `npm ci`. Copy the root `.env.example` to `.env`; Vite reads public `VITE_*` values from that root file. In separate terminals, start the backend on port 4173 and run:

```sh
npm run dev --workspace @market-maker/frontend
```

Open http://localhost:5173. Vite proxies `/api` and `/docs` to the backend. `npm run build --workspace @market-maker/frontend` type-checks and builds `frontend/dist/`, including an explicit allowlist of public research documents. The backend can serve this built app on its own origin; the build directory can also be hosted on Cloudflare Pages.

For a separately hosted backend set `VITE_API_BASE_URL=https://your-api.onrender.com` without an `/api` suffix. Build again after changing a public environment variable. A static host alone cannot calculate scenarios or call AI; the UI requires the backend API.

## Shared MVP workspace

No login, session, bearer token or frontend authentication configuration is required. All API calls use the same shared workspace. Run history is accessible to everyone using this deployment; browser drafts use one versioned localStorage key on that device. Keep the environment appropriate for shared demo data.

The AI button stays disabled until backend health confirms that the provider key and model are configured. Provider credentials remain on the backend; no provider secret is bundled into the frontend.

## Read the code

- `src/App.tsx`: current input/result, stale-request cancellation, validated autosave/import and orchestration.
- `src/api.ts`: HTTP transport and runtime response validation.
- `src/draft.ts`: versioned local draft and exported plan format. Invalid imports never replace the form; imported results are recalculated.
- `src/components/StrategyForm.tsx`: basket, voucher, costs, constraints and response-curve editor.
- `src/components/ContextEditor.tsx`: seller notes and aggregate history, including server-validated CSV.
- `src/components/Results.tsx`: scenario comparison, selected plan, context influence, apply and export.
- `src/components/AiPanel.tsx`: provider availability and explicit AI request/cancel actions.

A plan export includes the actual selected strategy, complete result and decision context. Applying a candidate changes the voucher in the form and recalculates; it does not publish to Shopee. Browser drafts are shared by users of this browser; backend run history is shared by all users of the deployment. History supplied by a seller helps candidate generation and does not automatically calibrate traffic, conversion or causal impact. Edits and unmounts cancel stale requests so older responses cannot overwrite newer input.
