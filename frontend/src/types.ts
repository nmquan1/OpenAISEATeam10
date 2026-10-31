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
export type AiUsage = {
  limitUsd: number;
  spentUsd: number;
  remainingUsd: number;
  calls: {
    id: string;
    createdAt: string;
    runId: string;
    model: string;
    requestId: string;
    promptVersion: string;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    attempts: number;
    context: {
      context: DecisionContext;
      decision_context: RecommendationResult['decision_context'];
    };
  }[];
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
