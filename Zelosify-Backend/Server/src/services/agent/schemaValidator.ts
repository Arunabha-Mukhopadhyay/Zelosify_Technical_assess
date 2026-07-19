export interface AgentOutput {
  recommended: boolean;
  score: number;
  confidence: number;
  reason: string;
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  latencyMs: number;
  version: string;
}

export function validateAgentOutput(output: unknown): AgentOutput {
  if (!output || typeof output !== 'object') throw new Error('Agent output must be an object');
  const o = output as Record<string, unknown>;
  if (typeof o.recommended !== 'boolean') throw new Error('recommended must be boolean');
  if (typeof o.score !== 'number' || o.score < 0 || o.score > 1) throw new Error('score must be number 0-1');
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1) throw new Error('confidence must be number 0-1');
  if (typeof o.reason !== 'string' || o.reason.trim() === '') throw new Error('reason must be non-empty string');
  if (typeof o.skillMatchScore !== 'number') throw new Error('skillMatchScore must be number');
  if (typeof o.experienceMatchScore !== 'number') throw new Error('experienceMatchScore must be number');
  if (typeof o.locationMatchScore !== 'number') throw new Error('locationMatchScore must be number');
  if (typeof o.latencyMs !== 'number') throw new Error('latencyMs must be number');
  if (typeof o.version !== 'string') throw new Error('version must be string');
  return o as unknown as AgentOutput;
}
