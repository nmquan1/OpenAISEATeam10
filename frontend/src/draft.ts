import { parseRecommendationRequest, type EvaluationInput } from '@market-maker/contracts';
import type { DecisionContext, Strategy } from './types';
import type { EvaluationResult, RecommendationResult } from '@market-maker/contracts';

const storageKey = 'market-maker.draft.v2';
const format = 'market-maker-plan.v2';
export type Draft = { input: EvaluationInput; context: DecisionContext };

function parseDocument(value: unknown): Draft {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Tệp kế hoạch phải là một object JSON.');
  const data = value as Record<string, unknown>;
  if (data.format !== format)
    throw new Error('Tệp không đúng định dạng Market Maker v2. Hãy nhập bản xuất từ ứng dụng này.');
  return parseRecommendationRequest({ input: data.input, context: data.context });
}
export function loadDraft(): Draft | null {
  const text = localStorage.getItem(storageKey);
  return text ? parseDocument(JSON.parse(text)) : null;
}
export function saveDraft(draft: Draft) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ format, savedAt: new Date().toISOString(), ...draft }),
  );
}
export function clearDraft() {
  localStorage.removeItem(storageKey);
}
export async function importDraft(file: File): Promise<Draft> {
  if (file.size > 1_048_576) throw new Error('Tệp lớn hơn 1 MB. Chỉ nhập kế hoạch JSON đã xuất.');
  return parseDocument(JSON.parse(await file.text()));
}
export function exportPlan(
  result: EvaluationResult | RecommendationResult,
  selection: Strategy,
  context: DecisionContext,
) {
  const document = {
    format,
    savedAt: new Date().toISOString(),
    input: result.input,
    context,
    selected_strategy: selection,
    result,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
  );
  const link = window.document.createElement('a');
  link.href = url;
  link.download = 'market-maker-plan.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
