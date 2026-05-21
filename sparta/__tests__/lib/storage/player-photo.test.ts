import { describe, it, expect, beforeEach, vi } from "vitest";
import { uploadPlayerPhotoFile, getPlayerPhotoUrl } from "@/lib/storage";

// Mock sharp with format-chain support (jpeg/png/webp before toBuffer)
vi.mock("sharp", () => {
  const toBuffer = vi.fn(async () => new Uint8Array([1, 2, 3, 4, 5]));
  const formatResult = { toBuffer };
  const resizeResult = {
    jpeg: vi.fn(() => formatResult),
    png: vi.fn(() => formatResult),
    webp: vi.fn(() => formatResult),
  };
  return {
    default: vi.fn(() => ({ resize: vi.fn(() => resizeResult) })),
  };
});

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string) => ({
          error: null,
          data: { path },
        })),
        createSignedUrl: vi.fn(async (path: string, expiry: number) => ({
          error: null,
          data: { signedUrl: `https://signed-url/${path}?expires=${expiry}` },
        })),
        remove: vi.fn(async () => ({
          error: null,
        })),
      })),
    },
  })),
}));

describe("uploadPlayerPhotoFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject invalid file type", async () => {
    const file = new File(["data"], "file.txt", { type: "text/plain" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("Tipo de ficheiro inválido");
    }
  });

  it("should reject empty file (0 bytes)", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("vazio");
    }
  });

  it("should reject file larger than 2MB", async () => {
    const largeBuffer = new Uint8Array(3 * 1024 * 1024);
    const file = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("demasiado grande");
    }
  });

  it("should accept valid JPEG file", async () => {
    const buffer = new Uint8Array([255, 216, 255, 224]); // JPEG header
    const file = new File([buffer], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.photoPath).toContain("club-a/player-1");
      expect(result.data.photoPath).toMatch(/\.(jpg|jpeg|png|webp)$/);
    }
  });

  it("should accept valid PNG file", async () => {
    const buffer = new Uint8Array([137, 80, 78, 71]); // PNG header
    const file = new File([buffer], "photo.png", { type: "image/png" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.photoPath).toContain("club-a/player-1");
    }
  });

  it("should accept valid WebP file", async () => {
    const buffer = new Uint8Array([82, 73, 70, 70]); // RIFF header (WebP)
    const file = new File([buffer], "photo.webp", { type: "image/webp" });
    const result = await uploadPlayerPhotoFile("club-a", "player-1", file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.photoPath).toContain("club-a/player-1");
    }
  });

  it("should generate correct photo path format", async () => {
    const clubId = "d8a3f5c1-2b4a-4e7f-9c1b-5d6e8f9a2c3d";
    const playerId = "a7f8c9e1-2b4a-4e7f-9c1b-5d6e8f9a2c3d";
    const buffer = new Uint8Array([255, 216, 255, 224]);
    const file = new File([buffer], "photo.jpg", { type: "image/jpeg" });

    const result = await uploadPlayerPhotoFile(clubId, playerId, file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.photoPath).toMatch(
        new RegExp(`^${clubId}/${playerId}\\.\\w+$`)
      );
    }
  });
});

describe("getPlayerPhotoUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null for undefined photoPath", async () => {
    const result = await getPlayerPhotoUrl(undefined);
    expect(result).toBeNull();
  });

  it("should return null for null photoPath", async () => {
    const result = await getPlayerPhotoUrl(null);
    expect(result).toBeNull();
  });

  it("should return signed URL for valid photoPath", async () => {
    const photoPath = "club-a/player-1.jpg";
    const result = await getPlayerPhotoUrl(photoPath);

    expect(result).toBeTruthy();
    expect(result).toContain("https://signed-url/");
    expect(result).toContain(photoPath);
  });

  it("should include 1h expiry (3600 seconds) in signed URL", async () => {
    const photoPath = "club-a/player-1.jpg";
    const result = await getPlayerPhotoUrl(photoPath);

    expect(result).toContain("3600"); // 1 hour in seconds
  });
});
