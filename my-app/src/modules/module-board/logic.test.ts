import { describe, expect, it } from "vitest";
import {
  countSundayWarnings,
  createSeedModuleBoard,
  getModuleBoardWarnings,
} from "@/modules/module-board/logic";

describe("module board logic", () => {
  it("flags working rows that lack validator and proof", () => {
    expect(
      getModuleBoardWarnings({
        status: "WORKING",
        ownerUserId: "owner-1",
        validatorUserId: null,
        verificationSummary: "",
        proofBundles: [],
      }),
    ).toEqual([
      "Validator missing.",
      "Verification summary missing.",
      "Proof bundle missing.",
    ]);
  });

  it("flags validating rows that do not explain the validation state", () => {
    expect(
      getModuleBoardWarnings({
        status: "VALIDATING",
        ownerUserId: "owner-1",
        validatorUserId: "validator-1",
        verificationSummary: "Re-ran smoke test",
        validatingReason: "",
        proofBundles: [],
      }),
    ).toEqual(["Validation reason missing."]);
  });

  it("seeds the required sections and disclosure holds", () => {
    const board = createSeedModuleBoard("user-1", new Date("2026-07-10T12:00:00.000Z"));
    expect(board.modules).toHaveLength(10);
    expect(board.finishLines).toHaveLength(3);
    expect(board.masterGate).toHaveLength(3);
    expect(board.scopeHolds.map((card) => card.title)).toEqual([
      "FHIR stays out of disclosure scope",
      "BioBERT stays out of disclosure scope",
      "VUS framing stays out of disclosure scope",
    ]);
  });

  it("counts Sunday warnings across module rows", () => {
    expect(
      countSundayWarnings([
        {
          status: "WORKING",
          ownerUserId: "a",
          validatorUserId: null,
          verificationSummary: "",
          proofBundles: [],
        },
        {
          status: "VALIDATING",
          ownerUserId: "b",
          validatorUserId: "c",
          verificationSummary: "summary",
          validatingReason: "Need second pass",
          proofBundles: [],
        },
      ]),
    ).toBe(3);
  });
});
