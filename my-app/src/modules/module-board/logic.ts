import {
  MODULE_BOARD_WORKING_LIKE_STATUSES,
  type ModuleBoardStatus,
} from "@/modules/module-board/constants";

type LinkRecord = { label: string; url: string };
type ProofBundleLike = {
  id?: string;
  status: ModuleBoardStatus;
  whatVerified: string;
  proof: string;
  taskIds?: string[];
  externalUrls?: LinkRecord[];
  evidenceLinks?: LinkRecord[];
  updatedBy?: string | null;
  updatedAt?: Date | null;
};

type ModuleRowLike = {
  status: ModuleBoardStatus;
  ownerUserId?: string | null;
  validatorUserId?: string | null;
  verificationSummary?: string;
  validatingReason?: string;
  blockerReason?: string;
  proofBundles?: ProofBundleLike[];
};

function makeCard(
  id: string,
  title: string,
  note: string,
  status: ModuleBoardStatus,
  userId: string,
  now: Date,
) {
  return {
    id,
    title,
    note,
    status,
    updatedBy: userId,
    updatedAt: now,
  };
}

function makeStructuredRow(
  id: string,
  title: string,
  note: string,
  status: ModuleBoardStatus,
  userId: string,
  now: Date,
  ownerUserId: string | null = null,
) {
  return {
    id,
    title,
    ownerUserId,
    status,
    note,
    taskIds: [],
    externalUrls: [],
    updatedBy: userId,
    updatedAt: now,
  };
}

type SeedModuleRow = {
  id: string;
  moduleKey: string;
  title: string;
  ownerUserId: string | null;
  validatorUserId: string | null;
  status: ModuleBoardStatus;
  summary: string;
  whatClosesIt: string;
  verificationSummary: string;
  validatingReason: string;
  blockerReason: string;
  taskIds: string[];
  prUrls: LinkRecord[];
  proofBundles: ProofBundleLike[];
  updatedBy: string;
  updatedAt: Date;
};

type SeedModuleRowDetails = {
  ownerUserId?: string | null;
  validatorUserId?: string | null;
  status?: ModuleBoardStatus;
  summary?: string;
  whatClosesIt?: string;
  verificationSummary?: string;
  validatingReason?: string;
  blockerReason?: string;
};

function makeModuleRow(
  moduleKey: string,
  title: string,
  userId: string,
  now: Date,
  details: SeedModuleRowDetails = {},
): SeedModuleRow {
  return {
    id: `module-${moduleKey.toLowerCase()}`,
    moduleKey,
    title,
    ownerUserId: details.ownerUserId ?? null,
    validatorUserId: details.validatorUserId ?? null,
    status: details.status ?? "UNSET",
    summary: details.summary ?? "",
    whatClosesIt: details.whatClosesIt ?? "",
    verificationSummary: details.verificationSummary ?? "",
    validatingReason: details.validatingReason ?? "",
    blockerReason: details.blockerReason ?? "",
    taskIds: [],
    prUrls: [],
    proofBundles: [],
    updatedBy: userId,
    updatedAt: now,
  };
}

/** A workspace member as seen by the seed resolver — just enough to match report names to real accounts. */
export type SeedMemberRef = { userId: string; name: string };

/**
 * Matches a first-name/nickname from the status report (e.g. "Vish", "Matt") to a real
 * workspace member. Falls back to null (unassigned) for people not yet in the workspace
 * (external stakeholders like AWS contacts, doctors) rather than guessing.
 */
function resolveMemberId(members: SeedMemberRef[], name: string): string | null {
  const target = name.trim().toLowerCase();
  const exact = members.find((member) => member.name.trim().toLowerCase() === target);
  if (exact) return exact.userId;
  const firstName = members.find(
    (member) => member.name.trim().toLowerCase().split(/\s+/)[0] === target,
  );
  if (firstName) return firstName.userId;
  const prefixed = members.find((member) => member.name.trim().toLowerCase().startsWith(target));
  return prefixed ? prefixed.userId : null;
}

export function isWorkingLikeStatus(status: ModuleBoardStatus) {
  return MODULE_BOARD_WORKING_LIKE_STATUSES.includes(status);
}

/** True for the patent-scope modules (M1, M2, ...). Coordinates/BioNeMo use the same row
 * shape for owner/validator tracking but are support tracks, not patent modules. */
