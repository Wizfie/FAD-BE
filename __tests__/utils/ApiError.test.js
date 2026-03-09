import { describe, it, expect } from "vitest";
import ApiError from "../../utils/ApiError.js";

describe("ApiError", () => {
  describe("constructor", () => {
    it("should create error with statusCode, message, code, meta", () => {
      const error = new ApiError(400, "Bad request", "BAD_REQUEST", {
        field: "test",
      });
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Bad request");
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.meta).toEqual({ field: "test" });
      expect(error.name).toBe("ApiError");
    });

    it("should have default statusCode of 500", () => {
      const error = new ApiError(undefined, "Error message", "DEFAULT_ERROR");
      expect(error.statusCode).toBe(500);
    });

    it("should capture stack trace", () => {
      const error = new ApiError(500, "Server error", "SERVER_ERROR");
      expect(error.stack).toBeDefined();
    });
  });

  describe("toJSON", () => {
    it("should serialize error to JSON format", () => {
      const error = new ApiError(400, "Bad request", "BAD_REQUEST", {
        field: "email",
      });
      const json = error.toJSON();
      expect(json).toEqual({
        statusCode: 400,
        message: "Bad request",
        code: "BAD_REQUEST",
        meta: { field: "email" },
      });
    });
  });

  describe("static factory methods", () => {
    it("badRequest() should create 400 error", () => {
      const error = ApiError.badRequest("Invalid data", { field: "name" });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Invalid data");
    });

    it("unauthorized() should create 401 error", () => {
      const error = ApiError.unauthorized("Invalid credentials");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
    });

    it("forbidden() should create 403 error", () => {
      const error = ApiError.forbidden("Access denied");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });

    it("notFound() should create 404 error", () => {
      const error = ApiError.notFound("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });

    it("conflict() should create 409 error", () => {
      const error = ApiError.conflict("Resource already exists");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
    });

    it("internal() should create 500 error", () => {
      const error = ApiError.internal("Server error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("from()", () => {
    it("should pass through ApiError", () => {
      const original = ApiError.notFound("Test error");
      const wrapped = ApiError.from(original);
      expect(wrapped).toBe(original);
    });

    it("should wrap regular Error", () => {
      const original = new Error("Regular error");
      const wrapped = ApiError.from(original);
      expect(wrapped).toBeInstanceOf(ApiError);
      expect(wrapped.statusCode).toBe(500);
    });
  });
});
