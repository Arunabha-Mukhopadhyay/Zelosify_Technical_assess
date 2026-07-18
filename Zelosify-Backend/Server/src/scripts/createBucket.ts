import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config();

async function createBucket() {
  const region = process.env.S3_AWS_REGION!;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;
  const bucketName = process.env.S3_BUCKET_NAME!;

  const s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      })
    );
    console.log(`✅ Bucket "${bucketName}" created successfully in ${region}`);
  } catch (error: any) {
    if (error.Code === "BucketAlreadyOwnedByYou") {
      console.log(`✅ Bucket "${bucketName}" already exists and is owned by you`);
    } else {
      console.error(`❌ Failed to create bucket: ${error.Code} - ${error.message}`);
    }
  } finally {
    await s3Client.destroy();
  }
}

createBucket();
