import { useState } from 'react';
import { getOfferedStrategies, getSelectedOffer } from '../strategy-offers';
import { StrategyDashboard } from './StrategyDashboard';
import { EvidenceReferences } from './EvidenceReferences';
import { MarketplaceFees } from './MarketplaceFees';
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
  const objectiveLabel = {
    safe: 'Lợi nhuận thấp nhất trong ba kịch bản',
    balanced: '70% lợi nhuận cơ sở + 30% thấp nhất',
    growth: 'Doanh thu cơ sở',
  }[result.input.objective];
  const basketSubtotal = result.input.product.lines.reduce(
    (total, line) => total + line.unit_price_dong * line.quantity,
    0,
  );
  const discountedStrategies = result.strategies.filter((strategy) => strategy.discount_dong > 0);
  const baselineBaseScenario = baseline?.scenarios.find((item) => item.key === 'base');
  const baselineLeads = baseline?.id === result.recommended.id;
  return (
    <section aria-labelledby="results-heading" className="results-section">
      <div className="section-heading">
        <div>
          <h2 id="results-heading">
            {ai ? 'Ứng viên AI đã được engine kiểm tra' : 'Bức tranh lợi nhuận của bạn'}
          </h2>
        </div>
        <span className="pill">Mô phỏng theo giả định</span>
      </div>
      <p className="notice" data-testid="result-source-label">
        <strong>Nguồn kết quả: </strong>
        {ai
          ? 'AI tạo ứng viên; engine tính và xếp hạng cùng baseline.'
          : 'Mô phỏng engine theo đầu vào hiện tại; chưa dùng kết quả AI trong bảng này.'}
      </p>
      {baselineLeads && (
        <article className="card" data-testid="baseline-explanation">
          <h3>Vì sao “Không voucher” đứng đầu?</h3>
          {result.input.voucher.minimum_dong > basketSubtotal && (
            <p>
              Giỏ hiện tại {money(basketSubtotal)} thấp hơn minimum spend{' '}
              {money(result.input.voucher.minimum_dong)}: voucher bạn nhập không đủ điều kiện, nên
              giảm thực tế bằng 0đ. Mô hình giữ cố định giỏ hàng, không tự giả định khách mua thêm
              để đạt minimum spend.
            </p>
          )}
          {baselineBaseScenario?.stockout && (
            <p>
              Ngay cả khi không dùng voucher, kịch bản cơ sở đã chạm tồn kho (
              {count(baselineBaseScenario.orders)} đơn). Giảm giá không thể tăng số đơn vượt sức
              chứa tồn kho trong mô hình này.
            </p>
          )}
          <p>
            {discountedStrategies.length === 0
              ? `Sau kiểm tra và gộp các cấu hình có cùng hiệu quả, chỉ còn ${result.strategies.length} phương án không giảm tiền thực tế. Chưa có phương án giảm giá hiệu lực để so sánh với baseline.`
              : `Trong ${result.strategies.length} phương án đã tính, ${discountedStrategies.length} phương án có giảm giá không đạt điểm cao hơn baseline theo mục tiêu “${objectiveLabel}” dưới giả định hiện tại.`}
          </p>
          <p className="hint">
            Kết quả chỉ áp dụng cho tập ứng viên đã kiểm tra; không chứng minh “không voucher” là
            chiến lược tối ưu trên thị trường. Kiểm tra lại giỏ hàng, tồn kho và giả định
            traffic/CVR trước khi quyết định.
          </p>
        </article>
      )}
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
            ? 'Voucher nên chạy theo mục tiêu của bạn'
            : 'Phương án bạn đang xem'}
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
        <MarketplaceFees strategy={selected} />
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
        {ai && result.reference_evidence && result.reference_evidence.enabled && (
          <details className="advanced">
            <summary>Reference đã gửi cho AI</summary>
            <p className="hint">
              Đây là dữ liệu đã cung cấp trong request, không chứng minh AI đã dựa vào từng
              reference. Bản export giữ ID và phiên bản để kiểm tra lại.
            </p>
            <EvidenceReferences result={result.reference_evidence} />
          </details>
        )}
        <dl className="context-facts">
          <div>
            <dt>Mục tiêu</dt>
            <dd>{objectiveLabel}</dd>
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
            {result.decision_context.observed_cvr_bps !== null && (
              <p className="hint" data-testid="ai-observed-history">
                Lịch sử AI đã đọc: CVR quan sát {result.decision_context.observed_cvr_bps / 100}%
                {result.decision_context.observed_aov_dong !== null &&
                  ` · doanh thu / đơn ${money(result.decision_context.observed_aov_dong)}`}
              </p>
            )}
            <p className="hint" data-testid="ai-candidate-audit">
              Loại {count(result.rejected_candidates)} ứng viên AI không hợp lệ · prompt{' '}
              {result.prompt_version}
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
