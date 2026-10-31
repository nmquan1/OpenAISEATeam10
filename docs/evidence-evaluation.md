# Decision evidence evaluation

This suite measures the reference retrieval and recommendation workflow. It does not establish that foreign historical observations predict a Vietnamese merchant's sales, or that a larger headline discount changes customer behaviour.

## Dataset and ownership

`data/eval/evidence-cases.v1.json` contains 25 versioned synthetic merchant cases. Each includes full typed merchant input, notes/history, an explicit `reference_query`, expected retrieval source/kind/label families, allowed uses and forbidden inferences. Cases cover percent/cap/minimum mechanics, fixed vouchers, funding, budgets, stock, multiple SKU lines, catalog fees, returns, absent exposure, unusual history and malicious notes. A deliberately unmatched domain is the negative control. The first suite keeps the balanced objective fixed so pooled score gaps are comparable within this suite; add separately reported suites before comparing objectives.

Reference observations remain source-native. Category associations do not identify a merchant SKU, co-purchase lift is not CVR uplift, historical GBP/dollar values are not VND recommendations, and hypothetical payout geometry is not a historical voucher experiment. Retrieval labels are manually specified family-level relevance expectations, not exhaustive gold judgments or statistically independent validation data. The reference was not trained as a predictive model.

## Run without credentials

```sh
npm run eval:evidence
# Fast CI smoke: one repetition instead of the default three
npm run eval:evidence -- --repeats 1
```

Default mode injects a provider fixture returning the same five configured grid proposals with and without evidence. It performs zero external calls. This checks contracts, retrieval, deterministic arithmetic, constraints, report generation and the A/B wiring. Fixture win rates and latency do not describe an LLM. Evidence retrieval must match the labeled source/kind/label families, including the negative control; failures exit nonzero.

Both modes preserve the engine's baseline, moderated and current voucher. The benchmark separately compares:

- The existing deterministic baseline.
- A five-proposal percent grid, with the same maximum proposal count as the model.
- A wider finite reference over rates, caps, minimums and fixed discounts.
- The provider without reference and with reference, using the same input/model and three repetitions by default. Treatment order alternates by repetition.

The wider grid is not a global optimum. A model can beat it by proposing a configuration outside that finite grid. Deduplication and invalid candidate filtering can reduce the effective proposal counts below five.

## Run a deliberately bounded live pilot

The backend `.env` must contain `OPENAI_API_KEY`, `OPENAI_MODEL` and positive `OPENAI_INPUT_USD_PER_MILLION` / `OPENAI_OUTPUT_USD_PER_MILLION` rates corresponding to that model. The suite does not choose a model or invent pricing. Review the account's model access and current pricing before running.

```sh
npm run eval:evidence -- --live \
  --case bread-milk-bundle --repeats 3 \
  --max-calls 6 --max-cost-usd 5
```

Remove `--case` to run all cases. The full default workload is **25 × 3 × 2 = 150 provider calls**. Set explicit call/cost limits appropriate for the run; a partial budget-limited run is not a complete evaluation. Its report sets `complete:false` and the process exits with code 2; failed validation exits with code 1. `--cases PATH` selects another versioned case file; `--output PATH` changes the artifact directory.

The CLI calls the recommendation service directly, bypassing HTTP daily quotas and saved-run storage. It therefore enforces its own call and estimated-cost ledger. Retries are disabled. Before each network call, it reserves cost using a conservative UTF-8-byte input allowance plus framing/schema buffer and the configured maximum output tokens. Successful calls settle against provider token usage; missing usage, transport errors and unsuccessful responses keep the reservation and stop subsequent calls. Usage exceeding the allowance also stops the run and records the discrepancy. This is an estimated text-token guard using supplied rates, **not a provider invoice spending guarantee**. Unknown costs are not treated as zero and no unavailable-cost calls continue blindly.

## Artifacts and interpretation

Each run writes `report.json` and `runs.csv` under `.local/evidence-eval/<timestamp>-offline|live/`. That directory is ignored by Git. Reports contain dataset and input hashes, complete case definitions, retrieved evidence IDs/hash/index version, actual provider model, prompt version, request ID, usage, estimated cost, attempts, timing, failures and whether the run stopped early. Credentials are never written.

A paired comparison reports score gains/ties/losses only when both modes completed the same case/repetition with identical input hash, actual model and prompt version. Mismatches are excluded and counted; these comparisons still do not establish causal business effects.

Per mode, the report includes valid response rate, constraint violations, a new winning proposal rate, the signed gap to the wider grid, p50/p95 latency, estimated cost and repeated-score/winner stability. A new winner must beat the baseline score **and** have an economic strategy ID absent from the retained baselines. Merely retaining a baseline is not an AI quality win. Scores describe the configured scenario engine, not observed merchant outcomes.

Retrieval precision measures only the manually labeled source/kind/label families. It does not measure whether the model relied on the supplied evidence. The current structured provider output is voucher-only: it has neither citations nor explanatory factual prose. Therefore `citation_correctness` and `unsupported_inference_rate` remain **null**, and evidence IDs record context supplied rather than causal explanation. A separate explanation contract and reviewed judgments are required before claiming those metrics.

Acceptance for this stage is zero constraint violations, preserved baselines, passing retrieval expectations and reproducible report artifacts. No live model quality claim is made until a completed, reviewed live report exists. Keep model failures and no-improvement outcomes in the report rather than selecting only successful cases.

## Handoff to the backend owner

`retrieveEvidence(input, context)` returns the versioned retrieval envelope. `context.reference_query` opts in; absent query disables reference. The recommendation service passes that envelope as data to the provider and stores it as `reference_evidence` with the result. Merchant inputs and response curves remain unchanged. The existing five-column merchant-history importer stays separate from this reference pack.