export function isPatentModuleKey(moduleKey: string): boolean {
  return /^M\d+$/.test(moduleKey);
}

export function getModuleBoardWarnings(row: ModuleRowLike): string[] {
  const warnings: string[] = [];

  if (
    row.ownerUserId &&
    row.validatorUserId &&
    row.ownerUserId === row.validatorUserId
  ) {
    warnings.push("Owner and validator must be different people.");
  }

  if (isWorkingLikeStatus(row.status) && !row.validatorUserId) {
    warnings.push("Validator missing.");
  }

  if (isWorkingLikeStatus(row.status) && !row.verificationSummary?.trim()) {
    warnings.push("Verification summary missing.");
  }

  if (row.status === "WORKING") {
    const hasProof = (row.proofBundles ?? []).some(
      (bundle) =>
        !!bundle.proof.trim() ||
        !!bundle.whatVerified.trim() ||
        (bundle.evidenceLinks?.length ?? 0) > 0 ||
        (bundle.externalUrls?.length ?? 0) > 0 ||
        (bundle.taskIds?.length ?? 0) > 0,
    );
    if (!hasProof) warnings.push("Proof bundle missing.");
  }

  if (row.status === "VALIDATING" && !row.validatingReason?.trim()) {
    warnings.push("Validation reason missing.");
  }

  if (row.status === "BLOCKED" && !row.blockerReason?.trim()) {
    warnings.push("Blocker reason missing.");
  }

  return warnings;
}

export function countSundayWarnings(
  modules: Array<Pick<ModuleRowLike, keyof ModuleRowLike>>,
) {
  return modules.reduce((count, row) => count + getModuleBoardWarnings(row).length, 0);
}

export function normalizeLinkRecords(
  links: Array<{ label?: string; url: string }>,
): LinkRecord[] {
  return links.map((link) => ({
    label: link.label?.trim() || link.url,
    url: link.url.trim(),
  }));
}

export function normalizeProofBundles(
  bundles: ProofBundleLike[],
  userId: string,
  now: Date,
): ProofBundleLike[] {
  return bundles.map((bundle) => ({
    // Global Web Crypto rather than Node's `crypto` module — this file is imported by a
    // client component (module-board-view.tsx), and the Node import shipped a ~477KB
    // crypto browser-polyfill chunk to the browser for nothing (see :846 in that file,
    // which already uses this same global form).
    id: bundle.id?.trim() || crypto.randomUUID(),
    status: bundle.status,
    whatVerified: bundle.whatVerified.trim(),
    proof: bundle.proof.trim(),
    taskIds: [...new Set((bundle.taskIds ?? []).map((taskId) => taskId.trim()).filter(Boolean))],
    externalUrls: normalizeLinkRecords(bundle.externalUrls ?? []),
    evidenceLinks: normalizeLinkRecords(bundle.evidenceLinks ?? []),
    updatedBy: userId,
    updatedAt: now,
  }));
}

/**
 * Seeds the live board with the July 9, 2026 status report (collector: Shrinjay; branch:
 * v2-accelerated). Owner/validator names from the report are resolved against real workspace
 * members where possible; external stakeholders (AWS contacts, pilot doctors, etc.) stay
 * unassigned and are named in the row note instead.
 */
