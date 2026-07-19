import prisma from "../config/prisma/prisma.js";
import { triggerRecommendationForProfile } from "../services/agent/recommendationService.js";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function retryFailedRecommendations() {
  const stuckProfiles = await prisma.hiringProfile.findMany({
    where: { recommendationScore: null, recommended: null }
  });

  console.log(`Found ${stuckProfiles.length} stuck profiles. Retrying...`);

  for (const profile of stuckProfiles) {
    console.log(`Retrying profile ${profile.id}...`);
    try {
      await triggerRecommendationForProfile(profile.id, profile.openingId);
      console.log(`✅ Success for profile ${profile.id}`);
    } catch (e: any) {
      console.error(`❌ Failed for profile ${profile.id}:`, e.message);
    }
    await delay(65000); // Wait 65 seconds between profiles to avoid TPM rate limit
  }
  process.exit(0);
}

retryFailedRecommendations();
