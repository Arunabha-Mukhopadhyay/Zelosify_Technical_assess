import prisma from "../config/prisma/prisma.js";

const TARGET_TENANT_ID = "8849b2cd-58d2-420a-9559-db96dff06ecc";
const LEGACY_SEED_TENANT_ID = "bruce-wayne-corp";

/**
 * Seeds the database with sample job openings for testing purposes.
 */
async function seedOpenings() {
  try {
    console.log("🌱 Seeding openings data...");

    await cleanupLegacySeedTenant();

    const tenant = await prisma.tenants.upsert({
      where: { tenantId: TARGET_TENANT_ID },
      update: { companyName: "Bruce Wayne Corp" },
      create: {
        tenantId: TARGET_TENANT_ID,
        companyName: "Bruce Wayne Corp",
      },
    });

    const hiringManager = await prisma.user.upsert({
      where: {
        email_provider: {
          email: "hiring.manager@brucewaynecorp.com",
          provider: "KEYCLOAK",
        },
      },
      update: {
        firstName: "Hiring",
        lastName: "Manager",
        role: "HIRING_MANAGER",
        tenantId: tenant.tenantId,
        department: "Technology",
      },
      create: {
        username: "hiring.manager",
        email: "hiring.manager@brucewaynecorp.com",
        firstName: "Hiring",
        lastName: "Manager",
        role: "HIRING_MANAGER",
        tenantId: tenant.tenantId,
        department: "Technology",
        provider: "KEYCLOAK",
      },
    });

    const openings = [
      {
        title: "Senior Backend Engineer",
        description:
          "Build secure Node.js APIs for contract workforce workflows.",
        location: "Gotham City",
        contractType: "Onsite",
        experienceMin: 5,
        experienceMax: 8,
      },
      {
        title: "React Frontend Consultant",
        description: "Deliver accessible dashboard screens in Next.js.",
        location: "Remote",
        contractType: "Remote",
        experienceMin: 3,
        experienceMax: 6,
      },
      {
        title: "DevOps Platform Engineer",
        description: "Own CI/CD, Docker, and cloud deployment automation.",
        location: "Gotham City",
        contractType: "Hybrid",
        experienceMin: 4,
        experienceMax: 7,
      },
      {
        title: "Cloud Security Analyst",
        description: "Review cloud workloads and harden identity boundaries.",
        location: "Remote",
        contractType: "Remote",
        experienceMin: 4,
        experienceMax: 9,
      },
      {
        title: "Data Engineer",
        description: "Create reliable pipelines for analytics workloads.",
        location: "Metropolis",
        contractType: "Hybrid",
        experienceMin: 3,
        experienceMax: 5,
      },
      {
        title: "QA Automation Engineer",
        description: "Automate regression suites for web and API flows.",
        location: "Gotham City",
        contractType: "Onsite",
        experienceMin: 2,
        experienceMax: 5,
      },
      {
        title: "Mobile App Developer",
        description: "Build cross-platform mobile workflows for field teams.",
        location: "Remote",
        contractType: "Remote",
        experienceMin: 4,
        experienceMax: 6,
      },
      {
        title: "Machine Learning Engineer",
        description: "Deploy recommendation services with model observability.",
        location: "Gotham City",
        contractType: "Hybrid",
        experienceMin: 5,
        experienceMax: 10,
      },
      {
        title: "Technical Program Manager",
        description: "Coordinate delivery across engineering and business teams.",
        location: "Metropolis",
        contractType: "Onsite",
        experienceMin: 7,
        experienceMax: 12,
      },
      {
        title: "Database Reliability Engineer",
        description: "Tune PostgreSQL workloads and improve backup posture.",
        location: "Remote",
        contractType: "Remote",
        experienceMin: 6,
        experienceMax: 10,
      },
      {
        title: "UI Systems Designer",
        description: "Create reusable components and dashboard interaction specs.",
        location: "Gotham City",
        contractType: "Hybrid",
        experienceMin: 3,
        experienceMax: 7,
      },
      {
        title: "Integration Engineer",
        description: "Connect internal systems with third-party vendor APIs.",
        location: "Star City",
        contractType: "Contract",
        experienceMin: 2,
        experienceMax: 4,
      },
    ];

    for (const opening of openings) {
      const openingId = `${tenant.tenantId}-${opening.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`;

      await prisma.opening.upsert({
        where: { id: openingId },
        update: {
          ...opening,
          tenantId: tenant.tenantId,
          hiringManagerId: hiringManager.id,
          status: "OPEN",
        },
        create: {
          id: openingId,
          ...opening,
          tenantId: tenant.tenantId,
          hiringManagerId: hiringManager.id,
          status: "OPEN",
        },
      });
    }

    console.log(`✅ Seeded ${openings.length} openings for ${tenant.companyName}`);
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupLegacySeedTenant() {
  const legacyOpenings = await prisma.opening.findMany({
    where: { tenantId: LEGACY_SEED_TENANT_ID },
    select: { id: true },
  });
  const legacyOpeningIds = legacyOpenings.map((opening) => opening.id);

  if (legacyOpeningIds.length > 0) {
    await prisma.hiringProfile.deleteMany({
      where: { openingId: { in: legacyOpeningIds } },
    });
    await prisma.opening.deleteMany({
      where: { id: { in: legacyOpeningIds } },
    });
  }

  await prisma.user.deleteMany({
    where: {
      tenantId: LEGACY_SEED_TENANT_ID,
      email: "hiring.manager@brucewaynecorp.com",
    },
  });

  await prisma.tenants.deleteMany({
    where: {
      tenantId: LEGACY_SEED_TENANT_ID,
      users: { none: {} },
      openings: { none: {} },
    },
  });
}

// Run the seed function
seedOpenings();
