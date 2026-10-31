import type { FastifyInstance } from 'fastify';
import type { RouteContext } from '../types.ts';
export function registerHealthRoutes(app: FastifyInstance, context: RouteContext) {
  const { aiConfigured, modelConfigured } = context;
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['status'],
        summary: 'Liveness and safe configuration readiness',
        response: {
          200: {
            type: 'object',
            required: ['status', 'schema_version', 'mode', 'aiConfigured', 'modelConfigured'],
            properties: {
              status: { const: 'ok' },
              schema_version: { const: '2.0' },
              mode: { const: 'scenario_only' },
              aiConfigured: { type: 'boolean' },
              modelConfigured: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      schema_version: '2.0',
      mode: 'scenario_only',
      aiConfigured: aiConfigured,
      modelConfigured: modelConfigured,
    }),
  );
}
