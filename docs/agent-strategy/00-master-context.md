# MASTER CONTEXT: Margin-Guard Strategy Evaluation for LLM / Claude Code

**Purpose of this file**  
Single consolidated research + instruction document for Claude Code (or any LLM) to generate a near-complete system that evaluates and recommends voucher strategies + combinations for a merchant while protecting contribution margin (Margin Guard).

Data is intentionally kept relatively raw so the LLM can re-reason, score, and refine rather than just copy templates.

---

## 1. Merchant Input Schema (Core 3 Fields + Recommended Extensions)

### Required Basic Inputs (3 fields the merchant provides)
```json
{
  "num_users": 5000,          // Số lượng user / customers hiện có (or expected traffic)
  "num_products": 120,        // Số lượng sản phẩm / SKUs
  "num_vouchers": 8           // Số lượng voucher / offers merchant muốn chạy đồng thời hoặc trong campaign
}
```

### Strongly Recommended Additional Inputs (for better evaluation)
```json
{
  "avg_order_value": 45.0,
  "gross_margin_pct": 40,              // overall or by category
  "contribution_margin_floor_pct": 25, // hard floor after all discounts + shipping
  "current_discount_penetration_pct": 30,  // % of orders already using discount
  "primary_objective": "aov",          // acquisition | aov | clearance | retention | winback | mixed
  "customer_segments": ["new", "active", "lapsed", "vip"],
  "vertical": "fashion",               // fashion | beauty | food | home | electronics | etc.
  "low_margin_skus_pct": 15,           // % of catalog that is thin-margin
  "has_loyalty_program": true,
  "shipping_cost_avg": 6.5
}
```

**Interpretation guidance for LLM**:
- Low `num_users` + high `num_vouchers` → risk of over-discounting; prefer fewer, more targeted offers.
- High `num_products` + clearance objective → allow more SKU-scoped deep discounts.
- High `num_vouchers` → must enforce strict combination rules and margin floor.
- Small merchant (low users + low products) → start with Set A Conservative.

---

## 2. Core Margin-Guard Principles (Non-negotiable)

1. **Default = No stacking** unless explicitly allowed and modeled.
2. Realized margin impact of a discount is often **2–3× the headline rate** (costs stay fixed).
3. Targeted / conditional offers cannibalize only **10–25%**; broad public coupons **20–60%**.
4. ~68% of discounted orders come from repeat customers (rewarding existing demand).
5. Measure **incremental contribution $** (holdout groups preferred), not just redemption or AOV.
6. Healthy long-term target: <25% of revenue from discounted orders.
7. Always check **margin floor** after the full combination is applied.
8. Prefer value-add (GWP, free shipping threshold, store credit, early access) over deep pure % off when possible.
9. Personalized / segment-specific offers deliver up to **3× ROI** vs mass promotions (BCG).

**Key formulas**:
- Contribution after discount = (Price × (1 – discount%)) – COGS – shipping_subsidy – fees
- Volume needed to break even on margin $ = Original_contribution / New_contribution
- Margin Preservation Rate (MPR) = Actual margin $ / (Full-price equivalent margin $) × 100

---

## 3. Strategy Catalog (Raw, Organized by Objective)

### 3.1 Acquisition
| ID | Name | Mechanic | Typical Depth | Guardrails | Risk | Best when |
|----|------|----------|---------------|------------|------|-----------|
| ACQ-01 | First-order Welcome % | 10–20% unique single-use | 10–15% | First order only, min spend, exclude sale items | Low | New users, low discount penetration |
| ACQ-02 | Free Shipping Threshold (New) | Free ship over X (15–30% above AOV) | Shipping cost | New customers only | Low | High cart abandonment |
| ACQ-03 | Exit-Intent Personalized | Free ship first, escalate to 5–10% if needed | Low | High-intent abandoners, unique | Low | Traffic > conversion problem |
| ACQ-04 | GWP Trial | Low-COGS sample over threshold | Gift COGS $2–6 | Threshold > AOV | Low | Product discovery categories |
| ACQ-05 | Dual-sided Referral | Give $X / Get $X or credit | Moderate | Post-purchase, unique tracking | Low–Med | Existing users who can refer |

