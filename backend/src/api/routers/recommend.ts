import type { FastifyInstance } from 'fastify';
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
export function registerRecommendRoutes(app: FastifyInstance, context: RouteContext) {
  const { store, provider, aiConfigured, dailyAiLimit } = context;
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
      if (busy) throw new HttpError(429, 'AI capacity busy; retry shortly');
      const controller = new AbortController();
      const cancel = () => {
        if (!reply.raw.writableEnded)
          controller.abort(new DOMException('Client disconnected', 'AbortError'));
      };
      reply.raw.once('close', cancel);
      busy = true;
      try {
        if (!(await store.consumeAi(dailyAiLimit)))
          throw new HttpError(429, 'Daily AI call limit reached (UTC); try tomorrow');
        controller.signal.throwIfAborted();
        const result = await provider(body, { signal: controller.signal });
        await store.save('recommend', result.input, result);
        return result;
      } finally {
        reply.raw.off('close', cancel);
        busy = false;
      }
    },
  );
}
