import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma before importing service
vi.mock("../../utils/prisma.js", () => ({
  prisma: {
    area: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    photo: {
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

// Now import the service after mocking
import { AreaService } from "../../services/areaService.js";
import { prisma } from "../../utils/prisma.js";

describe("AreaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return sorted areas list", async () => {
      const mockAreas = [
        { id: 1, name: "Area A" },
        { id: 2, name: "Area B" },
      ];
      vi.mocked(prisma.area.findMany).mockResolvedValue(mockAreas);

      const result = await AreaService.list();

      expect(result).toEqual(mockAreas);
      expect(prisma.area.findMany).toHaveBeenCalled();
    });
  });

  describe("upsertByName", () => {
    it("should create area if not exists", async () => {
      const mockArea = { id: 1, name: "Test Area" };
      vi.mocked(prisma.area.upsert).mockResolvedValue(mockArea);

      const result = await AreaService.upsertByName("Test Area");

      expect(result).toEqual(mockArea);
      expect(prisma.area.upsert).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update area successfully", async () => {
      const mockArea = { id: 1, name: "Updated Area" };
      vi.mocked(prisma.area.findUnique).mockResolvedValue(mockArea);
      vi.mocked(prisma.area.update).mockResolvedValue(mockArea);

      const result = await AreaService.update(1, { name: "Updated Area" });

      expect(result).toEqual(mockArea);
    });

    it("should throw NOT_FOUND if area does not exist", async () => {
      vi.mocked(prisma.area.findUnique).mockResolvedValue(null);

      try {
        await AreaService.update(999, { name: "Test" });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe("AREA_NOT_FOUND");
      }
    });
  });

  describe("delete", () => {
    it("should delete area successfully", async () => {
      const mockArea = { id: 1, name: "Area" };
      vi.mocked(prisma.area.findUnique).mockResolvedValue(mockArea);
      vi.mocked(prisma.area.delete).mockResolvedValue(mockArea);

      const result = await AreaService.delete(1);

      expect(result).toEqual(mockArea);
    });

    it("should throw NOT_FOUND if area does not exist", async () => {
      vi.mocked(prisma.area.findUnique).mockResolvedValue(null);

      try {
        await AreaService.delete(999);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("hasPhotos", () => {
    it("should return true if area has photos", async () => {
      vi.mocked(prisma.photo.count).mockResolvedValue(5);

      const result = await AreaService.hasPhotos(1);

      expect(result).toBe(true);
    });

    it("should return false if area has no photos", async () => {
      vi.mocked(prisma.photo.count).mockResolvedValue(0);

      const result = await AreaService.hasPhotos(1);

      expect(result).toBe(false);
    });
  });
});
