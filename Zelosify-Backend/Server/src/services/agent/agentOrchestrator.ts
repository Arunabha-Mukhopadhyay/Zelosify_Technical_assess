/**
 * Agent Orchestrator — Full LLM Tool-Calling Agent
 *
 * Architecture:
 *   Controller
 *     └─ RecommendationService (entry point, fire-and-forget)
 *         └─ AgentOrchestrator  ← THIS FILE
 *             └─ Groq LLM (tool-calling enabled, llama3-groq-70b)
 *                 └─ Tool Registry
 *                     ├─ resumeParsingTool      (S3 download + PDF/PPTX parse)
 *                     ├─ featureExtractionTool  (LLM structured output)
 *                     ├─ skillNormalizationTool (alias map + LLM)
 *                     └─ deterministicMatchingTool (scoring engine — ALWAYS invoked)
 *                 └─ SchemaValidator
 *                 └─ DecisionPolicy
 */

import axios from "axios";
import { logger } from "../../utils/logger/structuredLogger.js";
import { resumeParsingTool, type ParsedResume } from "./tools/resumeParsingTool.js";
import {
  featureExtractionTool,
  type ExtractedFeatures,
} from "./tools/featureExtractionTool.js";
import { skillNormalizationTool } from "./tools/skillNormalizationTool.js";
import { deterministicMatchingTool, type MatchingToolOutput } from "./tools/deterministicMatchingTool.js";
import { applyDecisionPolicy } from "./decisionPolicy.js";
import { validateAgentOutput, type AgentOutput } from "./schemaValidator.js";
import { TOOL_NAMES } from "./toolRegistry.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ORCHESTRATOR_MODEL = "llama3-groq-70b-8192-tool-use-preview";
const AGENT_VERSION = "1.0.0";
const MAX_TOOL_ROUNDS = 8;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 150;

// ─── Input / Output ───────────────────────────────────────────────────────────
export interface AgentInput {
  profileId: number;
  s3Key: string;
  openingId: string;
  openingTitle: string;
  openingDescription: string | null;
  openingLocation: string | null;
  openingContractType: string | null;
  experienceMin: number;
  experienceMax: number | null;
  requiredSkills: string[];
}

// ─── Groq Tool Definitions ────────────────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: TOOL_NAMES.RESUME_PARSING,
      description:
        "Download and parse a candidate resume (PDF or PPTX) from S3. Returns structured resume data including skills, experience years, location, and raw text.",
      parameters: {
        type: "object",
        properties: {
          s3Key: {
            type: "string",
            description: "The S3 object key of the resume file",
          },
        },
        required: ["s3Key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: TOOL_NAMES.FEATURE_EXTRACTION,
      description:
        "Extract structured feature vector from a parsed resume relative to a job opening. Use this after resume parsing to understand candidate strengths.",
      parameters: {
        type: "object",
        properties: {
          rawText: { type: "string", description: "Sanitized resume raw text" },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Skills already detected from heuristics",
          },
          experienceYears: {
            type: "number",
            description: "Experience years detected from heuristics",
          },
          location: {
            type: "string",
            description: "Candidate location from heuristics",
          },
        },
        required: ["rawText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: TOOL_NAMES.SKILL_NORMALIZATION,
      description:
        "Normalize raw skill names to standard industry terms (e.g., 'js' → 'JavaScript', 'k8s' → 'Kubernetes'). Call this after feature extraction.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Raw skill names to normalize",
          },
        },
        required: ["skills"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: TOOL_NAMES.DETERMINISTIC_MATCHING,
      description:
        "MANDATORY: Run the deterministic scoring engine. Must be called before producing final output. Returns skill match, experience match, location match scores and final composite score.",
      parameters: {
        type: "object",
        properties: {
          candidateSkills: {
            type: "array",
            items: { type: "string" },
            description: "Normalized candidate skills",
          },
          experienceYears: {
            type: "number",
            description: "Candidate total experience in years",
          },
          candidateLocation: {
            type: "string",
            description: "Candidate location",
          },
        },
        required: ["candidateSkills", "experienceYears", "candidateLocation"],
      },
    },
  },
];

// ─── Internal State ───────────────────────────────────────────────────────────
interface AgentState {
  parsedResume: ParsedResume | null;
  extractedFeatures: ExtractedFeatures | null;
  normalizedSkills: string[] | null;
  scoringResult: MatchingToolOutput | null;
  tokenUsage: { promptTokens: number; completionTokens: number };
  toolCallLog: { tool: string; latencyMs: number }[];
}

