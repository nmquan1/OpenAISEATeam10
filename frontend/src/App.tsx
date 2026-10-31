import { useEffect, useRef, useState } from 'react';
import {
  defaults,
  parseInput,
  parseRecommendationRequest,
  type EvaluationInput,
  type EvaluationResult,
  type RecommendationResult,
} from '@market-maker/contracts';
import * as api from './api';
import { clearDraft, exportPlan, importDraft, loadDraft, saveDraft, type Draft } from './draft';
import { AiPanel } from './components/AiPanel';
import { ContextEditor } from './components/ContextEditor';
import { Results } from './components/Results';
import { PortfolioPanel } from './components/PortfolioPanel';
import { StrategyForm } from './components/StrategyForm';
import { Guide } from './components/Guide';
import type { DecisionContext, Health, Run, Strategy } from './types';
import { getOfferedStrategies, getSelectedOffer } from './strategy-offers';

function initialDraft(): Draft & { notice: string } {
  try {
    const saved = loadDraft();
    return {
      ...(saved ?? { input: structuredClone(defaults), context: { seller_notes: '' } }),
      notice: saved
        ? 'Đã khôi phục bản nháp trên trình duyệt.'
        : 'Đang dùng dữ liệu mẫu. Hãy đổi thành số liệu shop của bạn.',
    };
  } catch {
    return {
      input: structuredClone(defaults),
      context: { seller_notes: '' },
      notice:
        'Không đọc được bản nháp cũ; đang dùng dữ liệu mẫu. Bạn vẫn có thể nhập tệp kế hoạch.',
    };
  }
}
const steps = [
  { id: 'input', number: '1', label: 'Nhập số liệu' },
  { id: 'results', number: '2', label: 'Kết quả' },
  { id: 'ai', number: '3', label: 'Nhờ AI' },
  { id: 'more', number: '', label: 'Công cụ khác' },
] as const;
type StepId = (typeof steps)[number]['id'];

const guideSeenKey = 'market-maker.guide-seen';
// Storage can be disabled; then the guide simply opens on each visit.
function guideSeen() {
  try {
    return localStorage.getItem(guideSeenKey) === '1';
  } catch {
    return false;
  }
}

function message(error: unknown) {
  if (error instanceof api.ApiError)
    return `${error.message}${error.requestId ? ` · Mã hỗ trợ: ${error.requestId}` : ''}`;
  return error instanceof Error ? error.message : 'Có lỗi khi xử lý yêu cầu. Vui lòng thử lại.';
}

