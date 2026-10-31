import { Value } from '@sinclair/typebox/value';
import {
  parseRecommendationRequest,
  VoucherSchema,
  type Voucher,
  type RecommendationResult,
} from '@market-maker/contracts';
import { evaluateVouchers } from '../engine/index.ts';
import { generateCandidates, type ProviderOptions } from './openai.ts';
import { summarizeContext } from './context.ts';
import { PROMPT_VERSION } from './prompt.ts';
import { ProviderError } from './errors.ts';
import { retrieveEvidence } from '../evidence/retrieve.ts';

/** Candidate generation uses context; the deterministic engine alone decides ranking. */
export async function recommend(
  body: unknown,
  options: ProviderOptions = {},
): Promise<RecommendationResult> {
  const request = parseRecommendationRequest(body);
  if (options.signal?.aborted) throw new ProviderError(499, 'AI request cancelled');
  const decisionContext = summarizeContext(request.context);
  const referenceEvidence = await retrieveEvidence(request.input, request.context);
  if (options.signal?.aborted) throw new ProviderError(499, 'AI request cancelled');
  const proposal = await generateCandidates(
    { ...request, historical_summary: decisionContext, reference_evidence: referenceEvidence },
    options,
  );
  const valid: Voucher[] = proposal.candidates.filter(
    (candidate): candidate is Voucher =>
      Value.Check(VoucherSchema, candidate) &&
      candidate.seller_funding_bps === request.input.voucher.seller_funding_bps,
  );
  if (!valid.length)
    throw new ProviderError(
      502,
      'No valid AI candidates; seller funding and typed voucher rules must be preserved.',
    );
  const result = evaluateVouchers(request.input, valid);
  return {
    ...result,
    provider: 'openai',
    model: proposal.model,
    context: request.context,
    prompt_version: PROMPT_VERSION,
    provider_request_id: proposal.requestId,
    usage: proposal.usage,
    estimated_cost_usd: proposal.estimatedCostUsd,
    provider_attempts: proposal.attempts,
    reference_evidence: referenceEvidence,
    decision_context: decisionContext,
    rejected_candidates: proposal.candidates.length - valid.length,
  };
}
