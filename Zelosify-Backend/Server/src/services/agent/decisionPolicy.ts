export type RecommendationDecision = 'RECOMMENDED' | 'BORDERLINE' | 'NOT_RECOMMENDED';

export interface PolicyResult {
  decision: RecommendationDecision;
  recommended: boolean;
  confidenceScore: number;
}

export function applyDecisionPolicy(finalScore: number): PolicyResult {
  const confidenceScore = Math.round(finalScore * 100) / 100;
  if (finalScore >= 0.75) return { decision: 'RECOMMENDED', recommended: true, confidenceScore };
  if (finalScore >= 0.5) return { decision: 'BORDERLINE', recommended: false, confidenceScore };
  return { decision: 'NOT_RECOMMENDED', recommended: false, confidenceScore };
}
