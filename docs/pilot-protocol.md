# Merchant pilot: method 5, actual outcomes

**Status: blocked pending actual merchant assignment and finalized outcome data.** No merchant trial has been run by this implementation. Synthetic unit tests only verify arithmetic and validation. Historical foreign datasets, simulated engine scores and LLM proposals cannot supply missing merchant exposure or causal outcome data.

## Run a prospective pilot

1. Choose one merchant, one eligible customer population, one fixed observation window and one frozen treatment voucher policy. Record the exact control policy, campaign stacking/funding, SKU scope and policy version before enrollment. Avoid changing the treatment after inspecting outcomes.
2. Define eligibility before randomization. Give each eligible customer a random opaque `exposure_id`; reuse their assignment for the entire episode. Do not export email, phone, customer names, source customer IDs or unsalted hashes of those identifiers. Keep the reidentification map separately inside the merchant system.
3. Register every eligible assigned customer in an append-only assignment manifest before displaying the offer. Randomly assign customers to control or treatment, normally equally. A customer must not cross arms or create multiple independent rows. Keep the original assignment log for reconciliation; the analyzer cannot independently prove randomization or completeness.
4. Prespecify the experiment duration, required sample size/power, outcome window, primary metric and stopping rule. Use net profit per assigned eligible customer as the primary business metric; conversion is secondary. `n >= 2` per arm is only a computational minimum for variance, not sufficient sample size.
5. Log exposure separately from assignment. Retain customers who never see the offer, never redeem or never convert. Organic conversions in control are valid. Do not select only voucher redemptions or mark nonresponders ineligible after assignment. This analyzer uses intention-to-treat denominators.
6. Observe each customer for the same prespecified window, then wait for cancellation/refund/return settlement. Define `converted` consistently in advance, including how full returns affect conversion. Aggregate all eligible orders for that customer/window into one outcome row. Do not run the final analyzer on incomplete follow-up and substitute zero for unknown outcomes.
7. Freeze and version the cost policy. `net_profit_dong` is finalized merchant receipts minus cost of goods, packaging, merchant-funded voucher cost, platform/payment fees, taxes, shipping, allocated ads and finalized return/cancellation losses, according to that policy. Avoid subtracting voucher funding twice if already deducted from receipts. Include relevant assigned-customer costs even for nonconverters; zero is not the default for missing accounting. Monetary rows are signed integer VND, not USD or foreign dataset money.
8. Reconcile every manifest ID to exactly one outcome row, preserving arm and eligibility. No post-assignment exclusions are accepted. If data is missing or contaminated, resolve collection/accounting or explicitly redesign the analysis with a qualified analyst; do not silently drop rows. Separate episodes cannot share customers without a repeated-customer analysis.
9. Prepare the episode JSON and run the local analyzer. Review arm sizes, assignment balance, tracking gaps, accounting versions, confidence interval limitations and operational integrity before interpreting any difference. This tool does not update the app's response curve or claim causal effectiveness automatically.

## Files and command

- `data/pilot/assignments.template.csv`: headers for the complete assignment registry.
- `data/pilot/outcomes.template.csv`: headers for one outcome per assigned eligible customer, including nonexposed/nonconverting customers.
- `data/pilot/episode.template.json`: strict metadata skeleton. Empty arrays intentionally fail validation. Set all assertions from verified records; do not leave `returns_finalized: true` if returns remain open. Campaign ID is optional.
- `contracts/pilot.ts`: strict episode, assignment and exposure contracts; unknown fields are rejected.

Populate the JSON `assignments` and `rows` arrays from the merchant's verified exports. CSV headers are collection templates; there is no automatic CSV importer in this implementation. Use real booleans and integers in JSON. Copy the skeleton to a private `.local/` path and retain original assignment exports securely. Do not commit merchant data.

```sh
npx tsx scripts/evaluation/pilot.ts \
  --input .local/merchant-pilot.json \
  --output .local/merchant-pilot-report.json
```

Set `data_origin` to `merchant_observed` only for real recorded merchant outcomes. Synthetic tests use `synthetic_test` and reports say `synthetic_validation_only`. Neither value independently authenticates the data.

## Interpretation and limits

The report sums profit using exact integer arithmetic and calculates conversion and average net profit per assigned eligible customer for each arm. The reported effect is **treatment minus control**, with absolute conversion percentage points, relative conversion lift when control conversion is nonzero, and VND profit difference per assigned customer. It does not extrapolate to overall merchant profit.

Standard errors use independent-group sample variances. The displayed 95% intervals are unpooled normal approximations, **descriptive and potentially unreliable** for small groups, rare conversions, skewed profit or boundary conversion rates. A zero estimated variance is not certainty; boundary cases need a more suitable prespecified interval method. `normal_approximation_concern` flags groups below 30 or fewer than five converting/nonconverting observations. Absence of that flag is not an assurance of valid inference or adequate power.

Randomization, independent assignment, no interference and comparable finalized accounting are assumptions, not facts verified by schema validation. Household effects, repeated customer episodes, voucher sharing, cross-arm exposure or grouped assignment require a different design/analysis. No significance test, multiple-testing correction, sequential monitoring guarantee or causal certification is supplied. The complete assignment manifest helps detect missing rows, but a dishonest or incomplete upstream manifest cannot be detected from this file alone.
