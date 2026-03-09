import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock services BEFORE importing controller
vi.mock("../../services/photoService.js", () => ({
  PhotoService: {
    createMany: vi.fn(),
    list: vi.fn(),
    createGroup: vi.fn(),
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../services/areaService.js", () => ({
  AreaService: {
    list: vi.fn(),
  },
}));
vi.mock("../../utils/logger.js");

// Import after mocking
import { PhotoController } from "../../controllers/photoController.js";
import { PhotoService } from "../../services/photoService.js";
import { AreaService } from "../../services/areaService.js";
import ApiError from "../../utils/ApiError.js";

describe.skip("PhotoController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      files: [],
      user: { id: "user1" },
    };
    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("upload", () => {
    it("should upload photos successfully", async () => {
      req.body = {
        areaId: "1",
        category: "category1",
        captureTime: "2024-01-01",
      };
      req.files = [
        {
          filename: "photo1.jpg",
          path: "/uploads/photo1.jpg",
          originalname: "photo1.jpg",
          size: 1024,
        },
        {
          filename: "photo2.jpg",
          path: "/uploads/photo2.jpg",
          originalname: "photo2.jpg",
          size: 2048,
        },
      ];

      const mockPhotos = [
        { id: 1, filename: "photo1.jpg" },
        { id: 2, filename: "photo2.jpg" },
      ];

      vi.mocked(PhotoService.createMany).mockResolvedValue({
        photos: mockPhotos,
        count: 2,
      });
      vi.mocked(AreaService.list).mockResolvedValue([]);

      await PhotoController.upload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Upload Berhasil",
          count: 2,
        })
      );
    });

    it("should throw error if areaId is missing", async () => {
      req.body = {
        category: "category1",
        captureTime: "2024-01-01",
      };
      req.files = [{ filename: "photo.jpg" }];

      await PhotoController.upload(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it("should throw error if no files are provided", async () => {
      req.body = {
        areaId: "1",
        category: "category1",
        captureTime: "2024-01-01",
      };
      req.files = [];

      await PhotoController.upload(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });
  });

  describe("list", () => {
    it("should return list of photos", async () => {
      req.query = { areaId: "1", page: "1", limit: "10" };

      const mockPhotos = [
        { id: 1, filename: "photo1.jpg", areaId: 1 },
        { id: 2, filename: "photo2.jpg", areaId: 1 },
      ];

      vi.mocked(PhotoService.list).mockResolvedValue(mockPhotos);

      await PhotoController.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockPhotos,
        })
      );
    });

    it("should handle database error", async () => {
      req.query = { areaId: "1" };

      const error = new Error("DB error");
      vi.mocked(PhotoService.list).mockRejectedValue(error);

      await PhotoController.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createGroup", () => {
    it("should create comparison group successfully", async () => {
      req.body = {
        areaId: "1",
        name: "Group 1",
      };

      const mockGroup = {
        id: "group1",
        areaId: 1,
        name: "Group 1",
      };

      vi.mocked(PhotoService.createGroup).mockResolvedValue(mockGroup);

      await PhotoController.createGroup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Comparison group created successfully",
          data: mockGroup,
        })
      );
    });
  });

  describe("listGroups", () => {
    it("should return list of comparison groups", async () => {
      req.params = { areaId: "1" };

      const mockGroups = [
        { id: "group1", areaId: 1, name: "Group 1" },
        { id: "group2", areaId: 1, name: "Group 2" },
      ];

      vi.mocked(PhotoService.listGroups).mockResolvedValue(mockGroups);

      await PhotoController.listGroups(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockGroups,
        })
      );
    });
  });

  describe("getGroup", () => {
    it("should return comparison group by id", async () => {
      req.params = { groupId: "group1" };

      const mockGroup = {
        id: "group1",
        areaId: 1,
        name: "Group 1",
      };

      vi.mocked(PhotoService.getGroup).mockResolvedValue(mockGroup);

      await PhotoController.getGroup(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockGroup,
        })
      );
    });

    it("should throw NOT_FOUND if group does not exist", async () => {
      req.params = { groupId: "nonexistent" };

      const error = new ApiError(404, "Group not found", "GROUP_NOT_FOUND");
      vi.mocked(PhotoService.getGroup).mockRejectedValue(error);

      await PhotoController.getGroup(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateGroup", () => {
    it("should update comparison group successfully", async () => {
      req.params = { groupId: "group1" };
      req.body = { name: "Updated Group" };

      const mockGroup = {
        id: "group1",
        areaId: 1,
        name: "Updated Group",
      };

      vi.mocked(PhotoService.updateGroup).mockResolvedValue(mockGroup);

      await PhotoController.updateGroup(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Comparison group updated successfully",
        })
      );
    });

    it("should throw NOT_FOUND if group does not exist", async () => {
      req.params = { groupId: "nonexistent" };
      req.body = { name: "Test" };

      const error = new ApiError(404, "Group not found", "GROUP_NOT_FOUND");
      vi.mocked(PhotoService.updateGroup).mockRejectedValue(error);

      await PhotoController.updateGroup(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteGroup", () => {
    it("should delete comparison group successfully", async () => {
      req.params = { groupId: "group1" };

      vi.mocked(PhotoService.deleteGroup).mockResolvedValue({ id: "group1" });

      await PhotoController.deleteGroup(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Comparison group deleted successfully",
        })
      );
    });

    it("should throw NOT_FOUND if group does not exist", async () => {
      req.params = { groupId: "nonexistent" };

      const error = new ApiError(404, "Group not found", "GROUP_NOT_FOUND");
      vi.mocked(PhotoService.deleteGroup).mockRejectedValue(error);

      await PhotoController.deleteGroup(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("update", () => {
    it("should update photo metadata successfully", async () => {
      req.params = { photoId: "1" };
      req.body = { category: "updated" };

      vi.mocked(PhotoService.update).mockResolvedValue({
        id: 1,
        category: "updated",
      });

      await PhotoController.update(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Photo updated successfully",
        })
      );
    });
  });

  describe("remove", () => {
    it("should remove photo successfully", async () => {
      req.params = { photoId: "1" };

      vi.mocked(PhotoService.remove).mockResolvedValue({ id: 1 });

      await PhotoController.remove(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Photo deleted successfully",
        })
      );
    });

    it("should throw NOT_FOUND if photo does not exist", async () => {
      req.params = { photoId: "nonexistent" };

      const error = new ApiError(404, "Photo not found", "PHOTO_NOT_FOUND");
      vi.mocked(PhotoService.remove).mockRejectedValue(error);

      await PhotoController.remove(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
