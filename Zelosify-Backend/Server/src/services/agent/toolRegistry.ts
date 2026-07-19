export const TOOL_NAMES = {
  RESUME_PARSING: 'resumeParsingTool',
  FEATURE_EXTRACTION: 'featureExtractionTool',
  SKILL_NORMALIZATION: 'skillNormalizationTool',
  DETERMINISTIC_MATCHING: 'deterministicMatchingTool',
  SCORING_ENGINE: 'scoringEngine',
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
