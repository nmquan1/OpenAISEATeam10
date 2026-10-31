import type { RunStore } from '../store/index.ts';
import type { RecommendationRequest, RecommendationResult } from '../../../contracts/model.ts';
export type Recommend = (
  body: RecommendationRequest,
  options: { signal: AbortSignal },
) => Promise<RecommendationResult>;
export interface RouteContext {
  store: RunStore;
  provider: Recommend;
  aiConfigured: boolean;
  modelConfigured: boolean;
  dailyAiLimit: number;
  aiBudgetUsd: number;
}
