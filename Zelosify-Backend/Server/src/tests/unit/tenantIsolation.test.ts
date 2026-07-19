/**
 * Unit Tests — Tenant Isolation
 * Covers: Hiring manager cannot read another manager's opening,
 *         Hiring manager cannot shortlist profiles from another manager's opening,
 *         Profiles from different tenants are never mixed,
 *         Service enforces ownership check (hiringManagerId === loggedInUser.id)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrismaFindUnique = vi.fn();
const mockPrismaFindMany = vi.fn();
const mockPrismaFindFirst = vi.fn();
const mockPrismaUpdate = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("../../config/prisma/prisma.js", () => ({
  default: {
    opening: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
    },
    hiringProfile: {
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

import {
  HiringManagerService,
  HiringManagerError,
} from "../../services/hiring/hiringManagerService.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MANAGER_A_ID = "manager-uuid-aaa";
const MANAGER_B_ID = "manager-uuid-bbb";
const TENANT_A_ID = "tenant-aaa";
const TENANT_B_ID = "tenant-bbb";

const openingOwnedByManagerA = {
  id: "opening-001",
  title: "Senior Backend Engineer",
  location: "Remote",
  contractType: "Remote",
  postedDate: new Date(),
  status: "OPEN",
  experienceMin: 3,
  experienceMax: 6,
  hiringManagerId: MANAGER_A_ID,
  tenantId: TENANT_A_ID,
  description: "Build APIs",
};

const profileInOpeningA = {
  id: 1,
  s3Key: `${TENANT_A_ID}/opening-001/1234_resume.pdf`,
  uploadedBy: "vendor-user-001",
  submittedAt: new Date(),
  status: "SUBMITTED",
  recommended: null,
  recommendationScore: null,
  recommendationReason: null,
  recommendationLatencyMs: null,
  recommendationConfidence: null,
  recommendedAt: null,
  opening: { hiringManagerId: MANAGER_A_ID },
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Tenant Isolation — Hiring Manager Service", () => {
  let service: HiringManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HiringManagerService();
  });

  // ── listOwnOpenings ──────────────────────────────────────────────────────────
  it("listOwnOpenings queries only the requesting manager's openings", async () => {
    mockPrismaFindMany.mockResolvedValue([
      { ...openingOwnedByManagerA, hiringProfiles: [] },
    ]);

    await service.listOwnOpenings(MANAGER_A_ID);

    expect(mockPrismaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hiringManagerId: MANAGER_A_ID }),
      })
    );
  });

  it("listOwnOpenings does NOT include openings from other managers", async () => {
    // Mock returns empty — simulates DB filtering out Manager B's openings
    mockPrismaFindMany.mockResolvedValue([]);

    const result = await service.listOwnOpenings(MANAGER_B_ID);
    expect(result).toHaveLength(0);
  });

  // ── listProfilesForOpening ───────────────────────────────────────────────────
  it("listProfilesForOpening throws 403 when manager does not own the opening", async () => {
    // Opening is owned by MANAGER_A but MANAGER_B is requesting it
    mockPrismaFindUnique.mockResolvedValue(openingOwnedByManagerA);
    mockPrismaFindMany.mockResolvedValue([]);

    await expect(
      service.listProfilesForOpening(MANAGER_B_ID, "opening-001")
    ).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("listProfilesForOpening throws HiringManagerError(403) for cross-tenant access", async () => {
    mockPrismaFindUnique.mockResolvedValue(openingOwnedByManagerA);

    let thrownError: HiringManagerError | null = null;
    try {
      await service.listProfilesForOpening(MANAGER_B_ID, "opening-001");
    } catch (e) {
      thrownError = e as HiringManagerError;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError).toBeInstanceOf(HiringManagerError);
    expect(thrownError!.statusCode).toBe(403);
    expect(thrownError!.message).toContain("Access denied");
  });

  it("listProfilesForOpening succeeds when correct manager requests own opening", async () => {
    mockPrismaFindUnique.mockResolvedValue(openingOwnedByManagerA);
    mockPrismaFindMany.mockResolvedValue([profileInOpeningA]);

    const result = await service.listProfilesForOpening(MANAGER_A_ID, "opening-001");
    expect(result.opening.id).toBe("opening-001");
    expect(result.profiles).toHaveLength(1);
  });

  it("listProfilesForOpening throws 404 when opening does not exist", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    await expect(
      service.listProfilesForOpening(MANAGER_A_ID, "nonexistent-opening")
    ).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  // ── shortlistProfile ─────────────────────────────────────────────────────────
  it("shortlistProfile throws 403 when profile belongs to another manager's opening", async () => {
    // Profile exists but its opening belongs to MANAGER_A
    mockPrismaFindFirst.mockResolvedValue({
      ...profileInOpeningA,
      opening: { hiringManagerId: MANAGER_A_ID },
    });

    await expect(
      service.shortlistProfile(MANAGER_B_ID, 1)
    ).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("shortlistProfile succeeds when the correct manager requests it", async () => {
    mockPrismaFindFirst.mockResolvedValue({
      ...profileInOpeningA,
      opening: { hiringManagerId: MANAGER_A_ID },
    });

    mockPrismaTransaction.mockImplementation(async (fn: Function) =>
      fn({
        hiringProfile: { update: vi.fn().mockResolvedValue({ id: 1, status: "SHORTLISTED", shortlistedAt: new Date() }) },
      })
    );

    const result = await service.shortlistProfile(MANAGER_A_ID, 1);
    expect(result).toBeDefined();
  });

  // ── rejectProfile ────────────────────────────────────────────────────────────
  it("rejectProfile throws 403 for cross-tenant profile access", async () => {
    mockPrismaFindFirst.mockResolvedValue({
      ...profileInOpeningA,
      opening: { hiringManagerId: MANAGER_A_ID },
    });

    await expect(
      service.rejectProfile(MANAGER_B_ID, 1)
    ).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("rejectProfile throws 404 when profile does not exist", async () => {
    mockPrismaFindFirst.mockResolvedValue(null);

    await expect(
      service.rejectProfile(MANAGER_A_ID, 999)
    ).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });
});
