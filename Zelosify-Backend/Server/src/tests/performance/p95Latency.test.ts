/**
 * Performance Tests — P95 Latency
 * Simulates 100 profile evaluations and verifies:
 *   - P95 latency of the deterministic scoring engine < 2000ms
 *   - P95 latency of the decision policy < 2000ms
 *   - P95 latency of end-to-end deterministic pipeline < 2000ms
 *   - Individual scoring calls complete in < 10ms each
 *
 * NOTE: These tests do NOT call external services (Groq/S3).
 * They measure the deterministic components which must remain fast
 * to keep the full agent pipeline within the 1500ms / P95 2000ms SLA.
 */
import { describe, it, expect } from "vitest";
import { runScoringEngine, type FeatureVector } from "../../services/agent/tools/scoringEngine.js";
import { applyDecisionPolicy } from "../../services/agent/decisionPolicy.js";
import { deterministicMatchingTool } from "../../services/agent/tools/deterministicMatchingTool.js";
import { validateAgentOutput } from "../../services/agent/schemaValidator.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calculateP95(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[idx];
}

function calculateP99(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.99);
  return sorted[idx];
}

// ─── Profile variants for realistic simulation ────────────────────────────────
const SAMPLE_PROFILES: FeatureVector[] = [
  {
    candidateSkills: ["JavaScript", "React", "Node.js", "TypeScript"],
    requiredSkills: ["JavaScript", "React", "Node.js"],
    candidateLocation: "Remote",
    openingLocation: "Remote",
    experienceYears: 4,
    experienceMin: 3,
    experienceMax: 6,
  },
  {
    candidateSkills: ["Python", "Django", "PostgreSQL"],
    requiredSkills: ["JavaScript", "React", "Node.js"],
    candidateLocation: "London",
    openingLocation: "New York",
    experienceYears: 2,
    experienceMin: 5,
    experienceMax: 8,
  },
  {
    candidateSkills: ["AWS", "Docker", "Kubernetes", "Terraform"],
    requiredSkills: ["AWS", "Docker", "Kubernetes"],
    candidateLocation: "Gotham City",
    openingLocation: "Gotham City",
    experienceYears: 7,
    experienceMin: 4,
    experienceMax: 7,
  },
  {
    candidateSkills: [],
    requiredSkills: ["React", "TypeScript"],
    candidateLocation: "Unknown",
    openingLocation: null,
    experienceYears: 1,
    experienceMin: 3,
    experienceMax: 5,
  },
  {
    candidateSkills: ["Java", "Spring", "Kafka", "Redis", "PostgreSQL"],
    requiredSkills: ["Java", "Spring", "Redis"],
    candidateLocation: "Metropolis",
    openingLocation: "Remote",
    experienceYears: 12,
    experienceMin: 5,
    experienceMax: 10,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TEST 1: Scoring Engine — 100 Profiles
// ═══════════════════════════════════════════════════════════════════════════════
describe("Performance — Scoring Engine: 100 Profile Simulation", () => {
  it("P95 latency for runScoringEngine is under 2000ms", () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const profile = SAMPLE_PROFILES[i % SAMPLE_PROFILES.length];
      const start = performance.now();
      runScoringEngine(profile);
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    const p99 = calculateP99(latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(`[Perf] ScoringEngine — avg: ${avg.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | P99: ${p99.toFixed(3)}ms`);

    // The scoring engine must be deterministic and very fast
    expect(p95).toBeLessThan(2000);
  });

  it("individual scoring call completes in under 10ms", () => {
    const profile = SAMPLE_PROFILES[0];
    const start = performance.now();
    runScoringEngine(profile);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it("all 100 scoring calls return valid scores in [0, 1]", () => {
    for (let i = 0; i < 100; i++) {
      const profile = SAMPLE_PROFILES[i % SAMPLE_PROFILES.length];
      const result = runScoringEngine(profile);

      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(1);
      expect(result.skillMatchScore).toBeGreaterThanOrEqual(0);
      expect(result.skillMatchScore).toBeLessThanOrEqual(1);
      expect(result.experienceMatchScore).toBeGreaterThanOrEqual(0);
      expect(result.experienceMatchScore).toBeLessThanOrEqual(1);
      expect(result.locationMatchScore).toBeGreaterThanOrEqual(0);
      expect(result.locationMatchScore).toBeLessThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TEST 2: Decision Policy — 100 Profiles
// ═══════════════════════════════════════════════════════════════════════════════
describe("Performance — Decision Policy: 100 Profile Simulation", () => {
  it("P95 latency for applyDecisionPolicy is under 2000ms", () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const score = Math.random(); // simulate varied scores
      const start = performance.now();
      applyDecisionPolicy(score);
      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    console.log(`[Perf] DecisionPolicy — P95: ${p95.toFixed(3)}ms`);
    expect(p95).toBeLessThan(2000);
  });

  it("decision policy produces valid decisions for all 100 profiles", () => {
    for (let i = 0; i < 100; i++) {
      const profile = SAMPLE_PROFILES[i % SAMPLE_PROFILES.length];
      const { finalScore } = runScoringEngine(profile);
      const decision = applyDecisionPolicy(finalScore);

      expect(["RECOMMENDED", "BORDERLINE", "NOT_RECOMMENDED"]).toContain(
        decision.decision
      );

      if (decision.decision === "RECOMMENDED") {
        expect(decision.recommended).toBe(true);
      } else {
        expect(decision.recommended).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TEST 3: Full Deterministic Pipeline (no LLM) — 100 Profiles
// ═══════════════════════════════════════════════════════════════════════════════
describe("Performance — Full Deterministic Pipeline: 100 Profile Simulation", () => {
  it("P95 latency for full deterministic pipeline (score + decision + validate) is under 2000ms", async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const profile = SAMPLE_PROFILES[i % SAMPLE_PROFILES.length];
      const start = performance.now();

      // 1. Run deterministic scoring
      const matchingResult = await deterministicMatchingTool({
        featureVector: profile,
      });

      // 2. Apply decision policy
      const decision = applyDecisionPolicy(matchingResult.scores.finalScore);

      // 3. Build and validate agent output
      const output = {
        recommended: decision.recommended,
        score: matchingResult.scores.finalScore,
        confidence: decision.confidenceScore,
        reason: `Score: ${Math.round(matchingResult.scores.finalScore * 100)}%. ${decision.decision}.`,
        skillMatchScore: matchingResult.scores.skillMatchScore,
        experienceMatchScore: matchingResult.scores.experienceMatchScore,
        locationMatchScore: matchingResult.scores.locationMatchScore,
        latencyMs: 0,
        version: "1.0.0",
      };

      validateAgentOutput(output);

      latencies.push(performance.now() - start);
    }

    const p95 = calculateP95(latencies);
    const p99 = calculateP99(latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);

    console.log(
      `[Perf] FullPipeline (deterministic) — avg: ${avg.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | P99: ${p99.toFixed(3)}ms | max: ${max.toFixed(3)}ms`
    );

    // Strict SLA: deterministic pipeline must be fast enough to leave
    // budget for LLM calls within the 2000ms P95 envelope
    expect(p95).toBeLessThan(2000);
  });

  it("deterministic pipeline produces consistent results for identical inputs", () => {
    const profile = SAMPLE_PROFILES[0];

    const result1 = runScoringEngine(profile);
    const result2 = runScoringEngine(profile);
    const result3 = runScoringEngine(profile);

    expect(result1.finalScore).toBe(result2.finalScore);
    expect(result2.finalScore).toBe(result3.finalScore);
    expect(result1.skillMatchScore).toBe(result2.skillMatchScore);
    expect(result1.experienceMatchScore).toBe(result2.experienceMatchScore);
    expect(result1.locationMatchScore).toBe(result2.locationMatchScore);
  });

  it("scoring engine is deterministic across 100 runs with same input", () => {
    const profile = SAMPLE_PROFILES[2]; // AWS/Docker/Kubernetes profile
    const firstResult = runScoringEngine(profile);

    for (let i = 0; i < 99; i++) {
      const result = runScoringEngine(profile);
      expect(result.finalScore).toBe(firstResult.finalScore);
    }
  });
});
