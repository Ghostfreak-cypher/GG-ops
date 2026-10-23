import { describe, expect, it } from "vitest";
import { ModuleBoard } from "@/models/ModuleBoard";
import { createSeedModuleBoard } from "@/modules/module-board/logic";

describe("ModuleBoard schema", () => {
  it("rejects the same user as owner and validator", () => {
    const seed = createSeedModuleBoard("507f1f77bcf86cd799439011");
    seed.modules[0].ownerUserId = "507f1f77bcf86cd799439011";
    seed.modules[0].validatorUserId = "507f1f77bcf86cd799439011";

    const doc = new ModuleBoard({
      workspaceId: "507f191e810c19729de860ea",
      ...seed,
    });

    const err = doc.validateSync();
    expect(err?.errors["modules.0.validatorUserId"]?.message).toBe(
      "Owner and validator must be different users.",
    );
  });

  it("accepts structured sections and proof bundle entries", () => {
    const seed = createSeedModuleBoard("507f1f77bcf86cd799439011");
    seed.modules[0].validatorUserId = "507f1f77bcf86cd799439012";
    seed.modules[0].proofBundles = [
      {
        id: "proof-1",
        status: "WORKING",
        whatVerified: "Re-ran the output path",
        proof: "See linked report and screenshot",
        taskIds: [],
        externalUrls: [{ label: "PR 61", url: "https://github.com/example/repo/pull/61" }],
        evidenceLinks: [{ label: "Screenshot", url: "https://example.com/screenshot.png" }],
        updatedBy: "507f1f77bcf86cd799439011",
        updatedAt: new Date("2026-07-10T12:00:00.000Z"),
      },
    ];

    const doc = new ModuleBoard({
      workspaceId: "507f191e810c19729de860ea",
      ...seed,
    });

    expect(doc.validateSync()).toBeUndefined();
  });

  it("preserves row updatedBy and updatedAt fields", () => {
    const seed = createSeedModuleBoard("507f1f77bcf86cd799439011");
    const doc = new ModuleBoard({
      workspaceId: "507f191e810c19729de860ea",
      ...seed,
    });

    doc.modules[0].updatedBy = "507f1f77bcf86cd799439012" as never;
    doc.modules[0].updatedAt = new Date("2026-07-11T09:30:00.000Z");

    expect(String(doc.modules[0].updatedBy)).toBe("507f1f77bcf86cd799439012");
    expect(doc.modules[0].updatedAt?.toISOString()).toBe("2026-07-11T09:30:00.000Z");
  });
});

