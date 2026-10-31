import { useState } from 'react';
import { getOfferedStrategies, getSelectedOffer } from '../strategy-offers';
import { StrategyDashboard } from './StrategyDashboard';
import type { EvaluationResult, RecommendationResult, Voucher } from '@market-maker/contracts';
import {
  count,
  money,
  scenarioLabels,
  type DecisionContext,
  type ScenarioKey,
  type Strategy,
} from '../types';

export function describeVoucher(voucher: Voucher) {
  return voucher.type === 'fixed'
    ? `Giảm ${money(voucher.amount_dong)}`
    : `Giảm ${voucher.rate_bps / 100}% · tối đa ${money(voucher.cap_dong)}`;
}
export function Results({
  result,
  selectedId,
  onSelect,
  onApply,
  onExport,
  context,
}: {
  result: EvaluationResult | RecommendationResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApply: (strategy: Strategy) => void;
  onExport: () => void;
  context: DecisionContext;
}) {
  const [scenario, setScenario] = useState<ScenarioKey>('base');
  const offeredStrategies = getOfferedStrategies(result);
  const selected = getSelectedOffer(result, selectedId);
  const row = selected.scenarios.find((item) => item.key === scenario)!;
  const baseline = result.strategies.find((strategy) => strategy.discount_dong === 0);
  const ai = 'provider' in result;
  const contextUsed = ai ? result.context : context;
  return (
    <section aria-labelledby="results-heading" className="results-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 · SO SÁNH & QUYẾT ĐỊNH</p>
          <h2 id="results-heading">
            {ai ? 'Ứng viên AI đã được engine kiểm tra' : 'Bức tranh lợi nhuận của bạn'}
          </h2>
        </div>
        <span className="pill">Mô phỏng theo giả định</span>
      </div>
      <article className="card">
        <div className="section-heading">
          <h3>Top {offeredStrategies.length} chiến lược</h3>
          <span className="pill">Kịch bản {scenarioLabels[scenario].toLowerCase()}</span>
        </div>
        <p className="hint">
          Tối đa 5 chiến lược theo mục tiêu đã chọn. Chọn một hàng để mở dashboard và xuất phương
          án; thứ hạng giữ nguyên khi xem các kịch bản traffic.
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Bảng so sánh chiến lược, cuộn ngang nếu cần"
        >
          <table>
            <caption className="sr-only">
              Chiến lược tại traffic {scenarioLabels[scenario].toLowerCase()}
            </caption>
            <thead>
              <tr>
                <th scope="col">Chọn chiến lược</th>
                <th scope="col">Giảm / giỏ</th>
                <th scope="col">Đơn</th>
                <th scope="col">Doanh thu</th>
                <th scope="col">Chi shop</th>
                <th scope="col">Lợi nhuận</th>
              </tr>
            </thead>
            <tbody>
              {offeredStrategies.map((strategy, index) => {
                const item = strategy.scenarios.find((value) => value.key === scenario)!;
                return (
                  <tr
                    key={strategy.id}
                    className={selected.id === strategy.id ? 'selected-row' : undefined}
                  >
                    <th scope="row">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="selected-strategy"
                          value={strategy.id}
                          checked={selected.id === strategy.id}
                          onChange={() => onSelect(strategy.id)}
                        />
                        <span>
                          <span className="strategy-rank">#{index + 1}</span> {strategy.name}
                          {strategy.id === result.recommended.id && (
                            <small>Đề xuất theo tiêu chí</small>
                          )}
                        </span>
                      </label>
                    </th>
                    <td>{money(strategy.discount_dong)}</td>
                    <td>{count(item.orders)}</td>
                    <td>{money(item.revenue_dong)}</td>
                    <td>{money(item.spend_dong)}</td>
                    <td className={item.profit_dong < 0 ? 'negative' : 'positive'}>
                      {money(item.profit_dong)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
      <article className="card recommendation">
        <p className="eyebrow">
          {selected.id === result.recommended.id
            ? 'ĐỨNG ĐẦU THEO TIÊU CHÍ ĐÃ CHỌN'
            : 'PHƯƠNG ÁN BẠN ĐANG CHỌN'}
        </p>
        <h3>{selected.name}</h3>
        <p>{describeVoucher(selected.voucher)}</p>
        <p className="hint">
          Giỏ từ {money(selected.voucher.minimum_dong)} · shop tài trợ{' '}
          {selected.voucher.seller_funding_bps / 100}% · giảm thực tế{' '}
          {money(selected.discount_dong)} / giỏ đủ điều kiện.
        </p>
        <StrategyDashboard
          strategy={selected}
          scenario={scenario}
          onScenarioChange={setScenario}
          baseline={baseline}
          constraints={result.input.constraints}
        />
        {row.profit_dong < 0 && (
          <p className="notice error">
            Phương án đang lỗ ở kịch bản này. Kiểm tra giá vốn, phí và voucher trước khi triển khai.
          </p>
        )}
        {row.stockout && (
          <p className="notice">
            Nhu cầu chạm giới hạn tồn kho của giỏ. Kết quả đã giới hạn số đơn theo SKU.
          </p>
        )}
        {row.exhausted && (
          <p className="notice">
            Voucher có thể hết quota hoặc ngân sách. Đơn vượt giới hạn không nhận thêm hiệu ứng
            voucher.
          </p>
        )}
        <div className="actions">
          <button type="button" className="primary" onClick={onExport}>
            ↓ Xuất phương án đang chọn
          </button>
          {ai && (
            <button type="button" className="secondary" onClick={() => onApply(selected)}>
              Áp dụng voucher vào thiết lập
            </button>
          )}
        </div>
        <p className="hint">
          Bản xuất gồm phương án đang chọn, các kết quả so sánh, đầu vào và bối cảnh. Áp dụng chỉ
          đổi thiết lập của app; không gửi lên Shopee.
        </p>
      </article>
      <article className="card decision-context">
        <h3>Quyết định này dựa trên điều gì?</h3>
        <dl className="context-facts">
          <div>
            <dt>Mục tiêu</dt>
            <dd>
              {
                {
                  safe: 'Lợi nhuận thấp nhất trong ba kịch bản',
                  balanced: '70% lợi nhuận cơ sở + 30% thấp nhất',
                  growth: 'Doanh thu cơ sở',
                }[result.input.objective]
              }
            </dd>
          </div>
          <div>
            <dt>Dữ liệu & mô hình</dt>
            <dd>
              Thông số do người bán nhập · engine {result.engine_version} · chưa hiệu chỉnh từ lịch
              sử
            </dd>
          </div>
          {ai && (
            <div>
              <dt>Ứng viên AI</dt>
              <dd>
                {result.provider} · {result.model} · engine tính lại toàn bộ số liệu
              </dd>
            </div>
          )}
        </dl>
        {contextUsed.seller_notes && (
          <p className="quoted-note">Ghi chú người bán: {contextUsed.seller_notes}</p>
        )}
        {contextUsed.history && (
          <p className="hint">
            Có {contextUsed.history.campaigns.length} đợt sale tổng hợp do người dùng cung cấp. Lịch
            sử không tự thay traffic/CVR hoặc trở thành forecast.
          </p>
        )}
        {ai && (
          <div className="context-impact">
            <h4>Bối cảnh đã ảnh hưởng như thế nào?</h4>
            <p>{result.decision_context.context_effect}</p>
            <p className="hint">
              Nguồn:{' '}
              {result.decision_context.history_source === 'user_reported'
                ? 'lịch sử do bạn cung cấp'
                : 'chưa có lịch sử'}{' '}
              · {result.decision_context.campaign_count} đợt sale · không tự áp dụng vào forecast.
            </p>
            <ul>
              {result.decision_context.field_effects.map((effect, index) => (
                <li key={index}>{effect}</li>
              ))}
            </ul>
            <p className="hint">Xếp hạng: {result.decision_context.ranking_basis}</p>
            {result.estimated_cost_usd !== null && (
              <p className="hint">
                Chi phí AI ước tính: {result.estimated_cost_usd.toFixed(6)} USD ·{' '}
                {result.usage.input_tokens === null
                  ? 'chưa có số liệu'
                  : count(result.usage.input_tokens)}{' '}
                token vào /{' '}
                {result.usage.output_tokens === null
                  ? 'chưa có số liệu'
                  : count(result.usage.output_tokens)}{' '}
                token ra.
              </p>
            )}
          </div>
        )}
        <details>
          <summary>Giới hạn cần hiểu trước khi quyết định</summary>
          <ul>
            {result.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </details>
      </article>
    </section>
  );
}
