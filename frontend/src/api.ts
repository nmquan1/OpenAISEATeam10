import {
  defaults,
  parseRecommendationRequest,
  parseInput,
  parseEvaluationResult,
  parseRecommendationResult,
  type EvaluationInput,
  type RecommendationRequest,
} from '@market-maker/contracts';
import type { AiUsage, Health, Run } from './types';
import { parseRetrievalResult } from '@market-maker/contracts/evidence';
import {
  parseStrategyRequest,
  parsePortfolioResult,
  type StrategyRequest,
} from '@market-maker/contracts/portfolio';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

/** Anonymous per-browser id so the backend can track each person's AI trial budget. */
function clientId() {
  try {
    let id = localStorage.getItem('market-maker-client-id');
    if (!id) localStorage.setItem('market-maker-client-id', (id = crypto.randomUUID()));
    return id;
  } catch {
    return undefined;
  }
}

async function request(path: string, options: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(clientId() ? { 'X-Client-Id': clientId()! } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Không kết nối được server. Hãy kiểm tra kết nối hoặc chờ backend khởi động lại.',
      0,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'Server chưa sẵn sàng hoặc trả về dữ liệu không hợp lệ. Vui lòng thử lại.',
      response.status,
    );
  }
  if (!response.ok) {
    const problem = data as { detail?: unknown; error?: unknown; requestId?: string };
    const detail =
      typeof problem.detail === 'string'
        ? problem.detail
        : typeof problem.error === 'string'
          ? problem.error
          : 'Yêu cầu chưa thành công.';
    throw new ApiError(detail, response.status, problem.requestId);
  }
  return data;
}

export async function getHealth(signal: AbortSignal): Promise<Health> {
  const data = (await request('/health', { signal })) as Partial<Health>;
  if (typeof data.aiConfigured !== 'boolean') {
    throw new ApiError(
      'Backend chưa hỗ trợ phiên bản ứng dụng này. Cần cập nhật frontend và backend cùng phiên bản.',
      502,
    );
  }
  return data as Health;
}
export async function evaluate(input: EvaluationInput, signal: AbortSignal) {
  return parseEvaluationResult(
    await request('/evaluate', { method: 'POST', body: JSON.stringify({ input }), signal }),
  );
}
export async function recommend(body: RecommendationRequest, signal: AbortSignal) {
  return parseRecommendationResult(
    await request('/recommend', { method: 'POST', body: JSON.stringify(body), signal }),
  );
}
export async function retrieveEvidence(body: RecommendationRequest, signal: AbortSignal) {
  return parseRetrievalResult(
    await request('/evidence/retrieve', {
      method: 'POST',
      body: JSON.stringify(parseRecommendationRequest(body)),
      signal,
    }),
  );
}
export async function planPortfolio(body: StrategyRequest, signal: AbortSignal) {
  return parsePortfolioResult(
    await request('/strategy', {
      method: 'POST',
      body: JSON.stringify(parseStrategyRequest(body)),
      signal,
    }),
  );
}
export async function getUsage(signal: AbortSignal): Promise<AiUsage> {
  return (await request('/usage', { signal })) as AiUsage;
}
export async function getRuns(signal: AbortSignal): Promise<Run[]> {
  const data = (await request('/runs', { signal })) as { runs?: Run[] };
  if (!Array.isArray(data.runs)) throw new ApiError('Lịch sử trả về không đúng cấu trúc.', 502);
  return data.runs.map((run) => {
    if (
      !run ||
      typeof run.id !== 'string' ||
      typeof run.createdAt !== 'string' ||
      typeof run.kind !== 'string'
    )
      throw new ApiError('Lịch sử trả về thiếu thông tin lần chạy.', 502);
    return {
      ...run,
      input: parseInput(run.input),
      result:
        run.result && 'provider' in run.result
          ? parseRecommendationResult(run.result)
          : parseEvaluationResult(run.result),
    };
  });
}

export async function validateHistory(csv: string, signal: AbortSignal) {
  const history = await request('/history/validate', {
    method: 'POST',
    body: JSON.stringify({ csv }),
    signal,
  });
  return parseRecommendationRequest({ input: defaults, context: { seller_notes: '', history } })
    .context.history!;
}
