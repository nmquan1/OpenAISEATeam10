# Decision evidence snapshot

This package contains **4,328 aggregate evidence cards**: 1,089 entity profiles, 3,141 directed co-purchase relationships, 96 hypothetical voucher replays and two basket-distribution profiles. It contains no transaction rows, customer/household identifiers, embeddings or vector database.

`manifest.json` pins the JSONL checksum, input feature checksums, source dataset checksum, versions and attribution. `contracts/evidence.ts` defines the runtime contract. The builder first verifies the independent dataset/feature PASS reports and every audited feature artifact hash. Build output is deterministic: it contains no runtime timestamp or local absolute path.

```sh
python3 scripts/evidence/build.py --source /path/to/market-maker-dataset
```

The source directory must contain the finalized `manifest.json`, `audit/central_validation.json`, `features/validation_report.json` and audited feature files. Source files are read only. The compact JSONL ships with the app; deployment does not need the 1M-row CSV, SQLite analysis database or raw source archives. Rebuilding from a new snapshot requires re-running its independent validators first and reviewing the resulting manifest diff.

## Interpretation contract

- `population` retains exact counts and source/window denominators; an absent optional count means unavailable, never zero.
- `metrics` retains decimal text without rounding again; `null` means unavailable. Some redundant window ratios are omitted because their exact numerator/denominator counts remain in `population`.
- `lineage.file` is relative to the source dataset folder. `row_id` is the physical CSV line number, counting the header as line 1; the source file hash identifies the exact snapshot.
- UCI amounts remain GBP, based on retained product subtotal proxies. CJ amounts remain `dollar_unspecified` retailer receipts, not buyer spend or profit. Never add or convert across sources automatically.
- Profiles use source-native SKU IDs or grocery categories. Retrieval must not claim that a foreign SKU/category is the merchant's product without an explicit applicability check.
- Associations are directed historical co-purchases, not incremental sales lift. `BAKED BREAD/BUNS/ROLLS → FLUID MILK PRODUCTS` is 4,899/9,846; the distinct `BREAD → FLUID MILK PRODUCTS` category is 567/1,291. Do not collapse their labels.
- Voucher geometry is a static hypothetical replay on UCI subtotal proxies, with assumed 100% seller funding and no demand/basket response. Its GBP thresholds are not proposed VND thresholds; equal payouts do not establish equal behavioral effects.
- Use evidence to explore voucher candidates. The app's deterministic engine must retain current merchant costs, funding, stock, budget and response curve. These features do not estimate CVR, elasticity, retention, causal uplift or profit.

## Attribution and distribution provenance

UCI Online Retail II: Chen, D. (2012), UCI Machine Learning Repository, [DOI 10.24432/C5CG6D](https://doi.org/10.24432/C5CG6D), CC BY 4.0. Cards are derived aggregates from a filtered sample; this is not an endorsement by the source authors.

Complete Journey: [completejourney data package](https://bradleyboehmke.github.io/completejourney/) by Brad Boehmke and Steven M. Mortimer; upstream Complete Journey 2.0 / 84.51 degrees. The data package declares CC0; separate terms for the retired upstream source were not recovered. The manifest preserves this uncertainty rather than treating package metadata as a newly verified upstream license.

Engineering validation verifies source fidelity and arithmetic. It does not certify representation of the Vietnamese market, relevance to an individual shop, legal rights beyond recorded source metadata, or AI recommendation quality.
