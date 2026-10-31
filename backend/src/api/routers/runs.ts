import type { FastifyInstance } from 'fastify';
import type { RouteContext } from '../types.ts';
import { errorSchemas } from '../http.ts';
import { HttpError, problemSchema } from '../http.ts';
export function registerRunsRoutes(app: FastifyInstance, context: RouteContext) {
  const { store } = context;
  const errors = errorSchemas;
  const runSchema = {
    type: 'object',
    required: ['id', 'createdAt', 'kind', 'schemaVersion', 'input', 'result'],
    properties: {
      id: { type: 'string' },
      createdAt: { type: 'string' },
      kind: { enum: ['evaluate', 'recommend'] },
      schemaVersion: { const: '2.0' },
      input: { type: 'object', additionalProperties: true },
      result: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  };
  app.get(
    '/api/runs',
    {
      schema: {
        tags: ['history'],
        summary: 'Latest 50 runs in the shared workspace',
        response: {
          200: {
            type: 'object',
            required: ['runs'],
            properties: { runs: { type: 'array', items: runSchema } },
          },
          ...errors,
        },
      },
    },
    async () => ({ runs: await store.list() }),
  );
  app.get<{ Params: { id: string } }>(
    '/api/runs/:id',
    {
      schema: {
        tags: ['history'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
          additionalProperties: false,
        },
        response: { 200: runSchema, 404: problemSchema, ...errors },
      },
    },
    async (request) => {
      const row = await store.get(request.params.id);
      if (!row) throw new HttpError(404, 'Run not found');
      return row;
    },
  );
}
