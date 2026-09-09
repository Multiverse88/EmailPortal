import { POSE_ASSETS, CompanionPose } from "../types";

describe("Companion Types and Assets", () => {
  const poses: CompanionPose[] = [
    "greeting",
    "thinking",
    "document",
    "tips",
    "suggestion",
    "happy",
    "enthusiastic",
    "peeking",
    "waving",
    "head",
  ];

  it("has asset mappings for all defined poses", () => {
    poses.forEach((pose) => {
      expect(POSE_ASSETS[pose]).toBeDefined();
      expect(POSE_ASSETS[pose]).toMatch(/^\/companion\/el\/el-[a-z-]+(\..*)?$/);
    });
  });

  it("maps specific poses to accurate file paths", () => {
    expect(POSE_ASSETS.greeting).toBe("/companion/el/el-menyapa.png");
    expect(POSE_ASSETS.thinking).toBe("/companion/el/el-memikirkan.png");
    expect(POSE_ASSETS.document).toBe("/companion/el/el-konfirmasi-dokumen.png");
    expect(POSE_ASSETS.tips).toBe("/companion/el/el-tips-dengan-lampu.png");
    expect(POSE_ASSETS.suggestion).toBe("/companion/el/el-memberikan-saran.png");
    expect(POSE_ASSETS.happy).toBe("/companion/el/el-senang.png");
    expect(POSE_ASSETS.enthusiastic).toBe("/companion/el/el-semangat.png");
    expect(POSE_ASSETS.peeking).toBe("/companion/el/el-muncul-dari-tepi.png");
    expect(POSE_ASSETS.waving).toBe("/companion/el/el-hero-melambai.png");
    expect(POSE_ASSETS.head).toBe("/companion/el/el-avatar-kepala.png");
  });
});
