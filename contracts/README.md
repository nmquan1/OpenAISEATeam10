# Market Maker contracts

`model.js` is the runtime contract shared by the frontend, deterministic engine and HTTP handlers. It exports immutable defaults, `ValidationError`, `parseInput` and `parseRequest`. The browser receives this exact module at `/contracts/model.js`.

`parseInput` validates known fields and may fill defaults for local scenario exploration. HTTP handlers use `parseRequest`, which requires a complete input and rejects unknown request/input fields. Validation does not coerce strings into numbers or silently strip fields. Amounts are integer VND; stock, traffic and quota are integer counts; fee/CVR use percent units. Dates are valid wall-clock `YYYY-MM-DDTHH:mm` values for Asia/Ho_Chi_Minh.

The full fields, bounds and HTTP envelopes are documented in [docs/api.md](../docs/api.md). Provider candidate structure lives in `backend/src/agent/recommend.mjs`: strict structured output is followed by runtime validation and deterministic recalculation. The model cannot override seller costs, stock or budget.

This contract is independent of the neighboring Margin Guard contracts, which use order baskets and basis-point rates. Sharing the project structure does not make those payloads interchangeable. Change all producers, consumers and tests together when changing the model; introduce a new contract version for incompatible HTTP changes.
