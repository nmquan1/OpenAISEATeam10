# Canonical contract v2

`model.ts` defines TypeBox JSON Schemas, inferred TypeScript types, complete example `defaults`, and strict runtime parsers. All HTTP boundaries, AI proposals, browser responses and engine inputs use this source. Unknown fields and coercion are rejected. See `INTERFACE.md` for the complete shape.

Money is integer VND and rates are integer basis points. A basket has fixed SKU quantities. Response curves are explicit seller assumptions; history is user-reported aggregate context and never silently calibrates demand. Every result identifies its schema, engine and scenario-only mode. Invalid cross-field constraints are rejected by parsers in addition to JSON Schema checks.
