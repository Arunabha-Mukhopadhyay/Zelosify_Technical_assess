/**
 * Unit Tests — Scoring Engine
 * Covers: Experience boundaries, Skill overlap accuracy, Score formula,
 *         Location logic, edge cases, rounding precision
 */
import { describe, it, expect } from "vitest";
import {
  runScoringEngine,
  type FeatureVector,
} from "../../services/agent/tools/scoringEngine.js";

// ─── Shared base fixture ──────────────────────────────────────────────────────
const base: FeatureVector = {
  candidateSkills: [],
  requiredSkills: [],
  candidateLocation: "Remote",
  openingLocation: "Remote",
  experienceMin: 3,
  experienceMax: 6,
  experienceYears: 4,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERIENCE BOUNDARY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
describe("ScoringEngine — Experience Boundary Tests", () => {
  it("returns 0 when candidateExp is strictly below minimum", () => {
    const result = runScoringEngine({ ...base, experienceYears: 2 });
    expect(result.experienceMatchScore).toBe(0);
  });

  it("returns 0 when candidateExp is 0 and min is 1", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 0,
      experienceMin: 1,
    });
    expect(result.experienceMatchScore).toBe(0);
  });

  it("returns 1 when candidateExp exactly equals minimum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 3,
      experienceMin: 3,
    });
    expect(result.experienceMatchScore).toBe(1);
  });

  it("returns 1 when candidateExp is within range (middle)", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 5,
      experienceMin: 3,
      experienceMax: 8,
    });
    expect(result.experienceMatchScore).toBe(1);
  });

  it("returns 1 when candidateExp exactly equals maximum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 6,
      experienceMax: 6,
    });
    expect(result.experienceMatchScore).toBe(1);
  });

  it("returns 0.8 when candidateExp is one above maximum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 7,
      experienceMax: 6,
    });
    expect(result.experienceMatchScore).toBe(0.8);
  });

  it("returns 0.8 when candidateExp far exceeds maximum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 20,
      experienceMax: 6,
    });
    expect(result.experienceMatchScore).toBe(0.8);
  });

  it("returns 1 when experienceMax is null and candidate meets minimum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 10,
      experienceMax: null,
      experienceMin: 5,
    });
    expect(result.experienceMatchScore).toBe(1);
  });

  it("returns 0 when experienceMax is null and candidate is below minimum", () => {
    const result = runScoringEngine({
      ...base,
      experienceYears: 2,
      experienceMax: null,
      experienceMin: 5,
    });
    expect(result.experienceMatchScore).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL OVERLAP ACCURACY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
describe("ScoringEngine — Skill Overlap Accuracy", () => {
  it("returns 0.5 when requiredSkills array is empty", () => {
    const result = runScoringEngine({ ...base, requiredSkills: [] });
    expect(result.skillMatchScore).toBe(0.5);
  });

  it("returns 1.0 on 100% skill overlap", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["JavaScript", "React", "Node.js"],
      requiredSkills: ["JavaScript", "React", "Node.js"],
    });
    expect(result.skillMatchScore).toBe(1);
  });

  it("returns 0 when no skills overlap at all", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["Python", "Django"],
      requiredSkills: ["React", "Node.js", "TypeScript"],
    });
    expect(result.skillMatchScore).toBe(0);
  });

  it("returns 0.5 on 2-of-4 skill overlap", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["JavaScript", "Python"],
      requiredSkills: ["JavaScript", "React", "Python", "Node.js"],
    });
    expect(result.skillMatchScore).toBe(0.5);
  });

  it("returns correct ratio for 1-of-3 skill overlap", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["JavaScript"],
      requiredSkills: ["JavaScript", "React", "Node.js"],
    });
    expect(result.skillMatchScore).toBeCloseTo(0.33, 1);
  });

  it("is case-insensitive when matching skills", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["javascript", "REACT", "NODE.JS"],
      requiredSkills: ["JavaScript", "React", "Node.js"],
    });
    expect(result.skillMatchScore).toBe(1);
  });

  it("trims whitespace when matching skills", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: [" JavaScript ", " React"],
      requiredSkills: ["JavaScript", "React"],
    });
    expect(result.skillMatchScore).toBe(1);
  });

  it("candidate with extra skills does not reduce score", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["JavaScript", "React", "Python", "AWS", "Docker"],
      requiredSkills: ["JavaScript", "React"],
    });
    expect(result.skillMatchScore).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE FORMULA CORRECTNESS
