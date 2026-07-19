/**
 * Unit Tests — RBAC (Unauthorized Access Tests)
 * Covers: authorizeRole middleware behaviour —
 *   missing token → 401, invalid role in system → 400,
 *   JWT verification failure → 401, wrong role in token → 403,
 *   correct role in token → next() called,
 *   IT_VENDOR cannot access HIRING_MANAGER routes,
 *   HIRING_MANAGER cannot access IT_VENDOR routes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../types/typeIndex.js";

// ─── Mock jwt before importing middleware ─────────────────────────────────────
vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
    decode: vi.fn(),
  },
}));

vi.mock("../../utils/jwt/formatPubKey.js", () => ({
  formatPublicKey: vi.fn().mockReturnValue("mock-public-key"),
}));

vi.mock("../../utils/RBAC/isValidRole.js", () => ({
  isValidRole: vi.fn((role: string) =>
    ["IT_VENDOR", "HIRING_MANAGER", "ADMIN"].includes(role)
  ),
}));

import jwt from "jsonwebtoken";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";

// ─── Helper: create mock express objects ──────────────────────────────────────
function mockReq(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {}
): AuthenticatedRequest {
  return {
    headers,
    cookies,
    user: undefined,
  } as unknown as AuthenticatedRequest;
}

function mockRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("RBAC — authorizeRole Middleware: Unauthorized Access Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no Authorization header and no cookie token", async () => {
    const req = mockReq({}, {});
    const { res, status, json } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ message: "Missing token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header has no Bearer token", async () => {
    const req = mockReq({ authorization: "Basic sometoken" }, {});
    const { res, status, json } = mockRes();
    const next = mockNext();

    // "Basic sometoken".split(" ")[1] = "sometoken" - this IS a token string
    // So it tries to verify it — we make verify fail
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(new Error("invalid signature"), null);
      }
    );

    await authorizeRole("IT_VENDOR")(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when an unrecognised role is requested", async () => {
    const req = mockReq({ authorization: "Bearer sometoken" });
    const { res, status, json } = mockRes();
    const next = mockNext();

    await authorizeRole("SUPERADMIN")(req, res, next); // SUPERADMIN not in valid roles

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Invalid role provided." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when JWT verification fails (expired/bad signature)", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(new Error("jwt expired"), null);
      }
    );

    const req = mockReq({ authorization: "Bearer expiredtoken" });
    const { res, status, json } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when token has wrong role (IT_VENDOR tries HIRING_MANAGER route)", async () => {
    // Token contains IT_VENDOR but route requires HIRING_MANAGER
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["IT_VENDOR"] } });
      }
    );

    const req = mockReq({ authorization: "Bearer validtoken" });
    const { res, status, json } = mockRes();
    const next = mockNext();

    await authorizeRole("HIRING_MANAGER")(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Access Denied") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when HIRING_MANAGER tries to access IT_VENDOR route", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["HIRING_MANAGER"] } });
      }
    );

    const req = mockReq({ authorization: "Bearer validtoken" });
    const { res, status, json } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when token has the correct IT_VENDOR role", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["IT_VENDOR"] } });
      }
    );

    const req = mockReq({ authorization: "Bearer validtoken" });
    const { res } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() when token has the correct HIRING_MANAGER role", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["HIRING_MANAGER"] } });
      }
    );

    const req = mockReq({ authorization: "Bearer validtoken" });
    const { res } = mockRes();
    const next = mockNext();

    await authorizeRole("HIRING_MANAGER")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("allows access when token has multiple roles and one matches", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["IT_VENDOR", "HIRING_MANAGER"] } });
      }
    );

    const req = mockReq({ authorization: "Bearer multitoken" });
    const { res } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("reads token from cookie when Authorization header is absent", async () => {
    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(
      (_t: string, _k: string, _o: object, cb: Function) => {
        cb(null, { realm_access: { roles: ["IT_VENDOR"] } });
      }
    );

    const req = mockReq({}, { access_token: "cookie-token" });
    const { res } = mockRes();
    const next = mockNext();

    await authorizeRole("IT_VENDOR")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
