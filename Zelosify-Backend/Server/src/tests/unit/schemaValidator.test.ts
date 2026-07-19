/**
 * Unit Tests — Schema Validator
 * Covers: Valid AgentOutput passes, missing fields throw, wrong types throw,
 *         out-of-range values throw, empty strings throw
 */
import { describe, it, expect } from "vitest";
import { validateAgentOutput } from "../../services/agent/schemaValidator.js";

const validOutput = {
  recommended: true,
  score: 0.82,
  confidence: 0.91,
  reason: "Strong skill match (80%), experience within range.",
  skillMatchScore: 0.8,
  experienceMatchScore: 1.0,
  locationMatchScore: 1.0,
  latencyMs: 1200,
  version: "1.0.0",
};

describe("SchemaValidator — Valid Output Passes", () => {
  it("accepts a fully valid AgentOutput without throwing", () => {
    expect(() => validateAgentOutput(validOutput)).not.toThrow();
  });

  it("returns the same object structure on valid input", () => {
    const result = validateAgentOutput(validOutput);
    expect(result.recommended).toBe(true);
    expect(result.score).toBe(0.82);
    expect(result.confidence).toBe(0.91);
    expect(result.reason).toBe("Strong skill match (80%), experience within range.");
  });

  it("accepts recommended=false as a valid boolean", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, recommended: false })
    ).not.toThrow();
  });

  it("accepts score of 0 (minimum valid)", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, score: 0 })
    ).not.toThrow();
  });

  it("accepts score of 1 (maximum valid)", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, score: 1 })
    ).not.toThrow();
  });
});

describe("SchemaValidator — Invalid Inputs Throw", () => {
  it("throws when output is null", () => {
    expect(() => validateAgentOutput(null)).toThrow();
  });

  it("throws when output is not an object", () => {
    expect(() => validateAgentOutput("not an object")).toThrow();
  });

  it("throws when recommended is a string instead of boolean", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, recommended: "true" })
    ).toThrow(/recommended must be boolean/);
  });

  it("throws when recommended is undefined", () => {
    const { recommended, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/recommended must be boolean/);
  });

  it("throws when score is a string", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, score: "0.82" })
    ).toThrow(/score must be number/);
  });

  it("throws when score is below 0", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, score: -0.1 })
    ).toThrow(/score must be number/);
  });

  it("throws when score is above 1", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, score: 1.01 })
    ).toThrow(/score must be number/);
  });

  it("throws when confidence is below 0", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, confidence: -0.1 })
    ).toThrow(/confidence must be number/);
  });

  it("throws when reason is an empty string", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, reason: "" })
    ).toThrow(/reason must be non-empty string/);
  });

  it("throws when reason is not a string", () => {
    expect(() =>
      validateAgentOutput({ ...validOutput, reason: 123 })
    ).toThrow(/reason must be non-empty string/);
  });

  it("throws when skillMatchScore is missing", () => {
    const { skillMatchScore, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/skillMatchScore must be number/);
  });

  it("throws when experienceMatchScore is missing", () => {
    const { experienceMatchScore, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/experienceMatchScore must be number/);
  });

  it("throws when locationMatchScore is missing", () => {
    const { locationMatchScore, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/locationMatchScore must be number/);
  });

  it("throws when latencyMs is missing", () => {
    const { latencyMs, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/latencyMs must be number/);
  });

  it("throws when version is missing", () => {
    const { version, ...rest } = validOutput;
    expect(() => validateAgentOutput(rest)).toThrow(/version must be string/);
  });
});
