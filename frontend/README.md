# Market Maker frontend

Vanilla HTML/CSS/JavaScript. `index.html` contains the page structure; `src/app.js` renders the workbench, exports JSON and invokes the recommendation API; `src/style.css` styles it.

Run `npm start` from the repository root, then open http://localhost:4173. Backend and frontend share the same origin. The browser imports `/engine/index.js` and `/contracts/model.js`, so local simulation uses the same formula and input validation as the API. These modules are served through an explicit allowlist.

`npm run build` at the root produces `dist/`, including the shared browser modules and Markdown documentation. A static host can serve local simulation and JSON export, but `/api/recommend` needs the Node backend. No build step embeds `.env`, the provider key or API token.

The UI currently has no login or API token entry. Enabling the backend bearer token blocks browser API calls unless an authenticated gateway handles access. The Finance/Growth/Risk roundtable panel is deterministic explanatory text, not a running multi-agent system. See [scope and limitations](../README.md) and the [API contract](../docs/api.md).
