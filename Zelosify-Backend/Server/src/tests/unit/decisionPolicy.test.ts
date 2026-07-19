/**
 * Unit Tests — Decision Policy
 * Covers: All decision thresholds (RECOMMENDED / BORDERLINE / NOT_RECOMMENDED),
 *         boundary values, recommended flag, confidence score passthrough
 */
import { describe, it, expect } from "vitest";
import { applyDecisionPolicy } from "../../services/agent/decisionPolicy.js";

describe("DecisionPolicy — Recommendation Thresholds", () => {
  // ── RECOMMENDED (>= 0.75) ──────────────────────────────────────────────────
  it("returns RECOMMENDED for score exactly 0.75", () => {
    const result = applyDecisionPolicy(0.75);
    expect(result.decision).toBe("RECOMMENDED");
    expect(result.recommended).toBe(true);
  });

  it("returns RECOMMENDED for score 0.80", () => {
    const result = applyDecisionPolicy(0.8);
    expect(result.decision).toBe("RECOMMENDED");
    expect(result.recommended).toBe(true);
  });

  it("returns RECOMMENDED for score 1.0 (perfect score)", () => {
    const result = applyDecisionPolicy(1.0);
    expect(result.decision).toBe("RECOMMENDED");
    expect(result.recommended).toBe(true);
  });

  it("returns RECOMMENDED for score 0.99", () => {
    const result = applyDecisionPolicy(0.99);
    expect(result.decision).toBe("RECOMMENDED");
    expect(result.recommended).toBe(true);
  });

  // ── BORDERLINE (0.50 – 0.74) ──────────────────────────────────────────────
  it("returns BORDERLINE for score exactly 0.74 (just below RECOMMENDED)", () => {
    const result = applyDecisionPolicy(0.74);
    expect(result.decision).toBe("BORDERLINE");
    expect(result.recommended).toBe(false);
  });

  it("returns BORDERLINE for score exactly 0.50", () => {
    const result = applyDecisionPolicy(0.5);
    expect(result.decision).toBe("BORDERLINE");
    expect(result.recommended).toBe(false);
  });

  it("returns BORDERLINE for score 0.60", () => {
    const result = applyDecisionPolicy(0.6);
    expect(result.decision).toBe("BORDERLINE");
    expect(result.recommended).toBe(false);
  });

  // ── NOT_RECOMMENDED (< 0.50) ──────────────────────────────────────────────
  it("returns NOT_RECOMMENDED for score exactly 0.49 (just below BORDERLINE)", () => {
    const result = applyDecisionPolicy(0.49);
    expect(result.decision).toBe("NOT_RECOMMENDED");
    expect(result.recommended).toBe(false);
  });

  it("returns NOT_RECOMMENDED for score 0.0", () => {
    const result = applyDecisionPolicy(0.0);
    expect(result.decision).toBe("NOT_RECOMMENDED");
    expect(result.recommended).toBe(false);
  });

  it("returns NOT_RECOMMENDED for score 0.10", () => {
    const result = applyDecisionPolicy(0.1);
    expect(result.decision).toBe("NOT_RECOMMENDED");
    expect(result.recommended).toBe(false);
  });

  // ── Confidence Score Passthrough ──────────────────────────────────────────
  it("passes through the finalScore as confidenceScore (rounded to 2 decimals)", () => {
    const result = applyDecisionPolicy(0.82);
    expect(result.confidenceScore).toBe(0.82);
  });

  it("rounds confidenceScore to 2 decimal places", () => {
    const result = applyDecisionPolicy(0.8256789);
    expect(result.confidenceScore).toBe(Math.round(0.8256789 * 100) / 100);
  });

  // ── Recommended flag is strictly boolean ──────────────────────────────────
  it("recommended is true ONLY for RECOMMENDED decision", () => {
    expect(applyDecisionPolicy(0.9).recommended).toBe(true);
    expect(applyDecisionPolicy(0.75).recommended).toBe(true);
    expect(applyDecisionPolicy(0.74).recommended).toBe(false);
    expect(applyDecisionPolicy(0.5).recommended).toBe(false);
    expect(applyDecisionPolicy(0.0).recommended).toBe(false);
  });

  // ── Exact boundary verification ───────────────────────────────────────────
  it("0.75 is RECOMMENDED, 0.7499 is BORDERLINE", () => {
    expect(applyDecisionPolicy(0.75).decision).toBe("RECOMMENDED");
    expect(applyDecisionPolicy(0.7499).decision).toBe("BORDERLINE");
  });

  it("0.50 is BORDERLINE, 0.4999 is NOT_RECOMMENDED", () => {
    expect(applyDecisionPolicy(0.5).decision).toBe("BORDERLINE");
    expect(applyDecisionPolicy(0.4999).decision).toBe("NOT_RECOMMENDED");
  });
});
