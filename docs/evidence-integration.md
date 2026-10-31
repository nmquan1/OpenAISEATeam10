# Decision evidence integration

Historical reference retrieval is **opt-in**. Without a nonblank `context.reference_query`, the recommendation service returns `status:"disabled"` and does not load the evidence index. Product names, seller notes and uploaded campaign history do not silently enable retrieval.

## Try it in the app

1. Enter the merchant's current basket, costs, funding, stock, budget and response-curve assumptions.
2. In **Tìm reference cho AI**, enter a specific query, such as `source:cj cat litter cat food`, `source:cj bread milk bundle` or `source:uci voucher geometry cap minimum`.
3. Click **Xem reference · không gọi AI**. The preview uses local lexical retrieval and requires no OpenAI key or paid request. Inspect source, entity level, denominator counts, monetary basis and limitations before using it.
4. Click **Đề xuất bằng AI** to send the same reference query with the recommendation request. This step requires backend OpenAI credentials. The server retrieves the cards again and supplies them to the provider; clients cannot inject arbitrary evidence cards.
5. The result/export includes the supplied reference cards, evidence IDs, dataset version, index checksum and retrieval version. This proves which references were supplied, not that a model used them correctly or that they caused a better recommendation.

Clearing the query disables reference retrieval. Changing input/context clears stale preview/results. A missing or invalid evidence package produces `unavailable`; an unrelated query produces `no_match`. Neither condition fabricates evidence. Recommendation can continue from the merchant's own inputs, and the deterministic engine still computes all financial results and rankings.

## HTTP contract

`POST /api/evidence/retrieve` accepts the same `{input, context}` body as `/api/recommend`. `context.seller_notes` remains required; `reference_query` is optional, at most 500 characters. Example using canonical merchant defaults:

```sh
npx tsx -e "import {defaults} from './contracts/model.ts'; console.log(JSON.stringify({input:defaults,context:{seller_notes:'',reference_query:'source:cj cat litter cat food'}}))" > /tmp/market-maker-evidence-request.json
curl http://127.0.0.1:4173/api/evidence/retrieve \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/market-maker-evidence-request.json
```

Swagger at `/api/docs` includes a complete request example. The preview route shares the 120 requests/IP/minute process-local bucket with history reads and CSV validation; it does not consume AI daily allowance or create a saved recommendation run.

The response is:

```text
{
  enabled, status: disabled | no_match | matched | unavailable,
  dataset_version, index_sha256, retrieval_version, query, items: EvidenceCard[]
}
```

The current retriever returns at most six cards and a 15,000-character serialized card budget, all from one source. It uses source filters (`source:cj`, `source:uci`), explicit topic rules and a small documented vocabulary of Vietnamese/English aliases. There are no embeddings or vector database. Unknown/conflicting source filters and unmatched topics yield an empty result. Payout-equivalent geometry records are deduplicated within a returned batch.

`POST /api/recommend` adds optional `reference_evidence` to its response. The full result is saved through the normal run store and exported with the selected strategy. Older saved results without this field remain readable.

## Snapshot, rebuild and provenance

The committed `data/evidence/` package contains 4,328 cards: 1,089 profiles, 3,141 directed associations, 96 hypothetical voucher geometries and two basket profiles. See its [manifest](../data/evidence/manifest.json) for exact SHA-256 hashes and its [README](../data/evidence/README.md) for source attribution.

```sh
python3 scripts/evidence/build.py --source /path/to/market-maker-dataset
```

The builder requires the finalized dataset manifest and independent PASS reports. It verifies all audited feature artifact hashes and the link to the validated dataset, then writes deterministic JSONL and manifest bytes. The original million-row CSV, analysis SQLite file and raw archives are not runtime dependencies and are not copied into this package. Runtime loading validates the JSONL hash, byte size, card count, schema and IDs against the manifest. Restart the backend after replacing a successfully loaded snapshot because the immutable index is cached per process.

Every card preserves source-native entity IDs, evidence scope, source URL, money/time basis, denominators, limitations and source CSV filename/row/hash. Decimal strings retain source precision; `null` or an absent optional count means unavailable. Perform new arithmetic in code, not by asking the model to invent or average numbers across sources.

## Scope and acceptance

UCI references are historical UK-retail observations in GBP; CJ references are grocery observations with `dollar_unspecified` retailer receipts and rebased dates. A category match is not a verified merchant-SKU match. Co-purchase lift is not CVR uplift; minimum-spend replay does not measure induced basket growth; identical payout vectors do not establish identical customer behavior. The engine currently evaluates a fixed basket and cannot establish headline-discount psychology from these sources.

The data package declares the recorded licenses/attribution; CJ's separate retired-upstream terms remain unresolved. Engineering PASS checks fidelity and arithmetic, not market representativeness, causal usefulness or recommendation quality.

Run `npm run eval:evidence` for the offline fixture suite. Paid A/B benchmark runs are a separate, explicitly enabled workflow with call/cost limits: see [evidence evaluation](evidence-evaluation.md). Offline test success must not be presented as evidence that a live model benefits from these references.