// ─── Tool Executor ────────────────────────────────────────────────────────────
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  input: AgentInput,
  state: AgentState
): Promise<unknown> {
  const start = Date.now();

  let result: unknown;

  switch (toolName) {
    case TOOL_NAMES.RESUME_PARSING: {
      result = await resumeParsingTool(args.s3Key as string ?? input.s3Key);
      state.parsedResume = result as ParsedResume;
      break;
    }

    case TOOL_NAMES.FEATURE_EXTRACTION: {
      const pr = state.parsedResume;
      result = await featureExtractionTool({
        parsedResume: pr ?? {
          rawText: (args.rawText as string) ?? "",
          skills: (args.skills as string[]) ?? [],
          normalizedSkills: [],
          experienceYears: (args.experienceYears as number) ?? 0,
          location: (args.location as string) ?? "Unknown",
          education: [],
          keywords: [],
        },
        openingTitle: input.openingTitle,
        openingDescription: input.openingDescription,
        experienceMin: input.experienceMin,
        experienceMax: input.experienceMax,
        openingLocation: input.openingLocation,
      });
      state.extractedFeatures = result as ExtractedFeatures;
      break;
    }

    case TOOL_NAMES.SKILL_NORMALIZATION: {
      const rawSkills = (args.skills as string[]) ??
        state.extractedFeatures?.skills ??
        state.parsedResume?.skills ?? [];
      result = await skillNormalizationTool(rawSkills);
      state.normalizedSkills = result as string[];
      break;
    }

    case TOOL_NAMES.DETERMINISTIC_MATCHING: {
      const featureVector = {
        candidateSkills: (args.candidateSkills as string[]) ??
          state.normalizedSkills ??
          state.extractedFeatures?.skills ??
          state.parsedResume?.skills ?? [],
        experienceYears: (args.experienceYears as number) ??
          state.extractedFeatures?.experienceYears ??
          state.parsedResume?.experienceYears ?? 0,
        candidateLocation: (args.candidateLocation as string) ??
          state.extractedFeatures?.location ??
          state.parsedResume?.location ?? "Unknown",
        requiredSkills: input.requiredSkills,
        experienceMin: input.experienceMin,
        experienceMax: input.experienceMax,
        openingLocation: input.openingLocation,
      };
      result = await deterministicMatchingTool({ featureVector });
      state.scoringResult = result as MatchingToolOutput;
      break;
    }

    default:
      result = { error: `Unknown tool: ${toolName}` };
  }

  const latencyMs = Date.now() - start;
  state.toolCallLog.push({ tool: toolName, latencyMs });

  logger.info("[Orchestrator] Tool executed", {
    tool: toolName,
    latencyMs,
    profileId: input.profileId,
  });

  return result;
}

