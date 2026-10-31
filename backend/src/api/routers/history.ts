import type { FastifyInstance } from 'fastify';
import type { RouteContext } from '../types.ts';
import { errorSchemas } from '../http.ts';
import {
  validateHistoryCsv,
  HistoryValidationRequestSchema,
  HistoryValidationResultSchema,
} from '../../history/validate.ts';
export function registerHistoryRoutes(app: FastifyInstance, _context: RouteContext) {
  app.post(
    '/api/history/validate',
    {
      schema: {
        tags: ['history'],
        summary: 'Validate user-reported CSV without calibrating the forecast',
        body: {
          ...HistoryValidationRequestSchema,
          examples: [
            {
              csv: 'label,visits,orders,revenue_dong,voucher_spend_dong\nSale trước,1000,30,8970000,300000',
            },
          ],
        },
        response: { 200: HistoryValidationResultSchema, ...errorSchemas },
      },
    },
    async (request) => validateHistoryCsv(request.body),
  );
}
