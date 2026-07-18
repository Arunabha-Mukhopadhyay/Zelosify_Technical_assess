import * as dotenv from "dotenv";
import { AwsStorageService } from "../services/storage/aws/awsStorageService.js";

dotenv.config();

async function configureBucketCors() {
  const originEnv = process.env.S3_ALLOWED_ORIGINS || "http://localhost:5173";
  const allowedOrigins = originEnv
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error("No allowed origins provided for S3 CORS configuration.");
  }

  const storageService = new AwsStorageService();
  await storageService.configureBucketCors(allowedOrigins);
  console.log(
    `[S3 CORS] Configured bucket ${process.env.S3_BUCKET_NAME} for origins: ${allowedOrigins.join(", ")}`
  );
}

configureBucketCors().catch((error) => {
  console.error("[S3 CORS] Failed to configure bucket CORS:", error);
  process.exit(1);
});
