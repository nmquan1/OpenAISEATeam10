import type { FastifyInstance } from 'fastify';
import { planPortfolio } from '../../engine/portfolio.ts';
import { errorSchemas } from '../http.ts';
import {
  StrategyRequestSchema,
  PortfolioResultSchema,
  exampleStrategyRequest,
  type StrategyRequest,
} from '../../../../contracts/portfolio.ts';

export function registerStrategyRoutes(app: FastifyInstance) {
  app.post<{ Body: StrategyRequest }>(
    '/api/strategy',
    {
      schema: {
        tags: ['portfolio'],
        summary: 'Plan a heuristic voucher portfolio with allocation and stacking checks',
        description:
          'Uses the versioned fee catalog and a sampled basket. Not a sales forecast or an exhaustive guarantee of margin.',
        body: { ...StrategyRequestSchema, examples: [exampleStrategyRequest] },
        response: { 200: PortfolioResultSchema, ...errorSchemas },
      },
    },
    async (request) => planPortfolio(request.body),
  );
}
