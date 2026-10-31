import type {
  EvaluationResult,
  RecommendationResult,
  RecommendationRequest,
} from '@market-maker/contracts';

export type DecisionContext = RecommendationRequest['context'];
export type Strategy = EvaluationResult['strategies'][number];
export type ScenarioKey = Strategy['scenarios'][number]['key'];
export type Health = {
  status: string;
  schema_version: string;
  mode: string;
  aiConfigured: boolean;
  modelConfigured: boolean;
};
export type Run = {
  id: string;
  createdAt: string;
  kind: string;
  schemaVersion: string;
  input: EvaluationResult['input'];
  result: EvaluationResult | RecommendationResult;
};
export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export const count = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
export const scenarioLabels: Record<ScenarioKey, string> = {
  low: 'Thấp',
  base: 'Cơ sở',
  high: 'Cao',
};
