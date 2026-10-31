import type { RecommendationRequest } from '@market-maker/contracts';

/** Historical aggregates are evidence for candidate generation, never causal forecasts. */
export function summarizeContext(context: RecommendationRequest['context']) {
  const campaigns = context.history?.campaigns ?? [];
  const totals = campaigns.reduce(
    (sum, campaign) => ({
      visits: sum.visits + campaign.visits,
      orders: sum.orders + campaign.orders,
      revenue: sum.revenue + campaign.revenue_dong,
    }),
    { visits: 0, orders: 0, revenue: 0 },
  );
  return {
    history_source: campaigns.length ? ('user_reported' as const) : ('none' as const),
    campaign_count: campaigns.length,
    observed_cvr_bps: totals.visits ? Math.round((totals.orders * 10000) / totals.visits) : null,
    observed_aov_dong: totals.orders ? Math.round(totals.revenue / totals.orders) : null,
    applied_to_forecast: false as const,
    ranking_basis:
      'Engine tính lại tất cả voucher bằng cùng giỏ hàng, đường đáp ứng CVR và mục tiêu đã nhập.',
    context_effect:
      'Lịch sử và lời mô tả chỉ giúp OpenAI đề xuất mức giảm/minimum/cap; không tự thay đổi giá vốn, phí, tồn, ngân sách hay dự báo.',
    field_effects: [
      'Giá, giá vốn, đóng gói, phí, thuế, shipping, ads và hoàn hàng quyết định lợi nhuận từng đơn.',
      'Tồn từng SKU, số lượng trong giỏ, quota và ngân sách giới hạn số đơn và lượt voucher.',
      'Visits, CVR và đường đáp ứng theo mức giảm là giả định trực tiếp quyết định nhu cầu; chưa học từ lịch sử.',
      'Mục tiêu safe/balanced/growth quyết định cách xếp hạng, không thay công thức lợi nhuận.',
      'Lịch sử là aggregate do người dùng khai báo; thiếu đối chứng/attribution nên không suy ra tác động nhân quả.',
    ],
  };
}
