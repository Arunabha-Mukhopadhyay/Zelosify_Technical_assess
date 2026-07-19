import prisma from '../../config/prisma/prisma.js';
import { logger } from '../../utils/logger/structuredLogger.js';
import { runAgentOrchestrator } from './agentOrchestrator.js';
import { validateAgentOutput } from './schemaValidator.js';
import { resumeParsingTool, primeParseCache } from './tools/resumeParsingTool.js';

const AGENT_VERSION = '1.0.0';

// ─── Skill keywords extracted from opening title/description (deterministic) ──
const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
  'react', 'next.js', 'vue', 'angular', 'node.js', 'express', 'fastapi',
  'django', 'flask', 'spring', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
  'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest', 'grpc',
  'git', 'ci/cd', 'jenkins', 'terraform', 'linux', 'sql', 'nosql',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas',
  'numpy', 'spark', 'kafka', 'rabbitmq', 'elasticsearch', 'prisma',
  'backend', 'frontend', 'devops', 'cloud', 'security', 'data', 'mobile',
  'api', 'microservices', 'agile', 'scrum',
];

/**
 * Extract required skills from opening title + description (heuristic, no LLM call).
 * This avoids adding a DB field while still giving the scoring engine meaningful signal.
 */
function extractRequiredSkillsFromOpening(title: string, description: string | null): string[] {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  return SKILL_KEYWORDS.filter((kw) => text.includes(kw));
}

export async function triggerRecommendationForProfile(
  profileId: number,
  openingId: string
): Promise<void> {
  const startTime = Date.now();

  logger.info('[RecommendationService] Starting AI recommendation', { profileId, openingId });

  try {
    // Fetch profile and opening data
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      select: { id: true, s3Key: true, openingId: true, recommendedAt: true },
    });

    if (!profile) {
      logger.error('[RecommendationService] Profile not found', { profileId });
      return;
    }

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
    // Skip if recommendation already ran for this profile (supports safe re-runs)
    if (profile.recommendedAt !== null) {
      logger.info('[RecommendationService] Recommendation already exists — skipping re-run', {
        profileId,
        recommendedAt: profile.recommendedAt,
      });
      return;
    }

    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        contractType: true,
        experienceMin: true,
        experienceMax: true,
      },
    });

    if (!opening) {
      logger.error('[RecommendationService] Opening not found', { openingId });
      return;
    }

    // Extract required skills from opening title + description (heuristic)
    const requiredSkills = extractRequiredSkillsFromOpening(
      opening.title,
      opening.description ?? null
    );

    logger.info('[RecommendationService] Extracted required skills from opening', {
      profileId,
      openingTitle: opening.title,
      requiredSkills,
    });

    const parsingStart = Date.now();

    // ── PRE-WARM PARSE CACHE ──────────────────────────────────────────────────
    // Parse the PDF NOW and prime the cache so the agent's resumeParsingTool
    // call gets an instant cache hit (eliminates 2-3s S3 re-download).
    try {
      const preParsed = await resumeParsingTool(profile.s3Key);
      primeParseCache(profile.s3Key, preParsed);
      logger.info('[RecommendationService] Parse cache pre-warmed', {
        profileId, s3Key: profile.s3Key, ms: Date.now() - parsingStart,
      });
    } catch (parseErr) {
      logger.warn('[RecommendationService] Pre-warm failed — agent will parse directly', {
        profileId, error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
    }

    // Run the agent orchestrator (full LLM tool-calling pipeline)
    const rawOutput = await runAgentOrchestrator({
      profileId,
      s3Key: profile.s3Key,
      openingId,
      openingTitle: opening.title,
      openingDescription: opening.description ?? null,
      openingLocation: opening.location ?? null,
      openingContractType: opening.contractType ?? null,
      experienceMin: opening.experienceMin,
      experienceMax: opening.experienceMax ?? null,
      requiredSkills,
    });

    const agentOutput = validateAgentOutput(rawOutput);
    const latencyMs = Date.now() - startTime;
    const parsingLatencyMs = Date.now() - parsingStart;

    logger.info('[RecommendationService] AI recommendation completed', {
      profileId,
      openingId,
      latencyMs,
      parsingLatencyMs,
      finalScore: agentOutput.score,
      recommended: agentOutput.recommended,
    });

    // Persist result in ACID transaction (no partial writes)
    await prisma.$transaction(async (tx) => {
      await tx.hiringProfile.update({
        where: { id: profileId },
        data: {
          recommended: agentOutput.recommended,
          recommendationScore: agentOutput.score,
          recommendationReason: agentOutput.reason,
          recommendationLatencyMs: latencyMs,
          recommendationVersion: AGENT_VERSION,
          recommendationConfidence: agentOutput.confidence,
          recommendedAt: new Date(),
        },
      });
    });

  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    logger.error('[RecommendationService] Agent failed', {
      profileId,
      openingId,
      latencyMs,
      error: message,
    });
  }
}
