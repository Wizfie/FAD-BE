import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma BEFORE importing service
vi.mock("../../utils/prisma.js", () => ({
  prisma: {
    photo: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    comparisonGroup: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import { PhotoService } from "../../services/photoService.js";
import { prisma } from "../../utils/prisma.js";
import ApiError from "../../utils/ApiError.js";

describe.skip("PhotoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMany", () => {
    it("should create multiple photos successfully", async () => {
      const files = [
        { filename: "photo1.jpg", path: "/uploads/photo1.jpg" },
        { filename: "photo2.jpg", path: "/uploads/photo2.jpg" },
      ];

      const groupId = "group1";
      const mockPhotos = [
        { id: 1, filename: "photo1.jpg", comparisonGroupId: groupId },
        { id: 2, filename: "photo2.jpg", comparisonGroupId: groupId },
      ];

      vi.mocked(prisma.photo.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos);

      const result = await PhotoService.createMany(
        groupId,
        files,
        "category1",
        "timestamp"
      );

      expect(result).toEqual(mockPhotos);
      expect(prisma.photo.createMany).toHaveBeenCalled();
    });
  });

  describe("updateGroup", () => {
    it("should update comparison group successfully", async () => {
      const mockGroup = {
        id: "group1",
        name: "Updated Group",
        areaId: 1,
      };

      vi.mocked(prisma.comparisonGroup.findUnique).mockResolvedValue(mockGroup);
      vi.mocked(prisma.comparisonGroup.update).mockResolvedValue(mockGroup);

      const result = await PhotoService.updateGroup("group1", {
        name: "Updated Group",
      });

      expect(result).toEqual(mockGroup);
    });

    it("should throw NOT_FOUND if group does not exist", async () => {
      vi.mocked(prisma.comparisonGroup.findUnique).mockResolvedValue(null);

      try {
        await PhotoService.updateGroup("nonexistent", { name: "Test" });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe("GROUP_NOT_FOUND");
      }
    });
  });

  describe("listGroups", () => {
    it("should return list of comparison groups", async () => {
      const mockGroups = [
        { id: "group1", name: "Group 1", areaId: 1 },
        { id: "group2", name: "Group 2", areaId: 1 },
      ];

      vi.mocked(prisma.comparisonGroup.findMany).mockResolvedValue(mockGroups);

      const result = await PhotoService.listGroups(1);

      expect(result).toEqual(mockGroups);
      expect(prisma.comparisonGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { areaId: 1 },
        })
      );
    });
  });
});
