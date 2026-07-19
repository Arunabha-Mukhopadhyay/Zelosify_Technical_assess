import prisma from '../../config/prisma/prisma.js';
import { logger } from '../../utils/logger/structuredLogger.js';
import { runAgentOrchestrator } from './agentOrchestrator.js';
import { validateAgentOutput } from './schemaValidator.js';

const AGENT_VERSION = '1.0.0-stub';

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
      select: { id: true, s3Key: true, openingId: true },
    });

    if (!profile) {
      logger.error('[RecommendationService] Profile not found', { profileId });
      return;
    }

    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      select: { id: true, title: true, description: true, location: true, contractType: true, experienceMin: true, experienceMax: true },
    });

    if (!opening) {
      logger.error('[RecommendationService] Opening not found', { openingId });
      return;
    }

    const parsingStart = Date.now();

    // Run the agent orchestrator
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
      requiredSkills: [], // TODO: extract from opening description in LLM stage
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

    // Persist result in a transaction
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

    // During stub phase, NOT_IMPLEMENTED is expected — log as warn, not error
    if (message.includes('NOT_IMPLEMENTED')) {
      logger.warn('[RecommendationService] Agent not yet implemented (LLM stage pending)', {
        profileId,
        openingId,
        latencyMs,
        note: message,
      });
      return;
    }

    logger.error('[RecommendationService] Agent failed', {
      profileId,
      openingId,
      latencyMs,
      error: message,
    });
  }
}
