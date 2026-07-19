import { FeatureVector, ScoringResult, runScoringEngine } from './scoringEngine.js';

export interface MatchingToolInput { featureVector: FeatureVector; }
export interface MatchingToolOutput { scores: ScoringResult; toolName: 'deterministicMatchingTool'; executedAt: string; }

export async function deterministicMatchingTool(input: MatchingToolInput): Promise<MatchingToolOutput> {
  const scores = runScoringEngine(input.featureVector);
  return { scores, toolName: 'deterministicMatchingTool', executedAt: new Date().toISOString() };
}