// ─── Groq API Caller ──────────────────────────────────────────────────────────
async function callGroq(messages: unknown[]): Promise<{
  message: { role: string; content: string | null; tool_calls?: unknown[] };
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  const response = await axios.post(
    GROQ_URL,
    {
      model: ORCHESTRATOR_MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 800,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  return {
    message: response.data.choices[0].message,
    usage: response.data.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
  };
}

// ─── System Prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are an AI hiring assistant that evaluates candidate profiles against job openings.

You have access to these tools:
1. resumeParsingTool — Parse the candidate's resume from S3 (always call this first)
2. featureExtractionTool — Extract structured features from the parsed resume
3. skillNormalizationTool — Normalize skill names to standard terms
4. deterministicMatchingTool — MANDATORY: Run the scoring engine (ALWAYS call this before finalizing)

Workflow:
1. Parse the resume
2. Extract features
3. Normalize skills
4. Run deterministic scoring (MANDATORY)
5. Produce final recommendation

IMPORTANT: You MUST call deterministicMatchingTool before producing your final answer.
The final answer must be a JSON object ONLY with these exact fields:
{
  "recommended": <boolean>,
  "score": <number between 0 and 1>,
  "confidence": <number between 0 and 1>,
  "reason": <string: 1-2 sentence explanation>,
  "skillMatchScore": <number>,
  "experienceMatchScore": <number>,
  "locationMatchScore": <number>
}`;
}

function buildUserPrompt(input: AgentInput): string {
  return `Evaluate candidate profile for this job opening:

Opening: "${input.openingTitle}"
${input.openingDescription ? `Description: ${input.openingDescription.substring(0, 500)}` : ""}
Experience required: ${input.experienceMin}${input.experienceMax ? `–${input.experienceMax}` : "+"} years
Location: ${input.openingLocation ?? "Not specified"}
Contract type: ${input.openingContractType ?? "Not specified"}
Required skills: ${input.requiredSkills.length > 0 ? input.requiredSkills.join(", ") : "Not specified"}

Profile ID: ${input.profileId}
Resume S3 key: ${input.s3Key}

Start by parsing the resume using resumeParsingTool.`;
}

// ─── Final Output Parser ──────────────────────────────────────────────────────
function parseFinalOutput(
  content: string,
  state: AgentState,
  totalLatencyMs: number
): AgentOutput {
  const scoring = state.scoringResult?.scores;

  // If scoring was never run, run it now deterministically
  const finalScore = scoring?.finalScore ?? 0;
  const policy = applyDecisionPolicy(finalScore);

  // Try to parse LLM final JSON
  let llmOutput: Partial<AgentOutput> = {};
  try {
    const jsonStr = content
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      llmOutput = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1));
    }
  } catch {
    logger.warn("[Orchestrator] Could not parse LLM final JSON, using scoring result");
  }

  const reason =
    typeof llmOutput.reason === "string" && llmOutput.reason.length > 5
      ? llmOutput.reason
      : `Score: ${Math.round(finalScore * 100)}% — ${policy.decision.toLowerCase().replace("_", " ")}. ` +
        `Skill match: ${Math.round((scoring?.skillMatchScore ?? 0) * 100)}%, ` +
        `Experience match: ${Math.round((scoring?.experienceMatchScore ?? 0) * 100)}%, ` +
        `Location match: ${Math.round((scoring?.locationMatchScore ?? 0) * 100)}%.`;

  const raw: AgentOutput = {
    recommended: policy.recommended,
    score: finalScore,
    confidence: policy.confidenceScore,
    reason,
    skillMatchScore: scoring?.skillMatchScore ?? 0,
    experienceMatchScore: scoring?.experienceMatchScore ?? 0,
    locationMatchScore: scoring?.locationMatchScore ?? 0,
    latencyMs: totalLatencyMs,
    version: AGENT_VERSION,
  };

  return validateAgentOutput(raw);
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────
async function runAgentLoop(input: AgentInput, startTime: number): Promise<AgentOutput> {
  const state: AgentState = {
    parsedResume: null,
    extractedFeatures: null,
    normalizedSkills: null,
    scoringResult: null,
    tokenUsage: { promptTokens: 0, completionTokens: 0 },
    toolCallLog: [],
  };

  const messages: unknown[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { message, usage } = await callGroq(messages);

    // Accumulate token usage
    state.tokenUsage.promptTokens += usage.prompt_tokens;
    state.tokenUsage.completionTokens += usage.completion_tokens;

    logger.info("[Orchestrator] LLM round complete", {
      round,
      profileId: input.profileId,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0),
      elapsedMs: Date.now() - startTime,
    });

    // Add assistant message to context
    messages.push(message);

    // If no more tool calls, parse final output
    if (!message.tool_calls || message.tool_calls.length === 0) {
      // Safety check: if scoring was never run, force it now
      if (!state.scoringResult) {
        logger.warn("[Orchestrator] Scoring was not called by LLM — running deterministically", {
          profileId: input.profileId,
        });
        const fallbackResult = await deterministicMatchingTool({
          featureVector: {
            candidateSkills:
              state.normalizedSkills ??
              state.extractedFeatures?.skills ??
              state.parsedResume?.skills ?? [],
            experienceYears:
              state.extractedFeatures?.experienceYears ??
              state.parsedResume?.experienceYears ?? 0,
            candidateLocation:
              state.extractedFeatures?.location ??
              state.parsedResume?.location ?? "Unknown",
            requiredSkills: input.requiredSkills,
            experienceMin: input.experienceMin,
            experienceMax: input.experienceMax,
            openingLocation: input.openingLocation,
          },
        });
        state.scoringResult = fallbackResult;
      }

      const totalLatencyMs = Date.now() - startTime;

      logger.info("[Orchestrator] Agent complete", {
        profileId: input.profileId,
        totalLatencyMs,
        totalPromptTokens: state.tokenUsage.promptTokens,
        totalCompletionTokens: state.tokenUsage.completionTokens,
        toolsInvoked: state.toolCallLog.map((t) => t.tool),
        finalScore: state.scoringResult?.scores.finalScore,
      });

      return parseFinalOutput(message.content ?? "", state, totalLatencyMs);
    }

    // Execute tool calls
    const toolCalls = message.tool_calls as Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;

    for (const toolCall of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      const toolResult = await executeTool(
        toolCall.function.name,
        args,
        input,
        state
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  // Exhausted rounds — produce best-effort output
  logger.warn("[Orchestrator] Max tool rounds reached — producing best-effort output", {
    profileId: input.profileId,
  });

  // Ensure scoring is done
  if (!state.scoringResult) {
    const fallbackResult = await deterministicMatchingTool({
      featureVector: {
        candidateSkills: state.normalizedSkills ?? state.parsedResume?.skills ?? [],
        experienceYears: state.parsedResume?.experienceYears ?? 0,
        candidateLocation: state.parsedResume?.location ?? "Unknown",
        requiredSkills: input.requiredSkills,
        experienceMin: input.experienceMin,
        experienceMax: input.experienceMax,
        openingLocation: input.openingLocation,
      },
    });
    state.scoringResult = fallbackResult;
  }

  return parseFinalOutput("", state, Date.now() - startTime);
}

// ─── Public Entry Point (with retry) ─────────────────────────────────────────
export async function runAgentOrchestrator(input: AgentInput): Promise<AgentOutput> {
  logger.info("[Orchestrator] Starting agent", {
    profileId: input.profileId,
    openingId: input.openingId,
    s3Key: input.s3Key,
  });

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();

    try {
      const result = await runAgentLoop(input, startTime);
      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      logger.warn("[Orchestrator] Attempt failed", {
        attempt,
        maxRetries: MAX_RETRIES,
        profileId: input.profileId,
        error: lastError.message,
        latencyMs: Date.now() - startTime,
      });

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt)
        );
      }
    }
  }

  throw lastError;
}
