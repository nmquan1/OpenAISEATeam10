import type { FastifyInstance } from 'fastify';
import type { RouteContext } from '../types.ts';
import { errorSchemas } from '../http.ts';
import { evaluate } from '../../engine/index.ts';
import {
  parseRequest,
  defaults,
  EvaluationRequestSchema,
  EvaluationResultSchema,
  type EvaluationInput,
} from '../../../../contracts/model.ts';
export function registerEvaluateRoutes(app: FastifyInstance, context: RouteContext) {
  const { store } = context;
  const errors = errorSchemas;
  app.post<{ Body: { input: EvaluationInput } }>(
    '/api/evaluate',
    {
      schema: {
        tags: ['simulation'],
        summary: 'Compare baseline, measured and current vouchers',
        body: { ...EvaluationRequestSchema, examples: [{ input: defaults }] },
        response: { 200: EvaluationResultSchema, ...errors },
      },
    },
    async (request) => {
      const result = evaluate(parseRequest(request.body).input);
      await store.save('evaluate', result.input, result);
      return result;
    },
  );
}
