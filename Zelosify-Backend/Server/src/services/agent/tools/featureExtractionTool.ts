import axios from "axios";
import type { ParsedResume } from "./resumeParsingTool.js";
import { logger } from "../../../utils/logger/structuredLogger.js";

export interface FeatureExtractionInput {
  parsedResume: ParsedResume;
  openingTitle: string;
  openingDescription: string | null;
  experienceMin: number;
  experienceMax: number | null;
  openingLocation: string | null;
}

export interface ExtractedFeatures {
  experienceYears: number;
  skills: string[];
  location: string;
  reasoning: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-groq-8b-8192-tool-use-preview";

export async function featureExtractionTool(
  input: FeatureExtractionInput
): Promise<ExtractedFeatures> {
  logger.info("[FeatureExtractionTool] Starting", {
    openingTitle: input.openingTitle,
  });
  const start = Date.now();

  const systemPrompt = `You are a precise resume feature extractor. Extract structured information from a parsed resume.
Your response MUST be valid JSON matching this schema exactly:
{
  "experienceYears": <number: total years of professional experience>,
  "skills": <array of strings: technical skills mentioned>,
  "location": <string: candidate location or "Unknown">,
  "reasoning": <string: one sentence explaining key strengths relative to the opening>
}
Do not add any text outside the JSON object.`;

  const userPrompt = `Opening: "${input.openingTitle}"
Required experience: ${input.experienceMin}${input.experienceMax ? `–${input.experienceMax}` : "+"} years
Opening location: ${input.openingLocation || "Not specified"}

Resume content (sanitized):
---
${input.parsedResume.rawText.substring(0, 3000)}
---

Already extracted by heuristics:
- Skills detected: ${input.parsedResume.skills.join(", ") || "none"}
- Experience years (heuristic): ${input.parsedResume.experienceYears}
- Location (heuristic): ${input.parsedResume.location}

Extract the most accurate values. Use the heuristic values as hints but correct them if the resume text clearly shows different values.`;

  const response = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 400,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    }
  );

  const content = response.data.choices[0]?.message?.content ?? "{}";
  logger.info("[FeatureExtractionTool] LLM response received", {
    latencyMs: Date.now() - start,
    promptTokens: response.data.usage?.prompt_tokens,
    completionTokens: response.data.usage?.completion_tokens,
  });

  // Parse JSON from response — strip any markdown fences if present
  const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  let parsed: ExtractedFeatures;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback to heuristic values if LLM output malformed
    logger.warn("[FeatureExtractionTool] JSON parse failed, using heuristics");
    parsed = {
      experienceYears: input.parsedResume.experienceYears,
      skills: input.parsedResume.skills,
      location: input.parsedResume.location,
      reasoning: "Extracted using heuristics (LLM output was malformed).",
    };
  }

  // Ensure required fields exist
  return {
    experienceYears:
      typeof parsed.experienceYears === "number"
        ? parsed.experienceYears
        : input.parsedResume.experienceYears,
    skills: Array.isArray(parsed.skills)
      ? parsed.skills
      : input.parsedResume.skills,
    location:
      typeof parsed.location === "string"
        ? parsed.location
        : input.parsedResume.location,
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "No reasoning provided.",
  };
}
