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
  attempts: number;
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
      'Dịch vụ AI chưa được cấu hình đúng.',
      'OPENAI_TIMEOUT_MS must be 1000..120000 and OPENAI_MAX_OUTPUT_TOKENS 256..8192',
    );
  }
  const retries = Number(env.OPENAI_MAX_RETRIES ?? 2);
  if (!Number.isInteger(retries) || retries < 0 || retries > 5)
    throw new ProviderError(
      503,
      'Dịch vụ AI chưa được cấu hình đúng.',
      'OPENAI_MAX_RETRIES must be 0..5',
    );
  for (let attempt = 1; ; attempt++) {
    try {
      return {
        ...(await attemptOnce(payload, env, timeout, maxTokens, options)),
        attempts: attempt,
      };
    } catch (error) {
      if (
        !(error instanceof ProviderError && error.retryable) ||
        attempt > retries ||
        options.signal?.aborted
      )
        throw error;
      await new Promise((done) => setTimeout(done, 500 * 2 ** (attempt - 1)));
    }
  }
}

/** Maps an OpenAI error body to a user-safe message; raw detail stays in `internal`. */
async function upstreamError(response: Response): Promise<ProviderError> {
  let code = '';
  let message = '';
  try {
    const body = (await response.json()) as {
      error?: { code?: string; type?: string; message?: string };
    };
    code = body.error?.code ?? body.error?.type ?? '';
    message = body.error?.message ?? '';
  } catch {
    // Non-JSON error bodies are classified by status alone.
  }
  const internal = `OpenAI ${response.status} ${code}: ${message}`.slice(0, 500);
  if (response.status === 401 || response.status === 403)
    return new ProviderError(
      503,
      'Dịch vụ AI tạm thời không khả dụng. Vui lòng báo quản trị viên.',
      internal,
    );
  if (response.status === 429 && code === 'insufficient_quota')
    return new ProviderError(
      503,
      'Hệ thống AI đã hết hạn mức chung. Vui lòng thử lại sau hoặc báo quản trị viên.',
      internal,
    );
  if (response.status === 429)
    return new ProviderError(429, 'AI đang quá tải, vui lòng thử lại sau ít phút.', internal, true);
  if (response.status >= 500)
    return new ProviderError(
      502,
      'Dịch vụ AI đang gặp sự cố, vui lòng thử lại sau.',
      internal,
      true,
    );
  if (code === 'context_length_exceeded')
    return new ProviderError(
      422,
      'Dữ liệu bối cảnh quá dài, hãy rút gọn ghi chú hoặc lịch sử rồi thử lại.',
      internal,
    );
  return new ProviderError(502, 'AI không xử lý được yêu cầu này. Vui lòng thử lại.', internal);
}

async function attemptOnce(
  payload: unknown,
  env: NodeJS.ProcessEnv,
  timeout: number,
  maxTokens: number,
  options: ProviderOptions,
): Promise<Omit<CandidateResponse, 'attempts'>> {
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
    if (!response.ok) throw await upstreamError(response);
    const data: unknown = await response.json();
    if (!record(data) || data.status !== 'completed' || !Array.isArray(data.output))
      throw new ProviderError(
        502,
        'AI trả kết quả chưa đầy đủ, vui lòng thử lại.',
        `incomplete response: ${record(data) ? JSON.stringify(data.incomplete_details ?? data.status) : 'non-object'}`,
      );
    const texts: string[] = [];
    for (const item of data.output) {
      if (!record(item) || (item.content !== undefined && !Array.isArray(item.content)))
        throw new ProviderError(
          502,
          'AI trả kết quả không hợp lệ, vui lòng thử lại.',
          'invalid envelope',
        );
      for (const content of (item.content as unknown[] | undefined) ?? []) {
        if (record(content) && content.type === 'output_text' && typeof content.text === 'string')
          texts.push(content.text);
      }
    }
    let proposal: unknown;
    try {
      proposal = JSON.parse(texts.join(''));
    } catch {
      throw new ProviderError(
        502,
        'AI trả kết quả không hợp lệ, vui lòng thử lại.',
        'invalid candidate JSON',
      );
    }
    if (
      !record(proposal) ||
      Object.keys(proposal).join() !== 'candidates' ||
      !Array.isArray(proposal.candidates) ||
      proposal.candidates.length < 1 ||
      proposal.candidates.length > 5
    )
      throw new ProviderError(
        502,
        'AI trả kết quả không hợp lệ, vui lòng thử lại.',
        'expected 1-5 candidates',
      );
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
      model: typeof data.model === 'string' ? data.model : env.OPENAI_MODEL!,
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
        throw new ProviderError(504, 'AI phản hồi quá lâu, vui lòng thử lại.', 'timeout', true);
      throw new ProviderError(499, 'Yêu cầu đã bị huỷ.');
    }
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new ProviderError(504, 'AI phản hồi quá lâu, vui lòng thử lại.', 'timeout', true);
    throw new ProviderError(
      502,
      'Không kết nối được dịch vụ AI, vui lòng thử lại.',
      'network',
      true,
    );
  }
}
