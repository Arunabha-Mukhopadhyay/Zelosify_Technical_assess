import zlib from "zlib";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AwsStorageService } from "../../storage/aws/awsStorageService.js";
import { logger } from "../../../utils/logger/structuredLogger.js";

export interface ParsedResume {
  experienceYears: number;
  skills: string[];
  normalizedSkills: string[];
  location: string;
  education: string[];
  keywords: string[];
  rawText: string;
}

// ─── Prompt Injection Sanitizer ───────────────────────────────────────────────
// Strips content that could manipulate LLM system prompts
function sanitizeResumeText(text: string): string {
  return text
    .replace(/ignore\s+(previous|above|all)\s+instructions?/gi, "[REDACTED]")
    .replace(/system\s*prompt/gi, "[REDACTED]")
    .replace(/you\s+are\s+(now|a)\s+/gi, "[REDACTED]")
    .replace(/<\|.*?\|>/g, "[REDACTED]")
    .replace(/\[INST\]|\[\/INST\]/g, "[REDACTED]")
    .replace(/###\s*(System|Instruction)/gi, "[REDACTED]")
    .substring(0, 8000); // hard cap to avoid token overflow
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // pdf-extraction is already in package.json
    const pdfExtraction = await import("pdf-extraction");
    const extract = pdfExtraction.default ?? pdfExtraction;
    const data = await extract(buffer);
    return data.text || "";
  } catch (err) {
    logger.warn("[ResumeParser] PDF extraction failed, falling back to raw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return buffer.toString("utf8").replace(/[^\x20-\x7E\n]/g, " ");
  }
}

// ─── PPTX Parser (ZIP reader using built-in zlib) ────────────────────────────
interface ZipEntry {
  name: string;
  data: Buffer;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);

    // Local file header signature: 0x04034b50
    if (signature !== 0x04034b50) {
      offset++;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length) break;

    const fileName = buffer.slice(nameStart, nameEnd).toString("utf8");
    const compressedData = buffer.slice(dataStart, dataEnd);

    try {
      let entryData: Buffer;
      if (compressionMethod === 0) {
        // Stored (no compression)
        entryData = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate
        entryData = zlib.inflateRawSync(compressedData);
      } else {
        offset = dataEnd;
        continue;
      }
      entries.push({ name: fileName, data: entryData });
    } catch {
      // Skip unreadable entries
    }

    offset = dataEnd;
  }

  return entries;
}

function extractXmlText(xml: string): string {
  // Extract text from PowerPoint XML text run tags (<a:t>...</a:t>)
  const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
  return matches
    .map((m) => m.replace(/<[^>]+>/g, "").trim())
    .filter((t) => t.length > 1)
    .join(" ");
}

async function parsePptx(buffer: Buffer): Promise<string> {
  try {
    const entries = readZipEntries(buffer);
    const slideEntries = entries
      .filter(
        (e) =>
          e.name.startsWith("ppt/slides/slide") && e.name.endsWith(".xml")
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (slideEntries.length === 0) {
      // Fallback: try to find any readable text in the binary
      return buffer.toString("utf8").replace(/[^\x20-\x7E\n]/g, " ");
    }

    const slideTexts = slideEntries.map((e) => extractXmlText(e.data.toString("utf8")));
    return slideTexts.join("\n\n");
  } catch (err) {
    logger.warn("[ResumeParser] PPTX extraction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "";
  }
}

// ─── S3 Downloader ───────────────────────────────────────────────────────────
async function downloadFromS3(s3Key: string): Promise<Buffer> {
  const storageService = new AwsStorageService();
  // Access the internal S3 client to do a GetObject
  const s3Client = (storageService as any).s3Client;
  const bucketName = (storageService as any).bucket;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ─── Heuristic Structuring (fast, deterministic) ─────────────────────────────
const SKILL_KEYWORDS = [
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "rust",
  "react", "next.js", "vue", "angular", "node.js", "express", "fastapi",
  "django", "flask", "spring", "aws", "azure", "gcp", "docker", "kubernetes",
  "postgresql", "mysql", "mongodb", "redis", "graphql", "rest", "grpc",
  "git", "ci/cd", "jenkins", "terraform", "linux", "sql", "nosql",
  "machine learning", "deep learning", "tensorflow", "pytorch", "pandas",
  "numpy", "spark", "kafka", "rabbitmq", "elasticsearch", "prisma",
];

const EDUCATION_KEYWORDS = [
  "bachelor", "master", "phd", "b.sc", "m.sc", "b.tech", "m.tech",
  "degree", "university", "college", "institute", "diploma",
];

function heuristicStructure(rawText: string): Omit<ParsedResume, "rawText"> {
  const lower = rawText.toLowerCase();

  // Skills: match known tech keywords
  const skills = SKILL_KEYWORDS.filter((kw) => lower.includes(kw));

  // Experience years: look for patterns like "5 years", "3+ years"
  const expMatches = rawText.match(/(\d+)\+?\s*years?\s*(of\s+)?(experience|exp)/i);
  const experienceYears = expMatches ? parseInt(expMatches[1], 10) : 0;

  // Location: look for city patterns
  const locationMatch = rawText.match(
    /(?:location|based in|residing in|city)[:\s]+([A-Z][a-zA-Z\s]+)/
  );
  const location = locationMatch ? locationMatch[1].trim() : "Unknown";

  // Education: extract sentences with degree keywords
  const lines = rawText.split(/[\n.]/);
  const education = lines
    .filter((line) =>
      EDUCATION_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))
    )
    .slice(0, 3)
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  // Keywords: top words excluding stop words
  const stopWords = new Set(["the", "and", "for", "with", "this", "that", "from", "have", "are", "was"]);
  const wordFreq: Record<string, number> = {};
  rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);

  return {
    skills,
    normalizedSkills: skills, // will be normalized by orchestrator in skill normalization phase
    experienceYears,
    location,
    education,
    keywords,
  };
}

// ─── Main Tool Export ─────────────────────────────────────────────────────────
export async function resumeParsingTool(s3Key: string): Promise<ParsedResume> {
  logger.info("[ResumeParsingTool] Starting", { s3Key });
  const start = Date.now();

  const buffer = await downloadFromS3(s3Key);
  logger.info("[ResumeParsingTool] Downloaded from S3", {
    s3Key,
    bytes: buffer.length,
    ms: Date.now() - start,
  });

  const ext = s3Key.split(".").pop()?.toLowerCase() ?? "";
  let rawText: string;

  if (ext === "pdf") {
    rawText = await parsePdf(buffer);
  } else if (ext === "pptx" || ext === "ppt") {
    rawText = await parsePptx(buffer);
  } else {
    rawText = buffer.toString("utf8");
  }

  const sanitized = sanitizeResumeText(rawText);
  const structured = heuristicStructure(sanitized);

  logger.info("[ResumeParsingTool] Done", {
    s3Key,
    extractedSkills: structured.skills.length,
    experienceYears: structured.experienceYears,
    latencyMs: Date.now() - start,
  });

  return { ...structured, rawText: sanitized };
}
