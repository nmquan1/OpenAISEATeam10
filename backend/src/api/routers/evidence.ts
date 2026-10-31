import type { FastifyInstance } from 'fastify';
import {
  RecommendationRequestSchema,
  parseRecommendationRequest,
  defaults,
} from '@market-maker/contracts';
import { RetrievalResultSchema } from '@market-maker/contracts/evidence';
import { retrieveEvidence } from '../../evidence/retrieve.ts';
import { errorSchemas } from '../http.ts';

export function registerEvidenceRoutes(app: FastifyInstance) {
  app.post(
    '/api/evidence/retrieve',
    {
      schema: {
        tags: ['evidence'],
        summary: 'Preview foreign historical references without calling OpenAI',
        body: {
          ...RecommendationRequestSchema,
          examples: [
            {
              input: defaults,
              context: { seller_notes: '', reference_query: 'source:cj cat litter cat food' },
            },
          ],
        },
        response: { 200: RetrievalResultSchema, ...errorSchemas },
      },
    },
    async (request) => {
      const { input, context } = parseRecommendationRequest(request.body);
      return retrieveEvidence(input, context);
    },
  );
}