### 3.2 AOV Lift
| ID | Name | Mechanic | Typical Depth | Guardrails | Risk | Best when |
|----|------|----------|---------------|------------|------|-----------|
| AOV-01 | Tiered Spend Discount | 5%/10%/15% at rising thresholds | 5–15% | Thresholds above current AOV | Low–Med | Want higher baskets |
| AOV-02 | Free Shipping Threshold | Free ship over X | Shipping | Threshold 15–40% above AOV | Low | Classic lever |
| AOV-03 | Tiered GWP | Better gifts at higher spend | Gift COGS | Thresholds clear | Low | High perceived value |
| AOV-04 | BOGO / Buy X Get Y | Buy 2 get 1 free or % off 2nd | Variable | Prefer different items or volume | Med | Consumables, fashion sets |
| AOV-05 | Shallow Bundle | 10–20% off sum of complementary items | 10–20% | Only items that need incentive to be bought together | Low–Med | Complementary catalog |
| AOV-06 | Quantity Break | Buy 3+ save 15% | 10–20% | Cap or exclude low-margin | Low–Med | Multi-unit categories |

### 3.3 Clearance
| ID | Name | Mechanic | Typical Depth | Guardrails | Risk | Best when |
|----|------|----------|---------------|------------|------|-----------|
| CLR-01 | SKU/Category Deep Discount | 25–50% on tagged slow movers | High | Time-boxed, SKU-scoped only | High | Excess inventory |
| CLR-02 | BOGO Overstock | Buy 1 get 1 free on dead stock | High | Limited qty | High | Need velocity |
| CLR-03 | Mystery GWP from Dead Stock | Free gift from written-down inventory | Low actual | Clearance only | Med | Warehouse space |

### 3.4 Retention / Loyalty
| ID | Name | Mechanic | Typical Depth | Guardrails | Risk | Best when |
|----|------|----------|---------------|------------|------|-----------|
| RET-01 | Loyalty Points / Store Credit | % back or fixed credit | Low effective | Only pay when redeemed | Low | Want repeat without training discount |
| RET-02 | Tier Status Perks | Early access, free ship, points multiplier | Non-% | High LTV customers | Low | Protect price integrity |
| RET-03 | First-to-Second Accelerator | $10 off or free ship on order #2 within 14 days | Moderate | One-time, short expiry | Low | Improve 2nd purchase rate |
| RET-04 | Replenishment Credit | Small credit if reorder on schedule | Low | Time-boxed | Low | Consumables / beauty / food |

### 3.5 Win-back
| ID | Name | Mechanic | Typical Depth | Guardrails | Risk | Best when |
|----|------|----------|---------------|------------|------|-----------|
| WB-01 | Graduated Win-back | Content → small incentive → deeper | 15–25% | Lapsed only, unique, short expiry | Med | 60+ day lapse |
| WB-02 | Personalized Deeper Offer | Unique 20% or free item | Higher | One per customer | Med | High-value lapsed |

**Evidence notes (raw)**:
- BCG: Personalized offers up to 3× ROI vs mass.
- Shopify study: % off associated with higher AOV than fixed $.
- GWP cases: 15–40% AOV lift common; gift cost much lower than equivalent discount.
- Referral: referred customers +16% LTV, +37% retention; many programs 5–50× ROI.
- Store credit / points: only cost when customer returns; better LTV than pure % acquisition.

---

## 4. Combination / Stacking Rules (Raw Matrices)

### 4.1 Default Policy
- New promotion starts **exclusive**.
- One primary order-level discount code per order.
- Free shipping almost always combinable.
- Store credit / points usually allowed (with floor).
- Two compounding percentages on same items → Deny or Best-of.
- Codes cannot apply on already-discounted / sale / compare-at items.

### 4.2 Combinability Matrix (Starting Point)
(See detailed matrix in previous research; summary below)

| Type | Can stack with Free Shipping? | Can stack with another %? | Can stack with GWP? | Can stack with Points/Credit? |
|------|-------------------------------|---------------------------|---------------------|-------------------------------|
| Welcome % | Yes | No | Yes (low COGS) | Yes (floor) |
| Loyalty % | Yes | No / Best-of | Yes | Yes |
| Free Shipping | — | Yes | Yes | Yes |
| GWP | Yes | Limited | Exclusive (one) | Yes |
| BOGO | Yes | No (same items) | Yes | Yes |
| Tiered Volume | Yes | No | Yes | Yes |
| Clearance | Yes | No | Yes | Limited |
| Store Credit | Yes | Yes (floor) | Yes | — |

### 4.3 Ready-made Combination Sets
- **Set A – Conservative** (recommended default): 1 code + free shipping + points/credit + GWP. No % stacking.
- **Set B – Growth/AOV**: Tiered + free shipping + GWP with total product discount cap ≤ 25–35%.
- **Set C – Clearance**: Deep only on tagged SKUs + free shipping.
- **Set D – Segment-based**: Different allowed stacks per new / active / lapsed / VIP.

### 4.4 Application Order
1. Product-level (sale, volume, BOGO, bundle)
2. Order-level code
3. Shipping
4. Store credit / Points (payment-like)

