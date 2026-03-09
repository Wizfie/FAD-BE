import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock services BEFORE importing controller
vi.mock("../../services/areaService.js", () => ({
  AreaService: {
    list: vi.fn(),
    upsertByName: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    hasPhotos: vi.fn(),
  },
}));
vi.mock("../../utils/logger.js");

// Import after mocking
import { AreaController } from "../../controllers/areaController.js";
import { AreaService } from "../../services/areaService.js";
import ApiError from "../../utils/ApiError.js";

describe("AreaController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: "user1" },
    };
    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return list of areas", async () => {
      const mockAreas = [
        { id: 1, name: "Area A" },
        { id: 2, name: "Area B" },
      ];
      vi.mocked(AreaService.list).mockResolvedValue(mockAreas);

      await AreaController.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockAreas,
        })
      );
    });

    it("should call next on error", async () => {
      const error = new Error("DB error");
      vi.mocked(AreaService.list).mockRejectedValue(error);

      await AreaController.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("create", () => {
    it("should create area with valid name", async () => {
      const mockArea = { id: 1, name: "Test Area" };
      req.body = { name: "Test Area" };
      vi.mocked(AreaService.upsertByName).mockResolvedValue(mockArea);

      await AreaController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Area berhasil dibuat",
        })
      );
    });

    it("should throw error if name is missing", async () => {
      req.body = { name: "" };

      await AreaController.create(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update area with valid data", async () => {
      const mockArea = { id: 1, name: "Updated Area" };
      req.params = { id: "1" };
      req.body = { name: "Updated Area" };
      vi.mocked(AreaService.update).mockResolvedValue(mockArea);

      await AreaController.update(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Area berhasil diupdate",
        })
      );
    });

    it("should handle NOT_FOUND error", async () => {
      req.params = { id: "999" };
      req.body = { name: "Test" };
      const error = new ApiError(404, "Area tidak ditemukan", "AREA_NOT_FOUND");
      vi.mocked(AreaService.update).mockRejectedValue(error);

      await AreaController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("delete", () => {
    it("should delete area if it has no photos", async () => {
      const mockArea = { id: 1, name: "Area" };
      req.params = { id: "1" };
      vi.mocked(AreaService.hasPhotos).mockResolvedValue(false);
      vi.mocked(AreaService.delete).mockResolvedValue(mockArea);

      await AreaController.delete(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Area berhasil dihapus",
        })
      );
    });

    it("should throw CONFLICT error if area has photos", async () => {
      req.params = { id: "1" };
      vi.mocked(AreaService.hasPhotos).mockResolvedValue(true);

      await AreaController.delete(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(409);
    });
  });
});
