/** A reservation ledger for estimated text-token cost, not a provider invoice spending limit. */
export class BudgetStop extends Error {}
export type BudgetLimits = {
  maxCalls: number;
  maxCostUsd: number;
  inputRate: number;
  outputRate: number;
};
export class LiveBudget {
  calls = 0;
  accountedCostUsd = 0;
  observedCostUsd = 0;
  stopReason: string | null = null;
  constructor(readonly limits: BudgetLimits) {
    if (!Number.isSafeInteger(limits.maxCalls) || limits.maxCalls < 1 || limits.maxCalls > 1000)
      throw new Error('--max-calls must be an integer in 1..1000');
    for (const [name, value] of Object.entries(limits))
      if (!Number.isFinite(value) || value <= 0)
        throw new Error(`${name} must be positive and finite`);
  }
  reserve(body: string) {
    if (this.stopReason) throw new BudgetStop(this.stopReason);
    if (this.calls >= this.limits.maxCalls) {
      this.stopReason = 'max_calls_reached';
      throw new BudgetStop(this.stopReason);
    }
    const payload = JSON.parse(body) as { max_output_tokens?: number; tools?: unknown };
    const outputAllowance = payload.max_output_tokens;
    if (
      !Number.isSafeInteger(outputAllowance) ||
      !outputAllowance ||
      outputAllowance < 1 ||
      payload.tools
    )
      throw new BudgetStop(
        'Only bounded text-only Responses requests are supported by this budget',
      );
    // Byte-based allowance deliberately overcounts text and adds a framing/schema buffer.
    // If provider usage exceeds it, stop immediately and report the overrun; it is not an invoice guarantee.
    const inputAllowance = Buffer.byteLength(body, 'utf8') * 2 + 16384;
    const cost =
      (inputAllowance * this.limits.inputRate + outputAllowance * this.limits.outputRate) / 1e6;
    if (this.accountedCostUsd + cost > this.limits.maxCostUsd + Number.EPSILON) {
      this.stopReason = 'estimated_cost_reservation_would_exceed_budget';
      throw new BudgetStop(this.stopReason);
    }
    this.calls++;
    this.accountedCostUsd += cost;
    return { cost, inputAllowance, outputAllowance };
  }
  settle(reservation: ReturnType<LiveBudget['reserve']>, input: unknown, output: unknown) {
    if (
      typeof input !== 'number' ||
      !Number.isSafeInteger(input) ||
      input < 0 ||
      typeof output !== 'number' ||
      !Number.isSafeInteger(output) ||
      output < 0
    ) {
      this.stopReason = 'unknown_provider_usage_reservation_retained';
      return;
    }
    const actualEstimate = (input * this.limits.inputRate + output * this.limits.outputRate) / 1e6;
    this.accountedCostUsd += actualEstimate - reservation.cost;
    this.observedCostUsd += actualEstimate;
    if (
      input > reservation.inputAllowance ||
      output > reservation.outputAllowance ||
      this.accountedCostUsd > this.limits.maxCostUsd
    )
      this.stopReason = 'provider_usage_exceeded_reservation_stop_and_review_pricing';
  }
  wrap(fetchImpl: typeof fetch = fetch): typeof fetch {
    return async (url, options) => {
      if (typeof options?.body !== 'string')
        throw new BudgetStop('Expected serialized request body');
      const reservation = this.reserve(options.body);
      try {
        const response = await fetchImpl(url, options);
        if (!response.ok) {
          this.stopReason = `provider_http_${response.status}_cost_unknown_reservation_retained`;
          return response;
        }
        try {
          const body = (await response.clone().json()) as {
            usage?: { input_tokens?: unknown; output_tokens?: unknown };
          };
          this.settle(reservation, body.usage?.input_tokens, body.usage?.output_tokens);
        } catch {
          this.stopReason = 'unreadable_provider_usage_reservation_retained';
        }
        return response;
      } catch (error) {
        this.stopReason = 'provider_transport_error_cost_unknown_reservation_retained';
        throw error;
      }
    };
  }
}
