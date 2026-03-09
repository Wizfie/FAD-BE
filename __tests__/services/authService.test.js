import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma BEFORE importing service
vi.mock("../../utils/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    authFailure: vi.fn(),
  },
}));

// Import after mocking - use named imports
import { registerUser, loginUser } from "../../services/authService.js";
import { prisma } from "../../utils/prisma.js";
import ApiError from "../../utils/ApiError.js";

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
  });

  describe("registerUser", () => {
    it("should register user successfully", async () => {
      const mockUser = {
        id: 1,
        username: "newuser",
        email: "newuser@test.com",
        role: "operator",
        modules: ["module1"],
        status: "ACTIVE",
      };

      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await registerUser(
        "newuser",
        "password123",
        "operator",
        "newuser@test.com",
        "ACTIVE",
        ["module1"]
      );

      expect(result.username).toBe("newuser");
      expect(result.email).toBe("newuser@test.com");
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it("should throw CONFLICT error if username already exists", async () => {
      const prismaError = new Error(
        "Unique constraint failed on the field: `username`"
      );
      prismaError.code = "P2002";
      prismaError.meta = { target: ["username"] };
      vi.mocked(prisma.user.create).mockRejectedValue(prismaError);

      try {
        await registerUser(
          "existing",
          "password123",
          "operator",
          "new@test.com",
          "ACTIVE",
          ["module1"]
        );
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe("DUPLICATE_USERNAME");
      }
    });
  });

  describe("loginUser", () => {
    it("should throw NOT_FOUND if user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      try {
        await loginUser("nonexistent", "password123");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe("USER_NOT_FOUND");
      }
    });
  });
});
