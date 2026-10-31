# Migration interface (canonical v2)

All code imports `contracts/model.ts`; TypeBox schemas and `Static` types exported together. No browser JS compatibility model remains. Engine import: `backend/src/engine/index.ts`.

Exports: `EvaluationInputSchema`, `EvaluationResultSchema`, `EvaluationRequestSchema`, `RecommendationRequestSchema`, `RecommendationResultSchema`, `VoucherSchema`, `CandidateProposalSchema`, `defaults` (complete EvaluationInput), types `EvaluationInput`, `EvaluationResult`, `Voucher`, `RecommendationRequest`, `RecommendationResult`; `parseInput(unknown): EvaluationInput`, `parseRequest(unknown): {input:EvaluationInput}`, `parseRecommendationRequest(unknown): RecommendationRequest`, `ValidationError`.

Input shape:

```
{
  product: {name:string, lines:[{sku_id:string, quantity:int>=1, unit_price_dong:int>0, unit_cost_dong:int>=0, packaging_dong:int>=0, stock_units:int>=0}]},
  voucher: {type:'fixed', amount_dong:int>=0, minimum_dong:int>=0, seller_funding_bps:int0..10000} | {type:'percent', rate_bps:int0..10000, cap_dong:int>=0, minimum_dong:int>=0, seller_funding_bps:int0..10000},
  economics: {fee_bps:int0..10000,tax_bps:int0..10000,shipping_dong:int>=0,ads_dong:int>=0,return_rate_bps:int0..10000,return_resale_bps:int0..10000,nonrefunded_fee_bps:int0..10000,return_shipping_dong:int>=0},
  assumptions: {visits:int>=0,cvr_bps:int0..10000,traffic:{low_bps:int>=0,base_bps:int>=0,high_bps:int>=0},response_curve:[{discount_bps:int0..10000,cvr_multiplier_bps:int10000..100000}]},
  constraints: {budget_dong:int>=0,quota:int>=0},
  objective:'safe'|'balanced'|'growth'
}
```

Response curve must start `{discount_bps:0,cvr_multiplier_bps:10000}`, ascending discount and nondecreasing multiplier. Engine interpolates using effective buyer discount / basket gross; equal effective vouchers receive identical demand across deterministic/AI paths. All rates bps and money integer dong. Basket is fixed composition with stock constrained by min(stock_units/quantity). Funding bps affects seller cost, buyer discount drives uplift.

Request `/api/evaluate`: `{input}`. `/api/recommend`: `{input, context:{seller_notes:string(max4000),history?:{source:'user_reported',campaigns:[{label:string,visits:int,orders:int,revenue_dong:int,voucher_spend_dong:int}]}}}`. Context required; UI uses empty seller_notes by default. History never calibrates automatically. `CandidateProposalSchema`: `{candidates: Voucher[]}` 1..5.

Engine exports `evaluate(input): EvaluationResult` and `evaluateVouchers(input, vouchers:Voucher[]): EvaluationResult`. Both include baseline/measured/current; AI adds candidates. Response:

```
{schema_version:'2.0',engine_version:'2.1.0',mode:'scenario_only',input,strategies:[{
 id:string,name:string,voucher:Voucher,discount_dong:int,scenarios:[{
 key:'low'|'base'|'high',visits:int,orders:int,redeemed:int,spend_dong:int,revenue_dong:int,profit_dong:int,stockout:boolean,exhausted:boolean
 }],base_profit_dong:int,worst_profit_dong:int,score:number
}],recommended:strategy,limitations:string[]}
```

RecommendationResult = EvaluationResult plus `{provider:'openai',model:string,context:RecommendationRequest['context']}`. Provider should use actual response model when available. Export full result + context for AI plans. Scenario-only meaning is explicit in every response.

Additional recommendation metadata (required): `prompt_version:string`, `provider_request_id:string`, `usage:{input_tokens:int|null,output_tokens:int|null}`, `estimated_cost_usd:number|null`, `rejected_candidates:int`, and `decision_context:{history_source:'none'|'user_reported',campaign_count:int,observed_cvr_bps:number|null,observed_aov_dong:number|null,applied_to_forecast:false,ranking_basis:string,context_effect:string,field_effects:string[]}`. Exported `RecommendationContext` type and `DecisionContextSchema` support clients. Runtime result parsers `parseEvaluationResult`/`parseRecommendationResult` check result consistency in addition to schema.

Rounding convention: buyer discount, seller funding share, fee, tax and expected return loss each round half away from zero at the per-order level, then campaign sums multiply integer order contributions. E.g. a 40đ order with 9,875bps fee pays a 39.5đ fee rounded to40đ, leaving0đ; this differs intentionally from rounding net profit alone. Returned orders refund seller entitlement and tax, retain the configured share of fees, and consume configured resale losses/sunk shipping/ads/packaging.

`contracts/fixtures.ts` includes single-basket and multi-SKU examples and an explicitly user-reported historical context example. Historical input is not calibrated or automatically applied to the response curve. Fixed baskets do not model product substitution, cart distributions, customer segmentation, or voucher stacking.
