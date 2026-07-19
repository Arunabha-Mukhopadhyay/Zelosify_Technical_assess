export interface FeatureVector {
  experienceYears: number;
  candidateSkills: string[];
  candidateLocation: string;
  requiredSkills: string[];
  experienceMin: number;
  experienceMax: number | null;
  openingLocation: string | null;
}

export interface ScoringResult {
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  finalScore: number;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function calcExperienceScore(candidateExp: number, min: number, max: number | null): number {
  if (candidateExp < min) return 0;
  if (max === null) return candidateExp >= min ? 1 : 0;
  if (candidateExp <= max) return 1;
  return 0.8; // above max
}

function calcSkillScore(candidateSkills: string[], requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 0.5;
  const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());
  const normalizedCandidate = new Set(candidateSkills.map(s => s.toLowerCase().trim()));
  const overlap = normalizedRequired.filter(s => normalizedCandidate.has(s)).length;
  return overlap / normalizedRequired.length;
}

function calcLocationScore(candidateLocation: string, openingLocation: string | null): number {
  if (!openingLocation) return 0.5;
  const ol = openingLocation.toLowerCase().trim();
  if (ol === 'remote') return 1.0;
  if (ol === candidateLocation.toLowerCase().trim()) return 1.0;
  return 0.5;
}

export function runScoringEngine(features: FeatureVector): ScoringResult {
  const skillMatchScore = round2(calcSkillScore(features.candidateSkills, features.requiredSkills));
  const experienceMatchScore = round2(calcExperienceScore(features.experienceYears, features.experienceMin, features.experienceMax));
  const locationMatchScore = round2(calcLocationScore(features.candidateLocation, features.openingLocation));
  const finalScore = round2((0.5 * skillMatchScore) + (0.3 * experienceMatchScore) + (0.2 * locationMatchScore));
  return { skillMatchScore, experienceMatchScore, locationMatchScore, finalScore };
}
