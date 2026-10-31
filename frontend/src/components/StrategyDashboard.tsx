import { useState } from 'react';
import type { EvaluationResult } from '@market-maker/contracts';
import { count, money, scenarioLabels, type ScenarioKey, type Strategy } from '../types';

const chartMetrics = {
  revenue_dong: 'Doanh thu',
  profit_dong: 'Lợi nhuận',
  spend_dong: 'Shop chi voucher',
} as const;
type ChartMetric = keyof typeof chartMetrics;
const scenarioKeys: ScenarioKey[] = ['low', 'base', 'high'];

export function StrategyDashboard({
  strategy,
  scenario,
  onScenarioChange,
  baseline,
  constraints,
}: {
  strategy: Strategy;
  scenario: ScenarioKey;
  onScenarioChange: (scenario: ScenarioKey) => void;
  baseline?: Strategy;
  constraints: EvaluationResult['input']['constraints'];
}) {
  const [metric, setMetric] = useState<ChartMetric>('profit_dong');
  const row = strategy.scenarios.find((item) => item.key === scenario)!;
  const baselineRow = baseline?.scenarios.find((item) => item.key === scenario);
  const rows = scenarioKeys.map((key) => strategy.scenarios.find((item) => item.key === key)!);
  const chartMaximum = Math.max(0, ...rows.map((item) => item[metric]));
  const chartMinimum = Math.min(0, ...rows.map((item) => item[metric]));
  const chartRange = chartMaximum - chartMinimum || 1;
  const zeroFromBottom = (-chartMinimum / chartRange) * 100;
  const profitDifference = baselineRow ? row.profit_dong - baselineRow.profit_dong : null;

  return (
    <section className="strategy-dashboard" aria-label={`Dashboard chiến lược ${strategy.name}`}>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Ước tính cho cả chiến dịch</p>
          <h4>Kịch bản {scenarioLabels[scenario].toLowerCase()}</h4>
        </div>
        <div className="toggle" role="group" aria-label="Kịch bản traffic">
          {scenarioKeys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={scenario === key}
              onClick={() => onScenarioChange(key)}
            >
              {scenarioLabels[key]}
            </button>
          ))}
        </div>
      </div>
      <dl className="dashboard-kpis">
        <div>
          <dt>Doanh thu sau ưu đãi & hoàn hàng</dt>
          <dd data-testid="dashboard-revenue">{money(row.revenue_dong)}</dd>
          <dd className="dashboard-kpi-note">Trước phí và chi phí vận hành</dd>
        </div>
        <div className="dashboard-profit">
          <dt>Lợi nhuận ước tính</dt>
          <dd
            data-testid="dashboard-profit"
            className={row.profit_dong < 0 ? 'negative' : 'positive'}
          >
            {money(row.profit_dong)}
          </dd>
          <dd className="dashboard-kpi-note">Sau các chi phí trong thiết lập</dd>
        </div>
        <div>
          <dt>Đơn hàng</dt>
          <dd data-testid="dashboard-orders">{count(row.orders)}</dd>
          <dd className="dashboard-kpi-note">{count(row.visits)} lượt truy cập theo giả định</dd>
        </div>
        <div>
          <dt>Shop chi voucher</dt>
          <dd data-testid="dashboard-spend">{money(row.spend_dong)}</dd>
          <dd className="dashboard-kpi-note">{count(row.redeemed)} đơn dùng voucher</dd>
        </div>
      </dl>
      {profitDifference !== null && (
        <p className="difference dashboard-difference">
          So với không voucher:{' '}
          <strong className={profitDifference < 0 ? 'negative' : 'positive'}>
            {profitDifference >= 0 ? '+' : ''}
            {money(profitDifference)}
          </strong>{' '}
          lợi nhuận trong cùng kịch bản.
        </p>
      )}
      <div className="dashboard-chart-panel">
        <div className="dashboard-heading">
          <div>
            <h4>Ba kịch bản, một chiến lược</h4>
            <p className="hint">Bấm một cột để xem số liệu của kịch bản đó.</p>
          </div>
          <label className="chart-metric-label">
            Chỉ số biểu đồ
            <select
              aria-label="Chỉ số biểu đồ"
              value={metric}
              onChange={(event) => setMetric(event.target.value as ChartMetric)}
            >
              {Object.entries(chartMetrics).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="scenario-chart" role="group" aria-label={`Biểu đồ ${chartMetrics[metric]}`}>
          {rows.map((item) => {
            const value = item[metric];
            return (
              <button
                type="button"
                key={item.key}
                className="scenario-column"
                aria-pressed={scenario === item.key}
                aria-label={`${scenarioLabels[item.key]}: ${chartMetrics[metric]} ${money(value)}`}
                onClick={() => onScenarioChange(item.key)}
              >
                <strong className={value < 0 ? 'negative' : undefined}>{money(value)}</strong>
                <span className="scenario-plot" aria-hidden="true">
                  <span className="scenario-zero" style={{ bottom: `${zeroFromBottom}%` }} />
                  <span
                    className={`scenario-fill${value < 0 ? ' scenario-fill-negative' : ''}`}
                    style={{
                      height: `${(Math.abs(value) / chartRange) * 100}%`,
                      bottom: `${value < 0 ? ((value - chartMinimum) / chartRange) * 100 : zeroFromBottom}%`,
                    }}
                  />
                </span>
                <span className="scenario-column-label">{scenarioLabels[item.key]}</span>
                <small>{count(item.visits)} lượt truy cập</small>
              </button>
            );
          })}
        </div>
        <p className="hint chart-explanation">
          Các cột dùng chung thang đo, đường ngang là mốc 0. Thấp / cơ sở / cao là các giả định
          traffic, không có xác suất và không phải dự báo chắc chắn.
        </p>
      </div>
      <div className="dashboard-limits">
        <div>
          <div className="dashboard-limit-heading">
            <span>Ngân sách voucher</span>
            <strong>
              {money(row.spend_dong)} / {money(constraints.budget_dong)}
            </strong>
          </div>
          <progress
            aria-label="Ngân sách voucher đã dùng"
            value={row.spend_dong}
            max={Math.max(1, constraints.budget_dong)}
          />
          {constraints.budget_dong === 0 && <small>Ngân sách shop bằng 0đ.</small>}
        </div>
        <div>
          <div className="dashboard-limit-heading">
            <span>Quota voucher</span>
            <strong>
              {count(row.redeemed)} / {count(constraints.quota)} đơn
            </strong>
          </div>
          <progress
            aria-label="Quota voucher đã dùng"
            value={row.redeemed}
            max={Math.max(1, constraints.quota)}
          />
          {constraints.quota === 0 && <small>Quota bằng 0 đơn.</small>}
        </div>
      </div>
      <p className="hint">
        Doanh thu đã trừ phần voucher shop tài trợ, đồng tài trợ voucher sàn nếu có và điều chỉnh
        theo tỷ lệ hoàn hàng. Lợi nhuận đã tính các khoản phí, thuế, giá vốn, đóng gói, shipping,
        ads và hoàn hàng trong thiết lập; không trừ chi voucher thêm lần nữa.
      </p>
    </section>
  );
}
