import { defaults, parseInput, type EvaluationInput, type RecommendationRequest } from './model.ts';
/** JSON-safe examples use the same canonical contract as all clients. */
export const exampleInput: EvaluationInput = structuredClone(defaults);
export const exampleBasket: EvaluationInput = parseInput({
  ...structuredClone(defaults),
  product: {
    name: 'Combo phục hồi',
    lines: [
      {
        sku_id: 'SERUM-30',
        quantity: 1,
        unit_price_dong: 299000,
        unit_cost_dong: 125000,
        packaging_dong: 3000,
        stock_units: 500,
      },
      {
        sku_id: 'CREAM-50',
        quantity: 1,
        unit_price_dong: 199000,
        unit_cost_dong: 80000,
        packaging_dong: 2000,
        stock_units: 200,
      },
    ],
  },
  voucher: { type: 'fixed', amount_dong: 50000, minimum_dong: 400000, seller_funding_bps: 10000 },
});
export const exampleRecommendationRequest: RecommendationRequest = {
  input: exampleInput,
  context: {
    seller_notes: 'Ưu tiên lợi nhuận; lịch sử dưới đây là số liệu tự nhập, chưa hiệu chuẩn.',
    history: {
      source: 'user_reported',
      campaigns: [
        {
          label: 'Đợt thử nghiệm trước',
          visits: 3000,
          orders: 90,
          revenue_dong: 24000000,
          voucher_spend_dong: 1500000,
        },
      ],
    },
  },
};
