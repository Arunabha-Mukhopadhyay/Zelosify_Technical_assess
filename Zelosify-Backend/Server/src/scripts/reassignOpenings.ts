/**
 * Quick fix: reassign all openings to a specific hiring manager user
 * Usage: npx ts-node src/scripts/reassignOpenings.ts <new-manager-user-id>
 */
import prisma from "../config/prisma/prisma.js";

const newManagerId = process.argv[2];

if (!newManagerId) {
  console.error("❌ Usage: npx ts-node src/scripts/reassignOpenings.ts <user-id>");
  process.exit(1);
}

async function reassign() {
  try {
    // Verify user exists and is HIRING_MANAGER
    const user = await prisma.user.findUnique({
      where: { id: newManagerId },
      select: { id: true, username: true, email: true, role: true },
    });

    if (!user) {
      console.error(`❌ User not found: ${newManagerId}`);
      process.exit(1);
    }

    if (user.role !== "HIRING_MANAGER") {
      console.error(`❌ User ${user.username} has role ${user.role}, not HIRING_MANAGER`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.username} (${user.email}) — Role: ${user.role}`);

    // Update all openings for the Bruce Wayne Corp tenant
    const result = await prisma.opening.updateMany({
      where: {
        tenantId: "8849b2cd-58d2-420a-9559-db96dff06ecc",
      },
      data: {
        hiringManagerId: newManagerId,
      },
    });

    console.log(`✅ Reassigned ${result.count} openings to ${user.username}`);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

reassign();