**Margin floor check** runs after full combination. If breached → block second discount or apply Best-of + alert.

---

## 5. LLM Evaluation Guidelines (How to Evaluate & Recommend Strategies)

**Your job as the evaluating LLM**:
Given merchant inputs (`num_users`, `num_products`, `num_vouchers` + optional fields) and the strategy catalog above, produce a ranked set of recommended strategies + allowed combinations that maximize the merchant’s primary objective while respecting the contribution margin floor.

### Evaluation Dimensions (score each candidate strategy 1–10)
1. **Objective Fit** — How well it matches primary_objective.
2. **Margin Safety** — Likelihood of staying above floor after realistic stacking.
3. **Incremental Potential** — Expected true incremental contribution (not just redemption).
4. **Scale Fit** — Appropriate for `num_users` and `num_vouchers`.
5. **Catalog Fit** — Works with `num_products` (SKU-scoped vs sitewide).
6. **Cannibalization Risk** — Lower is better.
7. **Implementation Complexity** — Prefer simpler when merchant is small.

### Decision Rules (raw logic to apply)
- If `num_vouchers` ≤ 3 and merchant is small → strongly prefer Set A Conservative + 1–2 strategies.
- If `num_vouchers` ≥ 6 → enforce hard combination matrix and global discount cap.
- If primary_objective = "aov" → prioritize Tiered Spend, Free Shipping Threshold, Tiered GWP, Shallow Bundle.
- If primary_objective = "acquisition" → prioritize unique first-order + referral + exit-intent.
- If primary_objective = "clearance" → only SKU-scoped deep discounts; never let them stack with welcome/loyalty %.
- If gross_margin_pct is low (<30%) → reduce max discount depth and ban most % stacking.
- Always output the **margin floor check** as a required step in the final recommendation.
- Prefer unique / single-use codes for acquisition and win-back.
- Recommend holdout measurement whenever possible.

### Output Structure the LLM Should Produce
For each recommended strategy package:
```json
{
  "package_name": "...",
  "primary_objective": "...",
  "recommended_strategies": [
    {
      "id": "AOV-01",
      "name": "...",
      "why_selected": "...",
      "guardrails_applied": ["..."],
      "estimated_risk": "low|medium|high"
    }
  ],
  "allowed_combinations": "Set A or custom matrix",
  "margin_floor": 25,
  "max_combined_discount_pct": 30,
  "exclusions": ["already discounted items", "low-margin SKUs"],
  "expected_outcomes": {
    "aov_lift_range": "10-25%",
    "cannibalization_risk": "10-20%",
    "notes": "..."
  },
  "merchant_input_fit": {
    "num_users": "...",
    "num_products": "...",
    "num_vouchers": "..."
  }
}
```

### Ranking Preference (when multiple options exist)
1. High objective fit + high margin safety
2. High incremental potential
3. Low implementation complexity
4. Low cannibalization risk

---

## 6. Example Evaluation Scenarios (Raw)

**Scenario 1 – Small fashion merchant**
- num_users: 800, num_products: 45, num_vouchers: 3
- Objective: AOV
- Recommendation bias: Set A + Free Shipping Threshold + Tiered GWP. Avoid deep % stacking.

**Scenario 2 – Mid-size beauty with loyalty**
- num_users: 12000, num_products: 200, num_vouchers: 6
- Objective: Retention + AOV
- Recommendation bias: Set B or D + Points/Store Credit + Tiered Spend + limited Welcome for new.

**Scenario 3 – Clearance push**
- num_users: 5000, num_products: 300 (many slow), num_vouchers: 4
- Objective: Clearance
- Recommendation bias: Set C only on tagged SKUs + free shipping. Block all other % codes on those SKUs.

---

## 7. Additional Raw Notes for LLM Reasoning

- Free shipping threshold is one of the safest AOV levers because the cost is bounded.
- GWP often outperforms equivalent % discount on both AOV and subsequent repeat rate when gift has high perceived value / low COGS.
- Store credit and loyalty points are preferred over pure percentage discounts for retention because cost is deferred and only incurred on return.
- Referral programs frequently show very high ROI when the incentive is dual-sided credit rather than pure cash.
- Always model the worst-case stack before activating any combination.
- Unique codes + first-order or segment restrictions dramatically reduce leakage to coupon sites and existing customers.

---

**End of Master Context**

Use this document as the primary knowledge base. Reason over the merchant’s three core inputs (and any extra fields), apply the principles and matrices, then generate concrete strategy packages with explicit margin-guard rules. Prefer safety and incremental profit over maximum redemption.