// ═══════════════════════════════════════════════════════════════════════════════
describe("ScoringEngine — Score Formula Correctness", () => {
  it("computes perfect score 1.0 when all components are 1.0", () => {
    const result = runScoringEngine({
      candidateSkills: ["JavaScript", "React"],
      requiredSkills: ["JavaScript", "React"],
      candidateLocation: "Remote",
      openingLocation: "Remote",
      experienceMin: 2,
      experienceMax: 5,
      experienceYears: 3,
    });
    // (0.5*1.0) + (0.3*1.0) + (0.2*1.0) = 1.0
    expect(result.finalScore).toBe(1.0);
  });

  it("computes finalScore = (0.5*skill) + (0.3*exp) + (0.2*location)", () => {
    // skill=0.5, exp=0.8(above max), loc=0.5(mismatch)
    // (0.5*0.5) + (0.3*0.8) + (0.2*0.5) = 0.25+0.24+0.10 = 0.59
    const result = runScoringEngine({
      candidateSkills: ["JavaScript"],
      requiredSkills: ["JavaScript", "React"],
      candidateLocation: "New York",
      openingLocation: "London",
      experienceMin: 3,
      experienceMax: 6,
      experienceYears: 8,
    });
    expect(result.skillMatchScore).toBe(0.5);
    expect(result.experienceMatchScore).toBe(0.8);
    expect(result.locationMatchScore).toBe(0.5);
    expect(result.finalScore).toBe(0.59);
  });

  it("returns finalScore 0.1 when skill and exp are 0 but location gives 0.5", () => {
    // skill=0, exp=0, loc=0.5
    // (0.5*0) + (0.3*0) + (0.2*0.5) = 0.10
    const result = runScoringEngine({
      candidateSkills: [],
      requiredSkills: ["React", "Node.js"],
      candidateLocation: "New York",
      openingLocation: "London",
      experienceMin: 5,
      experienceMax: 8,
      experienceYears: 1,
    });
    expect(result.skillMatchScore).toBe(0);
    expect(result.experienceMatchScore).toBe(0);
    expect(result.finalScore).toBe(0.1);
  });

  it("all individual scores are between 0 and 1 inclusive", () => {
    const result = runScoringEngine({
      ...base,
      candidateSkills: ["JavaScript"],
      requiredSkills: ["React"],
    });
    expect(result.skillMatchScore).toBeGreaterThanOrEqual(0);
    expect(result.skillMatchScore).toBeLessThanOrEqual(1);
    expect(result.experienceMatchScore).toBeGreaterThanOrEqual(0);
    expect(result.experienceMatchScore).toBeLessThanOrEqual(1);
    expect(result.locationMatchScore).toBeGreaterThanOrEqual(0);
    expect(result.locationMatchScore).toBeLessThanOrEqual(1);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it("all scores are rounded to max 2 decimal places", () => {
    const result = runScoringEngine({
      candidateSkills: ["JavaScript"],
      requiredSkills: ["JavaScript", "React", "Node.js"],
      candidateLocation: "Remote",
      openingLocation: "Remote",
      experienceMin: 2,
      experienceMax: 5,
      experienceYears: 3,
    });
    const round2 = (n: number) => Math.round(n * 100) / 100;
    expect(result.skillMatchScore).toBe(round2(result.skillMatchScore));
    expect(result.experienceMatchScore).toBe(round2(result.experienceMatchScore));
    expect(result.locationMatchScore).toBe(round2(result.locationMatchScore));
    expect(result.finalScore).toBe(round2(result.finalScore));
  });

  it("finalScore weights add up to 1.0 (0.5 + 0.3 + 0.2)", () => {
    // Verify weights: use known scores to check formula
    // skill=1, exp=1, loc=1 → final must be exactly 1
    const result = runScoringEngine({
      candidateSkills: ["React"],
      requiredSkills: ["React"],
      candidateLocation: "Remote",
      openingLocation: "Remote",
      experienceMin: 3,
      experienceMax: 5,
      experienceYears: 4,
    });
    const manual =
      0.5 * result.skillMatchScore +
      0.3 * result.experienceMatchScore +
      0.2 * result.locationMatchScore;
    expect(result.finalScore).toBeCloseTo(manual, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION LOGIC TESTS
// ═══════════════════════════════════════════════════════════════════════════════
describe("ScoringEngine — Location Logic", () => {
  it("returns 0.5 when openingLocation is null", () => {
    const result = runScoringEngine({
      ...base,
      openingLocation: null,
    });
    expect(result.locationMatchScore).toBe(0.5);
  });

  it("returns 1.0 when openingLocation is 'Remote' (exact case)", () => {
    const result = runScoringEngine({
      ...base,
      candidateLocation: "Anywhere",
      openingLocation: "Remote",
    });
    expect(result.locationMatchScore).toBe(1.0);
  });

  it("returns 1.0 when openingLocation is 'REMOTE' (uppercase)", () => {
    const result = runScoringEngine({
      ...base,
      openingLocation: "REMOTE",
    });
    expect(result.locationMatchScore).toBe(1.0);
  });

  it("returns 1.0 when openingLocation is 'remote' (lowercase)", () => {
    const result = runScoringEngine({
      ...base,
      openingLocation: "remote",
    });
    expect(result.locationMatchScore).toBe(1.0);
  });

  it("returns 1.0 on exact location match", () => {
    const result = runScoringEngine({
      ...base,
      candidateLocation: "New York",
      openingLocation: "New York",
    });
    expect(result.locationMatchScore).toBe(1.0);
  });

  it("returns 1.0 on case-insensitive location match", () => {
    const result = runScoringEngine({
      ...base,
      candidateLocation: "new york",
      openingLocation: "New York",
    });
    expect(result.locationMatchScore).toBe(1.0);
  });

  it("returns 0.5 when locations do not match (onsite mismatch)", () => {
    const result = runScoringEngine({
      ...base,
      candidateLocation: "London",
      openingLocation: "New York",
    });
    expect(result.locationMatchScore).toBe(0.5);
  });

  it("returns 0.5 when candidate is in city and opening is different city", () => {
    const result = runScoringEngine({
      ...base,
      candidateLocation: "Gotham City",
      openingLocation: "Metropolis",
    });
    expect(result.locationMatchScore).toBe(0.5);
  });
});
