import { CandidateProposalSchema } from '@market-maker/contracts';
import { ProviderError } from './errors.ts';
import { SYSTEM_PROMPT } from './prompt.ts';

export interface ProviderOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}
export interface CandidateResponse {
  candidates: unknown[];
  model: string;
  requestId: string;
  usage: { input_tokens: number | null; output_tokens: number | null };
  estimatedCostUsd: number | null;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A transport adapter only: never computes demand or changes seller inputs. */
export async function generateCandidates(
  payload: unknown,
  options: ProviderOptions = {},
): Promise<CandidateResponse> {
  const env = options.env ?? process.env;
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
    throw new ProviderError(
      503,
      'Điền OPENAI_API_KEY và OPENAI_MODEL trong .env rồi khởi động lại.',
    );
  }
  const timeout = Number(env.OPENAI_TIMEOUT_MS ?? 60000);
  const maxTokens = Number(env.OPENAI_MAX_OUTPUT_TOKENS ?? 4096);
  if (
    !Number.isInteger(timeout) ||
    timeout < 1000 ||
    timeout > 120000 ||
    !Number.isInteger(maxTokens) ||
    maxTokens < 256 ||
    maxTokens > 8192
  ) {
    throw new ProviderError(
      503,
      'AI timeout must be 1000..120000 ms and max output tokens 256..8192.',
    );
  }
  const signal = AbortSignal.any([
    AbortSignal.timeout(timeout),
    ...(options.signal ? [options.signal] : []),
  ]);
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        store: false,
        max_output_tokens: maxTokens,
        instructions: SYSTEM_PROMPT,
        input: JSON.stringify(payload),
        text: {
          format: {
            type: 'json_schema',
            name: 'voucher_candidates',
            strict: true,
            schema: CandidateProposalSchema,
          },
        },
      }),
    });
    if (!response.ok)
      throw new ProviderError(
        502,
        `OpenAI request failed (${response.status}); check model access, credentials and quota.`,
      );
    const data: unknown = await response.json();
    if (!record(data) || data.status !== 'completed' || !Array.isArray(data.output))
      throw new ProviderError(
        502,
        'OpenAI response incomplete; retry or check output token limit.',
      );
    const texts: string[] = [];
    for (const item of data.output) {
      if (!record(item) || (item.content !== undefined && !Array.isArray(item.content)))
        throw new ProviderError(502, 'OpenAI returned an invalid response envelope.');
      for (const content of (item.content as unknown[] | undefined) ?? []) {
        if (record(content) && content.type === 'output_text' && typeof content.text === 'string')
          texts.push(content.text);
      }
    }
    let proposal: unknown;
    try {
      proposal = JSON.parse(texts.join(''));
    } catch {
      throw new ProviderError(502, 'OpenAI did not return valid candidate JSON.');
    }
    if (
      !record(proposal) ||
      Object.keys(proposal).join() !== 'candidates' ||
      !Array.isArray(proposal.candidates) ||
      proposal.candidates.length < 1 ||
      proposal.candidates.length > 5
    )
      throw new ProviderError(502, 'OpenAI must return 1–5 candidates.');
    const usage = record(data.usage) ? data.usage : {};
    const tokenCount = (value: unknown) =>
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    const tokens = {
      input_tokens: tokenCount(usage.input_tokens),
      output_tokens: tokenCount(usage.output_tokens),
    };
    const inputRate = Number(env.OPENAI_INPUT_USD_PER_MILLION);
    const outputRate = Number(env.OPENAI_OUTPUT_USD_PER_MILLION);
    const rawCostUsd =
      tokens.input_tokens !== null &&
      tokens.output_tokens !== null &&
      env.OPENAI_INPUT_USD_PER_MILLION &&
      env.OPENAI_OUTPUT_USD_PER_MILLION &&
      Number.isFinite(inputRate) &&
      Number.isFinite(outputRate) &&
      inputRate >= 0 &&
      outputRate >= 0
        ? (tokens.input_tokens * inputRate + tokens.output_tokens * outputRate) / 1e6
        : null;
    const estimatedCostUsd = rawCostUsd !== null && Number.isFinite(rawCostUsd) ? rawCostUsd : null;
    return {
      candidates: proposal.candidates,
      model: typeof data.model === 'string' ? data.model : env.OPENAI_MODEL,
      requestId:
        response.headers.get('x-request-id') ??
        (typeof data.id === 'string' ? data.id : 'unavailable'),
      usage: tokens,
      estimatedCostUsd,
    };
  } catch (error) {
    // Fetch headers AND body parsing share cancellation and timeout classification.
    if (signal.aborted) {
      if (signal.reason?.name === 'TimeoutError')
        throw new ProviderError(504, 'OpenAI timeout; thử lại.');
      throw new ProviderError(499, 'Request cancelled.');
    }
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new ProviderError(504, 'OpenAI timeout; thử lại.');
    throw new ProviderError(502, 'OpenAI provider unavailable or returned invalid JSON.');
  }
}
