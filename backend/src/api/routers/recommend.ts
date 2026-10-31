import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RouteContext } from '../types.ts';
import { errorSchemas } from '../http.ts';
import {
  parseRecommendationRequest,
  defaults,
  RecommendationRequestSchema,
  RecommendationResultSchema,
  type RecommendationRequest,
} from '../../../../contracts/model.ts';
import { HttpError } from '../http.ts';
/** No accounts in this MVP: the browser sends a random X-Client-Id; IP is the fallback. */
export function clientId(request: FastifyRequest) {
  const header = request.headers['x-client-id'];
  return typeof header === 'string' && /^[0-9a-f-]{36}$/i.test(header)
    ? `client:${header.toLowerCase()}`
    : `ip:${request.ip}`;
}
export function registerRecommendRoutes(app: FastifyInstance, context: RouteContext) {
  const { store, provider, aiConfigured, dailyAiLimit, aiBudgetUsd } = context;
  const errors = errorSchemas;
  let busy = false;
  app.post<{ Body: RecommendationRequest }>(
    '/api/recommend',
    {
      schema: {
        tags: ['AI'],
        summary: 'Generate candidates, deterministically rank and save the result',
        body: {
          ...RecommendationRequestSchema,
          examples: [
            {
              input: defaults,
              context: { seller_notes: 'Ưu tiên lợi nhuận, không vượt ngân sách.' },
            },
          ],
        },
        response: { 200: RecommendationResultSchema, ...errors },
      },
    },
    async (request, reply) => {
      const body = parseRecommendationRequest(request.body);
      if (!aiConfigured)
        throw new HttpError(503, 'Configure OPENAI_API_KEY and OPENAI_MODEL before using AI');
      if (busy)
        throw new HttpError(429, 'AI đang xử lý yêu cầu khác, vui lòng thử lại sau giây lát.');
      const client = clientId(request);
      const controller = new AbortController();
      const cancel = () => {
        if (!reply.raw.writableEnded)
          controller.abort(new DOMException('Client disconnected', 'AbortError'));
      };
      reply.raw.once('close', cancel);
      busy = true;
      try {
        if (!(await store.consumeAi(dailyAiLimit)))
          throw new HttpError(429, 'Đã hết lượt dùng AI hôm nay, vui lòng quay lại vào ngày mai.');
        if ((await store.aiSpentUsd(client)) >= aiBudgetUsd)
          throw new HttpError(
            402,
            `Bạn đã dùng hết hạn mức dùng thử AI (${aiBudgetUsd} USD). Liên hệ quản trị viên để được cấp thêm.`,
          );
        controller.signal.throwIfAborted();
        const result = await provider(body, { signal: controller.signal });
        const run = await store.save('recommend', result.input, result);
        await store.recordAi({
          clientId: client,
          runId: run.id,
          model: result.model,
          requestId: result.provider_request_id,
          promptVersion: result.prompt_version,
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          costUsd: result.estimated_cost_usd,
          attempts: result.provider_attempts ?? 1,
          context: { context: result.context, decision_context: result.decision_context },
        });
        return result;
      } finally {
        reply.raw.off('close', cancel);
        busy = false;
      }
    },
  );
}
const usageCallSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    createdAt: { type: 'string' },
    runId: { type: 'string' },
    model: { type: 'string' },
    requestId: { type: 'string' },
    promptVersion: { type: 'string' },
    inputTokens: { type: ['integer', 'null'] },
    outputTokens: { type: ['integer', 'null'] },
    costUsd: { type: ['number', 'null'] },
    attempts: { type: 'integer' },
    context: { type: 'object', additionalProperties: true },
  },
};
export function registerUsageRoutes(app: FastifyInstance, context: RouteContext) {
  const { store, aiBudgetUsd } = context;
  app.get(
    '/api/usage',
    {
      schema: {
        tags: ['AI'],
        summary: "Caller's AI trial budget and latest 50 calls (model, tokens, cost, context)",
        response: {
          200: {
            type: 'object',
            required: ['limitUsd', 'spentUsd', 'remainingUsd', 'calls'],
            properties: {
              limitUsd: { type: 'number' },
              spentUsd: { type: 'number' },
              remainingUsd: { type: 'number' },
              calls: { type: 'array', items: usageCallSchema },
            },
          },
          ...errorSchemas,
        },
      },
    },
    async (request) => {
      const client = clientId(request);
      const [spentUsd, calls] = await Promise.all([store.aiSpentUsd(client), store.listAi(client)]);
      return {
        limitUsd: aiBudgetUsd,
        spentUsd,
        remainingUsd: Math.max(0, aiBudgetUsd - spentUsd),
        calls,
      };
    },
  );
}
