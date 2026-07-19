import axios from "axios";
import { logger } from "../../../utils/logger/structuredLogger.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

// Common aliases to normalize without LLM call (fast path)
const ALIAS_MAP: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  py: "Python",
  "node.js": "Node.js",
  nodejs: "Node.js",
  react: "React",
  reactjs: "React",
  "next.js": "Next.js",
  nextjs: "Next.js",
  postgres: "PostgreSQL",
  psql: "PostgreSQL",
  mongo: "MongoDB",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  k8s: "Kubernetes",
  kube: "Kubernetes",
  tf: "TensorFlow",
  pytorch: "PyTorch",
  "c++": "C++",
  "c#": "C#",
  golang: "Go",
  rs: "Rust",
};

export async function skillNormalizationTool(skills: string[]): Promise<string[]> {
  if (skills.length === 0) return [];

  logger.info("[SkillNormalizationTool] Starting", { skillCount: skills.length });
  const start = Date.now();

  // Fast path: normalize known aliases without LLM
  const fastNormalized = skills.map((s) => {
    const lower = s.toLowerCase().trim();
    return ALIAS_MAP[lower] ?? s;
  });

  // If all skills were normalized by alias map, skip LLM
  const unknownSkills = skills.filter((s) => !ALIAS_MAP[s.toLowerCase().trim()]);
  if (unknownSkills.length === 0) {
    logger.info("[SkillNormalizationTool] All normalized via alias map (no LLM needed)", {
      latencyMs: Date.now() - start,
    });
    return fastNormalized;
  }

  // LLM normalization for unknown/ambiguous skills
  const systemPrompt = `You are a technical skill normalizer. Given a list of raw skill names (which may be abbreviated, misspelled, or in non-standard form), return a JSON array of normalized skill names using the standard industry term.

Rules:
- "js" → "JavaScript", "ts" → "TypeScript", "py" → "Python"
- Capitalize properly: "react" → "React", "nodejs" → "Node.js"
- Keep correct casing for acronyms: "aws" → "AWS", "gcp" → "GCP"
- Deduplicate: if two skills are the same, keep only one
- Return ONLY a JSON array, no explanation, no markdown`;

  const userPrompt = `Normalize these skills: ${JSON.stringify(unknownSkills)}`;

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.0,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 4000,
      }
    );

    const content = response.data.choices[0]?.message?.content ?? "[]";
    logger.info("[SkillNormalizationTool] LLM response received", {
      latencyMs: Date.now() - start,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens,
    });

    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const llmNormalized: string[] = JSON.parse(jsonStr);

    // Merge: fast-normalized known skills + LLM-normalized unknown skills
    const knownNormalized = fastNormalized.filter(
      (s, i) => ALIAS_MAP[skills[i]?.toLowerCase()?.trim() ?? ""]
    );
    const combined = [...new Set([...knownNormalized, ...llmNormalized])];

    logger.info("[SkillNormalizationTool] Done", {
      input: skills.length,
      output: combined.length,
      latencyMs: Date.now() - start,
    });

    return combined;
  } catch (err) {
    // Fallback: return fast-normalized version
    logger.warn("[SkillNormalizationTool] LLM call failed, using fast normalization", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fastNormalized;
  }
}
