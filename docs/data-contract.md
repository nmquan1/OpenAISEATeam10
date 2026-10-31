# Historical evidence and financial input v2

The canonical executable contract is `contracts/model.ts`: TypeBox JSON Schema, inferred TypeScript types and strict runtime parsers. The financial engine receives a fixed basket with explicit SKU quantities, stock, integer VND prices/costs/packaging, a fixed/percentage voucher, seller funding, fees/tax, shipping/advertising, expected returns, quota and budget. Rates use integer basis points: 1%=100bps. A voucher qualifies on the full basket, while stock is constrained by its scarcest line. The model does not infer a real distribution of customer baskets or verified platform fee rules.

`assumptions.response_curve` explicitly states the seller's assumed relationship between effective buyer discount and conversion. Zero discount must map to baseline conversion; discount points increase and multipliers cannot decrease. Both ordinary and AI proposals use the same curve and exact integer calculations. Historical evidence never silently changes this curve. Results are tagged `mode:scenario_only`, with schema and engine versions.

## Import a small aggregate history CSV

`POST /api/history/validate` accepts `{ "csv": "label,visits,orders,revenue_dong,voucher_spend_dong\nSale A,1000,100,29900000,2000000" }` and returns a validated history object directly:

```json
{
  "source": "user_reported",
  "campaigns": [
    {
      "label": "Sale A",
      "visits": 1000,
      "orders": 100,
      "revenue_dong": 29900000,
      "voucher_spend_dong": 2000000
    }
  ]
}
```

The shipped [CSV template](../data/history-template.csv) contains headers only. Add actual aggregates; a header-only file is rejected because it contains no evidence. The importer accepts UTF-8 BOM, CRLF, quoted commas and escaped quotes. It rejects malformed quoting, extra or missing columns, internal blank rows, blank numeric values, negative/fractional/exponential numbers and unsafe/out-of-range values. A blank means missing and is never converted to zero. Numeric cells contain plain nonnegative decimal integers without separators or surrounding spaces.

Headers must be exactly `label,visits,orders,revenue_dong,voucher_spend_dong` in that order. CSV content is limited to 32,768 UTF-8 bytes and 1–20 data rows; the HTTP JSON body limit may be tighter because it also includes JSON quoting. Labels are trimmed, contain at most 100 characters, cannot contain control/invisible format characters, and cannot start with spreadsheet formula prefixes `=`, `+`, `-` or `@`. Duplicate labels are rejected after trimming, Unicode normalization and case folding. Visits/orders are at most 100,000,000; money totals are at most 1,000,000,000,000 VND. Orders cannot exceed visits in this one-order-per-session aggregate contract.

Each row is **one distinct campaign with a nonoverlapping attribution window and the same scope for visits, completed orders and attributed revenue/spend**. Do not repeat shop totals over SKU or segment rows. Do not mix a campaign total with its component rows. Label uniqueness detects accidental duplicate rows; the application cannot verify whether distinct labels conceal overlapping campaigns. You must define campaign windows and outcome maturity outside this compact import. Revenue and spend here are descriptive historical aggregates, not a replacement for the engine's cost/fee/returns inputs.

## What historical context changes

The frontend places validated evidence in recommendation `context.history` next to `context.seller_notes`. Evidence is always `source:user_reported`; CSV validation verifies structure and basic consistency, not authenticity or experimental quality. The provider can use these bounded aggregates to propose voucher candidates. It cannot override typed seller costs, stock, budget, basket or the response curve. The engine recalculates every candidate and includes the existing no-voucher, reduced-voucher and current-voucher choices.

Descriptive conversion is total orders / total visits; average order value is total revenue / total orders. Use summed numerators/denominators, never an unweighted mean of campaign ratios. A zero denominator yields unavailable. Recommendation decision context identifies the source/campaign count, descriptive metrics and whether history affected the forecast; `applied_to_forecast` is always false at this stage. No CSV data is represented as a fitted elasticity, causal voucher uplift or calibrated demand prediction.

To estimate voucher effects, collect comparable exposure, treatment assignment, basket distributions, costs, stockouts, returns and other promotions with mature outcomes, then apply an explicitly evaluated model or controlled experiment. A campaign's orders alone cannot separate traffic, voucher framing, seasonality and selection effects. This compact importer does not implement that research workflow.

## Privacy and reproducibility

Use campaign labels and aggregate counts only. Do not import buyer names, phone numbers, addresses, emails, IDs or chat logs. Validation rejects extra CSV columns; seller notes remain free text, so the user must avoid personal information there. Calling AI sends the selected aggregate context and configured input to the provider. Saved/exported decisions should preserve the input, assumed curve, structured evidence, model identity, versions, ranking basis and limitations together.

Money calculations use exact BigInt intermediates. Discount, seller funding, fees, tax and expected returns round half away from zero per order, before campaign aggregation. Returned orders refund revenue and tax while retaining configured nonrefundable fees and sunk costs. Voucher budget is conservatively not refunded when an order returns. This is a transparent scenario accounting convention, not a verified marketplace settlement integration.
