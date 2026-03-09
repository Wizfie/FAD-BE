import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock services BEFORE importing controller
vi.mock("../../services/authService.js", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  refreshWithRotation: vi.fn(),
  revokeRefresh: vi.fn(),
}));
vi.mock("../../utils/unifiedLogger.js", () => ({
  logger: {
    info: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(undefined),
    authFailure: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocking - use named imports
import {
  registerController,
  loginController,
  meController,
} from "../../controllers/authController.js";
import { registerUser, loginUser } from "../../services/authService.js";
import ApiError from "../../utils/ApiError.js";

describe("AuthController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      headers: {},
      cookies: {},
    };
    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("registerController", () => {
    it("should register user successfully", async () => {
      req.body = {
        username: "newuser",
        password: "password123",
        email: "newuser@test.com",
        role: "operator",
        modules: ["module1"],
      };

      const mockUser = {
        id: 1,
        username: "newuser",
        email: "newuser@test.com",
      };

      vi.mocked(registerUser).mockResolvedValue(mockUser);

      await registerController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: mockUser,
        })
      );
    });

    it("should forward error to next middleware", async () => {
      req.body = {
        username: "existing",
        password: "password123",
        email: "new@test.com",
        role: "operator",
        modules: ["module1"],
      };

      const error = new ApiError(
        409,
        "Username already exists",
        "DUPLICATE_USERNAME"
      );
      vi.mocked(registerUser).mockRejectedValue(error);

      await registerController(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe.skip("loginController", () => {
    it("should login user successfully", async () => {
      req.body = {
        username: "user1",
        password: "password123",
      };

      const mockTokens = {
        accessToken: "access_token",
        refreshToken: "refresh_token",
        user: { id: 1, username: "user1", email: "user1@test.com" },
      };

      vi.mocked(loginUser).mockResolvedValue(mockTokens);

      await loginController(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Login successful",
          user: mockTokens.user,
          accessToken: mockTokens.accessToken,
        })
      );
    });

    it("should throw NOT_FOUND if user does not exist", async () => {
      req.body = {
        username: "nonexistent",
        password: "password123",
      };

      const error = new ApiError(404, "User not found", "USER_NOT_FOUND");
      vi.mocked(loginUser).mockRejectedValue(error);

      await loginController(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("meController", () => {
    it("should return current user data", async () => {
      req.user = {
        id: 1,
        username: "user1",
        email: "user1@test.com",
        role: "operator",
      };

      await meController(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          status: req.user.status,
        })
      );
    });
  });
});