export function createSeedModuleBoard(
  userId: string,
  now = new Date(),
  members: SeedMemberRef[] = [],
) {
  const id = (name: string) => resolveMemberId(members, name);

  return {
    finishLines: [
      makeCard(
        "finish-patent",
        "Patent",
        "Needs an honest, complete disclosure. Does not need live prod. Closest — days away.",
        "VALIDATING",
        userId,
        now,
      ),
      makeCard(
        "finish-pilot",
        "Pilot",
        "Needs prod up + core VCF→report loop hardened + M1 & M5 verified live. Gated on credits. Weeks away.",
        "BLOCKED",
        userId,
        now,
      ),
      makeCard(
        "finish-scale",
        "Scale",
        "Innovative EKS/H200 build so it holds at volume. Runs in parallel. Months away.",
        "UNSET",
        userId,
        now,
      ),
    ],
    masterGate: [
      makeCard(
        "gate-owner-validator-rule",
        "Owner + validator, never self-validate",
        'Every module has an owner (builds it) and a validator (independently confirms it against real output). Nobody validates their own work. "Done" means two people, not one.',
        "WORKING",
        userId,
        now,
      ),
      makeCard(
        "gate-status-language",
        "Status language is non-negotiable",
        "Working = the code does it today. Validating = on fallback / mocked / unproven / prod-blocked. We never round validating up to working.",
        "WORKING",
        userId,
        now,
      ),
      makeCard(
        "gate-prod-credits-blocked",
        "Prod is dark — credits blocked",
        "$25K Activate auto-declined (false trigger); escalation emailed to Austin/AWS Activate, CC Sarah Houghton + AJ Goldman. March precedent: auto-declined then manually approved. Credits land → prod relaunch. Snapshot as of Jul 9, 2026 EOD — collector Shrinjay, branch v2-accelerated; Faraz held master today (Shrinjay out).",
        "BLOCKED",
        userId,
        now,
      ),
    ],
    modules: [
      makeModuleRow("M1", "M1 Structural Impact", userId, now, {
        ownerUserId: id("Shrinjay"),
        validatorUserId: id("Vish"),
        status: "VALIDATING",
        summary: "Working-local / prod-validating.",
        whatClosesIt: "Verify live on prod when it's back.",
        validatingReason: "Working locally; prod verification still pending until prod is back.",
      }),
      makeModuleRow("M2", "M2 Splicing Validation", userId, now, {
        ownerUserId: id("Vish"),
        validatorUserId: id("Shrinjay"),
        status: "VALIDATING",
        whatClosesIt: "Live VEP + SpliceAI on prod.",
        validatingReason: "VEP mocked, SpliceAI injected — not live yet.",
      }),
      makeModuleRow("M3", "M3 Expression Outlier", userId, now, {
        ownerUserId: id("Vish"),
        validatorUserId: id("Anushka"),
        status: "VALIDATING",
        whatClosesIt: "v11 staged + full baseline on prod.",
        validatingReason: "Running on GTEx v8, 98 genes — v11 not yet staged or fully baselined.",
      }),
      makeModuleRow("M4", "M4 Continuous Reanalysis", userId, now, {
        ownerUserId: id("Navdeep"),
        validatorUserId: id("Sagar"),
        status: "WORKING",
        summary:
          "Failsafe merged and confirmed working. Sagar added items are under Navdeep's review before they count as validated.",
        whatClosesIt: "Sagar's added items reviewed and validated on compute.",
        verificationSummary: "Failsafe merged and working — confirmed.",
      }),
      makeModuleRow("M5", "M5 Phenotype Integration", userId, now, {
        ownerUserId: id("Vish"),
        validatorUserId: id("Anushka"),
        status: "VALIDATING",
        summary:
          "Working-local across 5 cases: Marfan (FBN1), Tuberous Sclerosis (TSC1/TSC2), Ehlers-Danlos (COL genes), HCM (MYH7), Noonan (PTPN11). Originals confirmed unmoved after the annotation fix.",
        whatClosesIt: "Verify all 5 cases live on prod.",
        validatingReason: "Working locally across 5 cases; not yet verified live on prod.",
      }),
      makeModuleRow("M6", "M6 Therapeutic Synthesis", userId, now, {
        ownerUserId: id("Sakshi"),
        validatorUserId: id("Anushka"),
        status: "VALIDATING",
        summary: "Anushka and Sakshi syncing post-sync.",
        whatClosesIt: "ClinicalTrials + PharmGKB unblocked.",
        validatingReason: "Only 1 of 4 sources wired (CIViC).",
      }),
      makeModuleRow("M7", "M7 Metabolomic Overlay", userId, now, {
        ownerUserId: id("Sagar"),
        validatorUserId: id("Navdeep"),
        status: "VALIDATING",
        whatClosesIt: "Wire the metabolomics input path.",
        validatingReason: "Engine is real; input path is not wired yet.",
      }),
      makeModuleRow("M8", "M8 Functional Rectification (GoF/LoF)", userId, now, {
        ownerUserId: id("Navdeep"),
        validatorUserId: id("Sagar"),
        status: "BLOCKED",
        whatClosesIt: "BRCA1 (LoF) + FGFR3 (GoF) raw JSON to Shrinjay.",
        blockerReason: "Runs owed today — Navdeep on it.",
      }),
      makeModuleRow("COORDINATES", "Coordinates and Canonical IDs", userId, now, {
        ownerUserId: id("Navdeep"),
        validatorUserId: id("Shrinjay"),
        status: "BLOCKED",
        summary: "Clean both branches.",
        whatClosesIt: "Live DB sweep when prod's back.",
        blockerReason: "Sweep is gated on prod coming back up.",
      }),
      makeModuleRow("BIONEMO", "BioNeMo and Model Ops", userId, now, {
        ownerUserId: id("Navdeep"),
        validatorUserId: id("Sagar"),
        status: "UNSET",
        summary: "Untagged.",
        whatClosesIt: "Count models responding on local.",
      }),
    ],
    pilotRoadmap: [
      makeStructuredRow(
        "pilot-phase-0-unblock",
        "Phase 0 — Unblock",
        "Credits land → prod relaunch. File provisional patent in parallel. Gate: credits (early next week). Faraz owns the patent track in parallel.",
        "BLOCKED",
        userId,
        now,
        id("Zuhra"),
      ),
      makeStructuredRow(
        "pilot-phase-1-harden",
        "Phase 1 — Harden core",
        "Fix ingestion bug, lock prod reliability, verify M1 + M5 live. Gate: prod up. Vish owns the ACMG path.",
        "BLOCKED",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "pilot-phase-2-first-pilots",
        "Phase 2 — First pilots",
        "Onboard 1+ institutional RUO pilot on core + M1 + M5, rest off & labeled. Gate: Phase 1 done. Matt owns pipeline, Zuhra owns LOIs.",
        "BLOCKED",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "pilot-phase-3-scale",
        "Phase 3 — Scale",
        "Innovative EKS/H200 build for volume. Gate: kickoff (Steve).",
        "UNSET",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "pilot-target",
        "Pilot target",
        "One institutional pilot during the Innovative engagement is enough.",
        "UNSET",
        userId,
        now,
      ),
    ],
    openItems: [
      makeStructuredRow(
        "open-p4de-reservation",
        "p4de reservation",
        "Cancelled / none active. Sagar screenshot: no reservations, nothing running. Not bleeding. Region caveat → Shrinjay to cross-check.",
        "WORKING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "open-july-tail",
        "$928 July tail",
        "Explained & closed. p4de July 1-2 ($658.73 + $269.64), $0 compute after. Verified.",
        "WORKING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "open-june-spend",
        "June spend breakdown",
        "$5,226 charged after credits. Asked Sagar for by-service/by-day breakdown. Waiting. This is the real spend story, not the $928.",
        "VALIDATING",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "open-m8-runs",
        "M8 runs",
        "Asked Navdeep for raw BRCA1/FGFR3 JSON. Waiting.",
        "VALIDATING",
        userId,
        now,
        id("Navdeep"),
      ),
      makeStructuredRow(
        "open-credit-escalation",
        "$25K credit escalation",
        "Email sent to Austin/AWS Activate, CC Sarah Houghton + AJ Goldman. Waiting on manual review.",
        "VALIDATING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "open-sagar-immigration",
        "Sagar immigration",
        "OPT expires July 16 (7 days), Tim contract at his lawyer. Company risk: Sagar relaunches prod. No fallback plan yet. Faraz handling.",
        "BLOCKED",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "open-patent-scope",
        "Patent scope — 8 modules or more",
        "FHIR/BioBERT/VUS scope decision pending with Zuhra + Amina.",
        "BLOCKED",
        userId,
        now,
        id("Zuhra"),
      ),
      makeStructuredRow(
        "open-m7-ownership",
        "M7 ownership",
        "Confirm Sagar as owner.",
        "BLOCKED",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "open-double-validation-rule",
        "Double-validation rule set",
        "Every module owner + validator assigned — see module table.",
        "WORKING",
        userId,
        now,
        id("Faraz"),
      ),
    ],
    outreachPipeline: [
      makeStructuredRow(
        "outreach-harvard",
        "Harvard — Dr. O'Donnell",
        "HOT. Dr. O'Donnell → pointing Matt to her team member who handles med records. Warm internal referral. Waiting on that person. Faraz joins the pilot call.",
        "VALIDATING",
        userId,
        now,
        id("Matt"),
      ),
      makeStructuredRow(
        "outreach-johns-hopkins",
        "Johns Hopkins — Rebkha Atnafou-Boyer",
        "Research Associate, cancer screening/access. Faraz sent a warm reconnect (guidance/intro ask, not a pitch). LinkedIn posts up (company + personal). Waiting on reply.",
        "VALIDATING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "outreach-brian-oconnor",
        "Brian O'Connor — Global Health Connector (32k network)",
        "Faraz sent an advisor message. He liked the post = warm. Waiting on reply. Play: land the advisor role → opens the whole network. Don't ask Matt to hit him for pilots yet.",
        "VALIDATING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "outreach-matt-sends",
        "Matt outreach — 25/25 sent",
        '"No access" replies = wrong seat, right building → chase referrals. Sharing AHTS/Aman notes with Anushka.',
        "WORKING",
        userId,
        now,
        id("Matt"),
      ),
      makeStructuredRow(
        "outreach-anushka-list",
        "Anushka — Tier 1 list build",
        "List toward 100, aim don't just grow (filter by data-owning seats). Feed Matt Tier 1 as ready. M6 comes first.",
        "VALIDATING",
        userId,
        now,
        id("Anushka"),
      ),
      makeStructuredRow(
        "outreach-strategy",
        "Pipeline strategy",
        "Connector rule: don't pitch connectors, recruit them — open on their idea, ask for guidance/intro, not a pilot. Don't need 100 replies, need ONE warm institutional yes. Three doors open now.",
        "UNSET",
        userId,
        now,
      ),
    ],
    spendDiscipline: [
      makeStructuredRow(
        "spend-june",
        "June spend — $5,226 after credits",
        "Credits ran dry mid-June. Breakdown by service/day still owed by Sagar — that's where the real money went.",
        "VALIDATING",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "spend-july-tail",
        "July tail — $928 p4de, closed",
        "p4de July 1-2 ($658.73 + $269.64), then $0 compute; ~$65 standing storage/infra.",
        "WORKING",
        userId,
        now,
        id("Faraz"),
      ),
      makeStructuredRow(
        "spend-burn-estimate",
        "Burn rate validates ~$22-23K/mo AWS estimate",
        "June (partial month, ~$5K) confirms burn returns to that scale when prod's back. Not distress — confirms the credit ask is sized right.",
        "VALIDATING",
        userId,
        now,
      ),
      makeStructuredRow(
        "spend-daily-tracker",
        "Daily console sign-off tracker",
        'Console-only, daily sign-off, screenshots. Escalation line: "resource still running after shutdown ordered." Faraz or Zuhra check the console every day.',
        "WORKING",
        userId,
        now,
        id("Zuhra"),
      ),
    ],
    loadFlags: [
      makeStructuredRow(
        "load-sagar",
        "Sagar — single biggest point of failure",
        "Validator on M4/M7/M8/BioNeMo + owner M7 + prod relaunch + visa cliff (OPT expires July 16).",
        "BLOCKED",
        userId,
        now,
        id("Sagar"),
      ),
      makeStructuredRow(
        "load-anushka",
        "Anushka — carrying a lot",
        "Validator on M3/M5/M6 + M6 sources + 100-list.",
        "VALIDATING",
        userId,
        now,
        id("Anushka"),
      ),
    ],
    scopeHolds: [
      makeCard(
        "hold-fhir",
        "FHIR stays out of disclosure scope",
        "FHIR has audit docs but is not confirmed in the M1-M8 patent scope. Decision pending (Faraz + Zuhra + Amina). Held out of disclosure until decided.",
        "HOLD",
        userId,
        now,
      ),
      makeCard(
        "hold-biobert",
        "BioBERT stays out of disclosure scope",
        "BioBERT has audit docs but is not confirmed in the M1-M8 patent scope. Decision pending (Faraz + Zuhra + Amina). Held out of disclosure until decided.",
        "HOLD",
        userId,
        now,
      ),
      makeCard(
        "hold-vus",
        "VUS framing stays out of disclosure scope",
        "VUS monitoring has audit docs but is not confirmed in the M1-M8 patent scope. Decision pending (Faraz + Zuhra + Amina). Held out of disclosure until decided.",
        "HOLD",
        userId,
        now,
      ),
    ],
    lastUpdatedBy: userId,
  };
}