export function App() {
  const [initial] = useState(initialDraft);
  const [input, setInput] = useState<EvaluationInput>(initial.input);
  const [context, setContext] = useState<DecisionContext>(initial.context);
  const [notice, setNotice] = useState(initial.notice);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [healthRevision, setHealthRevision] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [aiResult, setAiResult] = useState<RecommendationResult | null>(null);
  const [source, setSource] = useState<'evaluation' | 'ai'>('evaluation');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [evaluateRevision, setEvaluateRevision] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsBusy, setRunsBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [runsError, setRunsError] = useState('');
  const evaluateController = useRef<AbortController | null>(null);
  const aiController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const runsController = useRef<AbortController | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const [step, setStep] = useState<StepId>('input');
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen());
  const tabsRef = useRef<HTMLDivElement>(null);
  const result = source === 'ai' ? aiResult : evaluation;

  function closeGuide() {
    setGuideOpen(false);
    try {
      localStorage.setItem(guideSeenKey, '1');
    } catch {
      /* Without storage the guide opens again next visit; nothing else depends on it. */
    }
  }

  /** Switch step and, if the page is scrolled past the tabs, bring the new step's top into view. */
  function goTo(next: StepId) {
    setStep(next);
    const tabs = tabsRef.current;
    if (tabs && tabs.getBoundingClientRect().top <= 0)
      window.scrollTo({ top: tabs.offsetTop - 1, behavior: 'auto' });
  }

  useEffect(() => {
    const controller = new AbortController();
    void api
      .getHealth(controller.signal)
      .then((data) => {
        setHealth(data);
        setError('');
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setHealth(null);
          setError(message(reason));
        }
      });
    return () => controller.abort();
  }, [healthRevision]);

  // Small validated drafts are saved immediately, so a reload cannot race a debounce.
  // Invalid edits never overwrite the most recent valid draft.
  useEffect(() => {
    try {
      const draft = parseRecommendationRequest({ input, context });
      saveDraft(draft);
      setDraftStatus('Bản nháp đã lưu trên trình duyệt.');
    } catch {
      setDraftStatus(
        'Bản sửa hiện tại chưa hợp lệ hoặc trình duyệt không cho lưu. Bản nháp hợp lệ trước đó được giữ lại.',
      );
    }
  }, [input, context]);

  useEffect(() => {
    if (!health) {
      setEvaluating(false);
      return;
    }
    const controller = new AbortController();
    evaluateController.current = controller;
    let validated: EvaluationInput;
    try {
      validated = parseInput(input);
    } catch (reason) {
      setError(`Cần sửa đầu vào: ${message(reason)}`);
      setEvaluating(false);
      return;
    }
    setEvaluating(true);
    const timer = setTimeout(() => {
      setStatus('Đang tính các kịch bản trên server…');
      void api
        .evaluate(validated, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setEvaluation(data);
          setSelectedId(getSelectedOffer(data, null).id);
          setError('');
          setStatus(
            `Đã tính ${data.strategies.length} phương án; hiển thị ${getOfferedStrategies(data).length} phương án đứng đầu. Kết quả là mô phỏng theo giả định.`,
          );
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(message(reason));
            setStatus('Phân tích chưa thành công.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setEvaluating(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, health, evaluateRevision]);

  useEffect(
    () => () => {
      evaluateController.current?.abort();
      aiController.current?.abort();
      runsController.current?.abort();
      historyController.current?.abort();
    },
    [],
  );

  function cancelAI(updateStatus = true) {
    aiController.current?.abort();
    aiController.current = null;
    setAiBusy(false);
    if (updateStatus) setStatus('Đã hủy yêu cầu AI.');
  }
  function changeInput(next: EvaluationInput) {
    setDraftStatus('Đang kiểm tra và lưu bản nháp…');
    evaluateController.current?.abort();
    cancelAI(false);
    setEvaluation(null);
    setAiResult(null);
    setSource('evaluation');
    setSelectedId(null);
    setInput(next);
    setError('');
    setStatus('Đầu vào thay đổi; đang kiểm tra và tính lại.');
  }
  function changeContext(next: DecisionContext) {
    setDraftStatus('Đang kiểm tra và lưu bản nháp…');
    historyController.current?.abort();
    setHistoryBusy(false);
    cancelAI(false);
    setAiResult(null);
    setSource('evaluation');
    setSelectedId(null);
    setContext(next);
    setError('');
    setStatus('Bối cảnh thay đổi. Bấm AI để tạo ứng viên mới.');
  }
  async function requestRecommendation() {
    if (!health?.aiConfigured || aiBusy) return;
    const controller = new AbortController();
    aiController.current = controller;
    setAiBusy(true);
    setError('');
    setStatus('AI đang tạo ứng viên. Engine sẽ tính lại trước khi hiển thị.');
    const timeout = setTimeout(() => controller.abort(), 125000);
    try {
      const body = parseRecommendationRequest({ input, context });
      const data = await api.recommend(body, controller.signal);
      if (!controller.signal.aborted) {
        setAiResult(data);
        setSource('ai');
        setSelectedId(getSelectedOffer(data, null).id);
        setStatus(
          `Đã kiểm tra ${data.strategies.length} phương án, gồm baseline và ứng viên AI; hiển thị ${getOfferedStrategies(data).length} phương án đứng đầu.`,
        );
        goTo('results');
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(message(reason));
        setStatus('Yêu cầu AI chưa thành công. Mô phỏng trước đó vẫn dùng được.');
      } else if (aiController.current === controller)
        setStatus('AI phản hồi quá lâu. Vui lòng thử lại.');
    } finally {
      clearTimeout(timeout);
      if (aiController.current === controller) {
        aiController.current = null;
        setAiBusy(false);
      }
    }
  }
  async function readImport(file: File | undefined) {
    if (!file) return;
    try {
      const draft = await importDraft(file);
      changeInput(draft.input);
      setContext(draft.context);
      setNotice(
        'Đã kiểm tra và nhập thiết lập từ JSON. Các kết quả trong tệp không được tin cậy; server đang tính lại.',
      );
    } catch (reason) {
      setError(`Không nhập được tệp: ${message(reason)}`);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function apply(strategy: Strategy) {
    changeInput({ ...input, voucher: structuredClone(strategy.voucher) });
    setNotice(
      `Đã đưa voucher “${strategy.name}” vào thiết lập. Server đang so sánh lại với baseline.`,
    );
  }
  function reset() {
    if (
      !window.confirm('Đặt lại dữ liệu mẫu? Bản nháp hiện tại trên trình duyệt sẽ được thay thế.')
    )
      return;
    try {
      clearDraft();
    } catch {
      /* Local storage can be disabled; the form still resets. */
    }
    changeInput(structuredClone(defaults));
    setContext({ seller_notes: '' });
    setNotice('Đã đặt lại dữ liệu mẫu.');
  }
  async function refreshRuns() {
    if (!health) return;
    runsController.current?.abort();
    const controller = new AbortController();
    runsController.current = controller;
    setRunsBusy(true);
    setRunsError('');
    try {
      const data = await api.getRuns(controller.signal);
      if (!controller.signal.aborted) setRuns(data);
    } catch (reason) {
      if (!controller.signal.aborted) setRunsError(message(reason));
    } finally {
      if (!controller.signal.aborted) setRunsBusy(false);
    }
  }
  async function importHistory(file: File) {
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    setHistoryBusy(true);
    setError('');
    try {
      if (file.size > 16384) throw new Error('CSV quá lớn. Tối đa 16 KB và 20 đợt sale tổng hợp.');
      const history = await api.validateHistory(await file.text(), controller.signal);
      if (!controller.signal.aborted) {
        changeContext({ ...context, history });
        setNotice(
          `Đã kiểm tra ${history.campaigns.length} đợt sale từ CSV. Traffic/CVR vẫn là giả định đã nhập.`,
        );
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(`Không nhập được lịch sử: ${message(reason)}`);
    } finally {
      if (historyController.current === controller) setHistoryBusy(false);
    }
  }
  function stepSummary(id: StepId) {
    if (id === 'input') return input.product.name;
    if (id === 'results') {
      if (evaluating) return 'Đang tính…';
      return result ? `Đề xuất: ${result.recommended.name}` : 'Chưa có kết quả';
    }
    if (id === 'ai') {
      if (aiBusy) return 'Đang tạo gợi ý…';
      if (aiResult) return 'Đã có gợi ý';
      return health?.aiConfigured ? 'Tùy chọn' : 'Chưa bật trên server';
    }
    return 'Danh mục voucher, lịch sử';
  }
  return (
    <>
      <a className="skip-link" href="#tab-input">
        Bỏ qua đến các bước
      </a>
      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-mark" aria-hidden="true">
            %
          </span>
          market maker
        </a>
        <div className="actions">
          <button className="primary" type="button" onClick={() => setGuideOpen(true)}>
            Hướng dẫn
          </button>
          <button className="secondary" type="button" onClick={() => fileInput.current?.click()}>
            Nhập kế hoạch JSON
          </button>
          <button className="text-button" type="button" onClick={reset}>
            Đặt lại mẫu
          </button>
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            ref={fileInput}
            aria-label="Nhập tệp kế hoạch JSON"
            onChange={(event) => {
              void readImport(event.target.files?.[0]);
            }}
          />
        </div>
      </header>
      <main>
        <section className="hero">
          <h1>Chọn voucher 11.11 mà vẫn có lời</h1>
          <p>
            Nhập giá vốn, phí và lượng khách dự kiến. Công cụ so sánh lợi nhuận khi không chạy
            voucher và khi chạy từng mức giảm. Đây là mô phỏng theo số liệu bạn nhập, không phải dự
            báo, và không tự đổi voucher trên Shopee.
          </p>
        </section>
        <div className="toolbar">
          <p className="status">{notice}</p>
          <p className="hint">{draftStatus}</p>
        </div>
        <div
          className="step-tabs"
          role="tablist"
          aria-label="Các bước lập kế hoạch"
          ref={tabsRef}
          onKeyDown={(event) => {
            const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (!offset) return;
            event.preventDefault();
            const index = steps.findIndex((item) => item.id === step);
            const next = steps[(index + offset + steps.length) % steps.length]!.id;
            setStep(next);
            document.getElementById(`tab-${next}`)?.focus();
          }}
        >
          {steps.map((item) => (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={step === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={step === item.id ? 0 : -1}
              onClick={() => setStep(item.id)}
            >
              <span className={`step-number${item.number ? '' : ' step-extra'}`} aria-hidden="true">
                {item.number || '…'}
              </span>
              <span className="step-text">
                <span className="step-label">{item.label}</span>
                <small>{stepSummary(item.id)}</small>
              </span>
            </button>
          ))}
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <p className="status live-status" role="status" aria-live="polite">
          {status}
        </p>
        <section
          id="panel-input"
          role="tabpanel"
          aria-labelledby="tab-input"
          className="step-panel narrow"
          hidden={step !== 'input'}
        >
          <StrategyForm
            input={input}
            onChange={changeInput}
            busy={evaluating}
            disabled={!health}
            onSubmit={() => {
              setEvaluateRevision((value) => value + 1);
              goTo('results');
            }}
          />
        </section>
        <section
          id="panel-results"
          role="tabpanel"
          aria-labelledby="tab-results"
          className="step-panel"
          hidden={step !== 'results'}
        >
          {aiResult && (
            <div className="result-source toggle" role="group" aria-label="Nguồn kết quả">
              <button
                type="button"
                aria-pressed={source === 'evaluation'}
                onClick={() => {
                  setSource('evaluation');
                  setSelectedId(null);
                }}
              >
                Phương án cơ sở
              </button>
              <button
                type="button"
                aria-pressed={source === 'ai'}
                onClick={() => {
                  setSource('ai');
                  setSelectedId(null);
                }}
              >
                Ứng viên có AI
              </button>
            </div>
          )}
          {result ? (
            <Results
              result={result}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onApply={apply}
              context={context}
              onExport={() => {
                const selection = getSelectedOffer(result, selectedId);
                exportPlan(
                  result,
                  selection,
                  source === 'ai' && aiResult ? aiResult.context : context,
                );
                setStatus('Đã xuất đúng phương án đang chọn cùng đầu vào, kết quả và bối cảnh.');
              }}
            />
          ) : (
            <section className="card empty-state">
              <h2>{evaluating ? 'Đang tính kịch bản…' : 'Chưa có kết quả'}</h2>
              <p>
                {evaluating
                  ? 'Server đang so sánh không voucher với các mức giảm.'
                  : 'Kiểm tra lại số liệu ở bước 1. Kết quả hiện ra ngay khi số liệu hợp lệ.'}
              </p>
              {!evaluating && (
                <button className="secondary" type="button" onClick={() => goTo('input')}>
                  Về bước 1
                </button>
              )}
            </section>
          )}
          <nav className="step-nav" aria-label="Chuyển bước">
            <button className="secondary" type="button" onClick={() => goTo('input')}>
              Sửa số liệu
            </button>
            <button className="primary" type="button" onClick={() => goTo('ai')}>
              Nhờ AI gợi ý thêm voucher
            </button>
          </nav>
        </section>
        <section
          id="panel-ai"
          role="tabpanel"
          aria-labelledby="tab-ai"
          className="step-panel narrow"
          hidden={step !== 'ai'}
        >
          <ContextEditor
            context={context}
            onChange={changeContext}
            onImportCsv={(file) => {
              void importHistory(file);
            }}
            importBusy={historyBusy}
            importDisabled={!health}
          />
          <AiPanel
            health={health}
            busy={aiBusy}
            hasResult={Boolean(evaluation)}
            onRecommend={() => {
              void requestRecommendation();
            }}
            onCancel={() => cancelAI()}
            onRefresh={() => setHealthRevision((value) => value + 1)}
          />
          <nav className="step-nav" aria-label="Chuyển bước">
            <button className="secondary" type="button" onClick={() => goTo('results')}>
              Quay lại kết quả
            </button>
          </nav>
        </section>
        <section
          id="panel-more"
          role="tabpanel"
          aria-labelledby="tab-more"
          className="step-panel narrow"
          hidden={step !== 'more'}
        >
          <PortfolioPanel input={input} disabled={!health || evaluating} />
          {health && (
            <details className="card">
              <summary>Lịch sử phân tích dùng chung</summary>
              <p className="hint">
                Các lần chạy được lưu trong workspace này và mọi người dùng workspace đều có thể
                xem. Tách biệt với lịch sử sale do người bán nhập. Chọn một lần chạy để khôi phục
                đầu vào và tính lại.
              </p>
              <button
                className="secondary"
                type="button"
                disabled={runsBusy}
                onClick={() => {
                  void refreshRuns();
                }}
              >
                {runsBusy ? 'Đang tải…' : 'Tải lịch sử'}
              </button>
              {runsError && (
                <p role="alert" className="field-error">
                  {runsError}
                </p>
              )}
              {runs.map((run) => (
                <div className="run-item" key={run.id}>
                  <span>
                    {new Date(run.createdAt).toLocaleString('vi-VN')} · {run.kind}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      changeInput(run.input);
                      setContext(
                        'provider' in run.result ? run.result.context : { seller_notes: '' },
                      );
                      setNotice(
                        'Đã khôi phục đầu vào từ lịch sử; đang tính lại với engine hiện tại.',
                      );
                      goTo('results');
                    }}
                  >
                    Khôi phục
                  </button>
                </div>
              ))}
            </details>
          )}
        </section>
        <footer>
          <span className="brand">market maker ↗</span>
          <p>Mỗi con số đều có giả định. Kiểm tra trước khi triển khai.</p>
          <a href="/docs/research.md">Nguồn & giới hạn mô hình</a>
        </footer>
      </main>
      <Guide
        open={guideOpen}
        onClose={closeGuide}
        onStart={() => {
          closeGuide();
          goTo('input');
        }}
      />
    </>
  );
}
