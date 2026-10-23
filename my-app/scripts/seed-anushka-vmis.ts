/**
 * Seed Anushka's VMIS–CFTR G551D tasks into the existing genegenius.ai workspace.
 * Creates project, section, tasks, subtasks, and comments. Fully idempotent.
 * Run with: npx tsx scripts/seed-anushka-vmis.ts
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch { /* env already set */ }

import mongoose, { Types } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const WORKSPACE_ID = new Types.ObjectId("6a464523e390183a5e503439");

const oid = () => new Types.ObjectId();
const now = new Date();

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // ── 1. Verify workspace exists ───────────────────────────────────────────
  const workspace = await db.collection("workspaces").findOne({ _id: WORKSPACE_ID });
  if (!workspace) {
    console.error("Workspace 6a4138f51146ac5ce08c1542 not found. Aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Workspace: "${workspace.name}" ✓`);

  // ── 2. Resolve emails → user IDs ─────────────────────────────────────────
  const emails = [
    "anushkagarg3008@gmail.com",
    "mohdsarfaraz@genegenius.ai",
    "zuhra@genegenius.ai",
    "sagar.gour@genegenius.ai",
    "singh.guru.2712@gmail.com",
    "vishvakpune@gmail.com",
    "navdeepmkn@gmail.com",
  ];
  const userDocs = await db
    .collection("users")
    .find({ email: { $in: emails } })
    .toArray();

  const userByEmail = new Map<string, Types.ObjectId>();
  for (const u of userDocs) userByEmail.set(u.email as string, u._id as Types.ObjectId);

  const missing = emails.filter((e) => !userByEmail.has(e));
  if (missing.length) console.warn(`  ⚠ Users not found (will skip as assignees): ${missing.join(", ")}`);

  const farazId = userByEmail.get("mohdsarfaraz@genegenius.ai") ?? WORKSPACE_ID; // fallback to ws owner
  const anushkaId = userByEmail.get("anushkagarg3008@gmail.com");

  // ── 3. Resolve / create labels ────────────────────────────────────────────
  const labelNames = ["VMIS", "CFTR", "Quality & Testing", "Data & Identifiers", "Backend", "Staging", "Report Integration"];
  const existingLabels = await db
    .collection("labels")
    .find({ workspaceId: WORKSPACE_ID, name: { $in: labelNames } })
    .toArray();

  const labelByName = new Map<string, Types.ObjectId>();
  for (const l of existingLabels) labelByName.set(l.name as string, l._id as Types.ObjectId);

  const newLabels = labelNames
    .filter((n) => !labelByName.has(n))
    .map((n) => ({
      _id: oid(),
      workspaceId: WORKSPACE_ID,
      name: n,
      color: null,
      createdBy: farazId,
      createdAt: now,
      updatedAt: now,
    }));

  if (newLabels.length) {
    await db.collection("labels").insertMany(newLabels);
    for (const l of newLabels) labelByName.set(l.name, l._id);
    console.log(`  Created labels: ${newLabels.map((l) => l.name).join(", ")}`);
  }

  const lbl = (...names: string[]) =>
    names.flatMap((n) => (labelByName.has(n) ? [labelByName.get(n)!] : []));

  const uid = (...emails: string[]) =>
    emails.flatMap((e) => (userByEmail.has(e) ? [userByEmail.get(e)!] : []));

  // ── 4. Find or create project ─────────────────────────────────────────────
  const projectName = "VMIS – CFTR G551D";
  let project = await db.collection("projects").findOne({ workspaceId: WORKSPACE_ID, name: projectName });
  if (!project) {
    const projectDoc = {
      _id: oid(),
      workspaceId: WORKSPACE_ID,
      name: projectName,
      description: "Migration of VMIS CFTR G551D workstream tasks from Asana.",
      key: "VMIS",
      color: "#8B5CF6",
      icon: null,
      createdBy: farazId,
      archivedAt: null,
      statusColor: null,
      statusNote: null,
      statusUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("projects").insertOne(projectDoc);
    project = projectDoc;
    console.log(`  Created project: "${projectName}"`);
  } else {
    console.log(`  Project exists: "${projectName}"`);
  }
  const projectId = project._id as Types.ObjectId;

  // ── 5. Find or create "Done" section ──────────────────────────────────────
  let section = await db.collection("sections").findOne({ workspaceId: WORKSPACE_ID, projectId, name: "Done" });
  if (!section) {
    const sectionDoc = {
      _id: oid(),
      workspaceId: WORKSPACE_ID,
      projectId,
      name: "Done",
      position: 1000,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("sections").insertOne(sectionDoc);
    section = sectionDoc;
    console.log(`  Created section: "Done"`);
  } else {
    console.log(`  Section exists: "Done"`);
  }
  const sectionId = section._id as Types.ObjectId;

  // ── 6. Task definitions ───────────────────────────────────────────────────
  interface SubtaskDef {
    title: string;
    status: string;
    priority: string;
    type: string;
    assigneeEmails: string[];
    dueDate: string | null;
    completedAt: string | null;
  }

  interface CommentDef {
    authorEmail: string;
    body: string;
  }

  interface TaskDef {
    title: string;
    description: string;
    status: string;
    priority: string;
    type: string;
    assigneeEmails: string[];
    labelNames: string[];
    dueDate: string | null;
    startDate: string | null;
    completedAt: string | null;
    createdByEmail: string;
    position: number;
    subtasks: SubtaskDef[];
    comments: CommentDef[];
  }

  const tasks: TaskDef[] = [
    {
      title: "Finish test setup / unit tests (unblocks team)",
      description:
        "Test setup that unblocks the team. Includes T0 shared infra, T10 CI, and T9 cross-module X-T1–X-T5 setup. Module owners can continue adding M*-T* cases using shared fixtures/helpers. PR #49 was reviewed and merged by Shrinjay. DS-2 remains blocked on NYU.",
      status: "DONE",
      priority: "HIGH",
      type: "TASK",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "Quality & Testing"],
      dueDate: "2026-06-21",
      startDate: null,
      completedAt: "2026-06-21",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 1000,
      subtasks: [],
      comments: [
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Test setup that unblocks the team (T0 shared infra, T10 CI, T9 cross-module X-T1–X-T5) is complete. Module owners can keep adding their M*-T* cases using the shared fixtures/helpers. Waiting on PR #49 merge; DS-2 blocked on NYU.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "PR reviewed and merged by Shrinjay.",
        },
      ],
    },
    {
      title: "Audit reusable annotation services",
      description:
        "Review the existing GeneGenius annotation services and confirm what VMIS can reuse. Check: VEP, ClinVar, gnomAD, HGVS normalization, and any existing transcript or protein mapping services. Do not rebuild any existing service. For each service, document what already works, which endpoint is used, what information it returns, current limitations, whether VMIS can reuse it, what important information is still missing, and what change is required, if any. Deliverable: one simple reuse table with these columns: Existing capability, Current endpoint, Current output, Reusable for VMIS?, Missing information, Required change, Owner.",
      status: "DONE",
      priority: "HIGH",
      type: "TASK",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "Data & Identifiers"],
      dueDate: "2026-06-22",
      startDate: null,
      completedAt: "2026-06-27",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 2000,
      subtasks: [],
      comments: [
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Closing the open thread from the 24th. The last update here was waiting on Vansh signing off the report-format check. That's done now. Verified across the board: Vansh signed off on the 25th, thin adapter not a schema merge, exactly as your pre-check predicted. It's recorded on the base data object.",
        },
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Correction: format check is signed off, but review still had two open items, one of them assigned to Anushka.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Both §7 blockers are now closed (26 Jun, Sagar + PR #3 on main): pinned demo job_id 7b13a5ff-47a6-45a3-bc39-72f2bac3267f in g551d_base.json → report_integration. VMIS owns case_id → job_id; backend has no case_id. VariantType is a strict enum (report.py:74); fixture uses SNV, VEP consequence in molecular_consequence. §7 adapter blockers are clear. Separate from §7: ClinVar parser, UniProt isoform, and LMNA coords were tracked separately as ISSUE-001–003 and fixed via backend PR #59 + fixture updates. Remaining conflicts_and_gaps items are QA/staging notes, not adapter blockers. Sprint slice complete: annotation reuse audit, identifier dictionary, report compatibility, 3 case fixtures, backend PRs #59–#61/#63, tier-1 smoke PASS on dev (:8100). Tracker updated. Next is Vansh thin report adapter + live wiring on the pinned job_id. After Vansh: Vish extensions.evidence, Sakshi extensions.mechanism, Zuhra scientific sign-off. Net-new VMIS graph/facade work is a later phase if assigned.",
        },
      ],
    },
    {
      title: "Create CFTR base data object",
      description:
        "Create the structured base data object for the CFTR G551D flagship case using existing GeneGenius services and verified scientific sources. Include gene symbol and approved gene name, genome assembly, chromosome and genomic coordinates, reference and alternate alleles, selected transcript and transcript version, HGVS genomic/coding/protein notation, variant type, ClinVar identifier and classification, dbSNP identifier if available, gnomAD population frequency, protein identifier and amino-acid change, existing ACMG classification output, and source/retrieval date for every field. Requirements: reuse existing VEP, ClinVar, gnomAD, HGVS, and ACMG services; do not rebuild or manually recreate existing annotation services; use one confirmed transcript consistently; mark missing or conflicting information clearly; do not include mechanism conclusions; add results to shared VMIS JSON structure; confirm field names with Faraz before finalizing. Deliverable: validated CFTR G551D base JSON object that can later be combined with Vish's evidence fields and Sakshi's mechanism fields. Final locked file: cases/cftr/g551d_base.json in genegenius-vmis repo, merged to main via PR #1.",
      status: "DONE",
      priority: "HIGH",
      type: "TASK",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "CFTR", "Data & Identifiers"],
      dueDate: "2026-06-22",
      startDate: null,
      completedAt: "2026-06-25",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 3000,
      subtasks: [],
      comments: [
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "The data and conflict catches are strong, especially flagging the ClinVar API misparse and correcting the case-pack VCV. One thing to resolve: locked version location at cases/cftr/g551d_base.json.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Yes, done with that.",
        },
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Closing the loop on the where-does-it-live question from the 25th. Verified: locked file is at cases/cftr/g551d_base.json in the genegenius-vmis repo, merged to main via PR #1 (vmis-grounding sync). Pulled the live file and checked it directly. It is the corrected version, not the old draft.",
        },
      ],
    },
    {
      title: "Define VMIS identifiers and provenance fields",
      description:
        "Define the standard identifiers and provenance fields that every VMIS scientific object must use. Include standards for gene identifier, transcript identifier and version, genomic HGVS, coding HGVS, protein HGVS, ClinVar Variation ID, dbSNP ID when available, protein identifier, disease and phenotype identifiers, publication identifier including PMID or DOI, source database, source URL, retrieval date, evidence type, evidence strength, review status, conflicting or contradictory evidence, and curator notes. Requirements: reuse current GeneGenius field names where possible; avoid duplicate identifiers for the same biological entity; clearly distinguish database facts from inferred VMIS conclusions; every scientific claim must be traceable to its source; missing information must be represented explicitly, not guessed; confirm final field names with Faraz before implementation; support Neo4j relationships and MongoDB workflow state. Deliverables locked under genegenius-vmis repo: docs/vmis/IDENTIFIER_AND_PROVENANCE_DICTIONARY.md, cases/cftr/g551d_base.json, cases/cftr/g551d_identifier_example.json.",
      status: "DONE",
      priority: "HIGH",
      type: "TASK",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "Data & Identifiers"],
      dueDate: "2026-06-23",
      startDate: null,
      completedAt: "2026-06-24",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 4000,
      subtasks: [],
      comments: [
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Field dictionary: VMIS Identifier & Provenance Dictionary. Standards covered for gene, transcript, HGVS g/c/p, ClinVar VCV, dbSNP, protein, disease/phenotype (MONDO/OMIM/HPO), PMID/DOI, evidence type/strength, review status, conflicts, and curator notes. Approved wrapper schema documented. Neo4j edge and MongoDB workflow_state patterns included. CFTR G551D examples: g551d_base.json and g551d_identifier_example.json. All three open issues tracked in VMIS Open Issues log tab. Conflict fields retained per instruction.",
        },
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Reviewed. Field dictionary covers everything the task asked for, two example files are aligned to the wrapper, and conflict fields are retained as instructed. Confirm wrapper is corrected one: canonical_id, source, source_object_id, version, retrieval_date, evidence_label, review_status.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Confirming approval: identifier dictionary is on the corrected wrapper, same nine fields as g551d_base.json: value, canonical_id, source, source_object_id, version, retrieval_date, evidence_label, review_status, notes. Dictionary + both CFTR examples are aligned; conflict fields retained. Locked for Sakshi/Vish under genegenius-vmis repo: docs/vmis/IDENTIFIER_AND_PROVENANCE_DICTIONARY.md, cases/cftr/g551d_base.json, cases/cftr/g551d_identifier_example.json. Wrapper: Faraz-approved ScientificValue. ClinVar review string lives in clinvar_review_status, not wrapper review_status. Report path confirmed by Vansh: thin adapter, not schema merge. Still open then: ClinVar API / ACMG conflicts in base JSON until backend PR #59 merges + live re-run.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "PR #59 merged, so this is all set.",
        },
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Validated against the actual deliverable. Dictionary covers every required field: gene, transcript+version, HGVS g/c/p, ClinVar VCV, dbSNP, protein, disease/phenotype, PMID/DOI, source DB, source URL, retrieval date, evidence type, evidence strength, review status, conflicts, curator notes. Wrapper is corrected nine-field one matching g551d_base.json. Example file handles conflict case correctly. One fix needed: §4.3 still has field labeled genome_assembly in genomic-HGVS table; rename to genome_build so doc does not contradict itself. Downstream items: case doc still had no job_id and backend variant_type enum confirmation. Schema validated and locked.",
        },
      ],
    },
    {
      title: "Fix ClinVar parser + clear the staging data checklist",
      description:
        "The annotation reuse audit found the demo was running on the API fallback path, and that path returned the wrong ClinVar significance. This task closes the gap between audit finding bugs and bugs being fixed. Blocker-level fix: ClinVar API parser returned Uncertain for all three known-pathogenic demo variants (CFTR G551D, HBB E6V, LMNA). Extend XML parser + allele matching so pathogenic variants read Pathogenic. Until then, no ClinVar evidence edges may be written to graph. Staging checklist: confirm gnomAD tabix files at data/gnomad and rerun tier-1 test; confirm ClinVar VCF at CLINVAR_VCF_PATH and rerun local lookup for all three demos; rerun ClinVar after parser fix expecting Pathogenic + expert-panel stars for CFTR G551D; wire VEPService.annotate_hgvs and confirm RefSeq pin enforcement; update LMNA fixture coordinate to chr1:156138613 C>T; commit identifier map with canonical UniProt P13569/P68871/P02545, HGNC, and ClinVar VCV; do not rely on gene_to_uniprot. Done means three demo variants resolve correct ClinVar significance from verified source, local data tiers confirmed on staging, and identifier map committed. PR #59 fixed ClinVar parser and VEP HGVS; PR #63 completed gnomAD local tabix wiring; PR #61 fixed actionability analyze 500.",
      status: "DONE",
      priority: "URGENT",
      type: "BUG",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "Backend", "Staging", "Quality & Testing"],
      dueDate: "2026-06-27",
      startDate: null,
      completedAt: "2026-06-30",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 5000,
      subtasks: [
        {
          title: "Shrinjay: manually validate before this goes green",
          status: "DONE",
          priority: "MEDIUM",
          type: "TASK",
          assigneeEmails: [],
          dueDate: "2026-06-29",
          completedAt: "2026-06-29",
        },
      ],
      comments: [
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Blocker fixed in PR #59 (live Pathogenic for all 3 demos + VEP HGVS wired); waiting merge. Full audit closure still needs staging gnomAD/ClinVar VCF deploy + genegenius-vmis doc/fixture updates (HBB/LMNA base JSONs, CFTR conflicts_and_gaps refresh).",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "ClinVar parser blocker fixed. PR #59 merged. All 3 demos (CFTR G551D, HBB E6V, LMNA) now return Pathogenic from the ClinVar API. VEP annotate_hgvs done, added to existing VEPService in PR #59; RefSeq pin enforced in case pack fixtures. LMNA coord fixed to chr1:156138613 C>T in case packs. Identifier map committed in genegenius-vmis with canonical UniProt P13569 / P68871 / P02545, HGNC, and ClinVar VCVs. Not relying on gene_to_uniprot. gene_to_uniprot isoform bug fixed in PR #59 with reviewed:true filter. CFTR demo ClinVar data is trustworthy on API path. Still open ops, not code: gnomAD tabix + ClinVar local VCF on staging handed off to Sagar; smoke script ready. genegenius-vmis docs updated. Separate PR #61 open for actionability /analyze 500 on dev, Sagar to merge and deploy.",
        },
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "Staging deploy done. ClinVar + gnomAD tabix + analyze-500 fix are live on :8100. Deployed v2-accelerated HEAD to dev/staging, restarted, health 200. PR #63 gnomAD local tabix wiring merged + deployed. Smoke real data: all 24 gnomAD chroms register; CFTR G551D resolves gnomAD via source=local_file tier=local_tabix AF=0.000276. ClinVar Pathogenic for all 3 demos. PR #61 already merged; /actionability/analyze returns 422 on bad input instead of 500. ClinVar VCF present and used. gnomAD has benign hts_idx_load3 index older than data warnings; indexes valid, ignore. Task ready for validation.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Thanks Faraz. That closes the VMIS annotation / ClinVar blocker and staging checklist for me. Tracker is updated and my slice is complete for this gate. HBB/LMNA gnomAD no-AF at pinned coords and the HBB local ClinVar miss remain documented non-blockers; API path is fine. Benign hts_idx_load3 index warnings can be ignored. Optional follow-up later with Zuhra on HBB/LMNA gnomAD browser checks and retrieval_date in provenance mapper before Neo4j edges.",
        },
      ],
    },
    {
      title: "Add job_id to CFTR case doc (resolve case_id → job_id)",
      description:
        "This came out of Vansh's report-format compatibility check in REPORT_FORMAT_COMPATIBILITY_CHECK.md section 7 Q4 and remaining-before-Vish/Sakshi-build list. Problem: downstream report generator, evidence trace, and progress stepper look up data by job_id using /api/v1/variant-report/{job_id}. g551d_base.json only had case_id cftr_g551d, so adapter could not safely generate report. Backend has no case_id concept; job_id UUID is only key via db.jobs.find_one({job_id}). Option A selected: add pinned clean demo job_id directly into cases/cftr/g551d_base.json under report_integration.job_id. Pinned job_id: 7b13a5ff-47a6-45a3-bc39-72f2bac3267f. VMIS owns case_id → job_id mapping. Done means the case doc carries/resolves job_id so report can be generated from cftr_g551d.",
      status: "DONE",
      priority: "URGENT",
      type: "TASK",
      assigneeEmails: ["anushkagarg3008@gmail.com"],
      labelNames: ["VMIS", "CFTR", "Report Integration"],
      dueDate: "2026-06-27",
      startDate: null,
      completedAt: "2026-06-30",
      createdByEmail: "mohdsarfaraz@genegenius.ai",
      position: 6000,
      subtasks: [
        {
          title: "Shrinjay: manually validate before this goes green",
          status: "DONE",
          priority: "MEDIUM",
          type: "TASK",
          assigneeEmails: [],
          dueDate: "2026-06-29",
          completedAt: "2026-06-29",
        },
      ],
      comments: [
        {
          authorEmail: "mohdsarfaraz@genegenius.ai",
          body: "job_id Option A pinned clean demo job: 7b13a5ff-47a6-45a3-bc39-72f2bac3267f. Created a single-variant CFTR G551D job on dev/staging :8100. Variant: CFTR chr7:117587806 G>A = 7:117587806:G>A, coords confirmed and stored chr-prefixed as chr7. GET /api/v1/variant-report/{job_id}/status returns 200. Put this in cases/cftr/g551d_base.json → report_integration.job_id and close ISSUE-005. Backend has no case_id concept; job_id UUID is the only key. VMIS owns case_id to job_id mapping. If fresh-run resolution is needed, query variants collection by coords → job_id field; no API endpoint exists for case_id to job_id. Caveat: job lives in genegenius_dev; if dev gets reseeded UUID needs re-pinning.",
        },
        {
          authorEmail: "anushkagarg3008@gmail.com",
          body: "Thanks. I already updated main with report_integration.job_id pinned, ISSUE-005 closed. VMIS owns case_id → job_id. Handed off to Vansh for the adapter.",
        },
      ],
    },
  ];

  // ── 7. Insert tasks, subtasks, comments ───────────────────────────────────
  let tasksInserted = 0, tasksExisted = 0;
  let subtasksInserted = 0;
  let commentsInserted = 0;

  for (const t of tasks) {
    const createdById = userByEmail.get(t.createdByEmail) ?? farazId;
    const assigneeIds = uid(...t.assigneeEmails);
    const labelIds = lbl(...t.labelNames);

    const taskDoc = {
      _id: oid(),
      workspaceId: WORKSPACE_ID,
      projectId,
      sectionId,
      parentTaskId: null,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      assigneeIds,
      labelIds,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      startDate: t.startDate ? new Date(t.startDate) : null,
      completedAt: t.completedAt ? new Date(t.completedAt) : null,
      createdBy: createdById,
      updatedBy: anushkaId ?? createdById,
      isArchived: false,
      position: t.position,
      recurrenceRule: null,
      recurrenceParentId: null,
      createdAt: t.completedAt ? new Date(t.completedAt) : now,
      updatedAt: now,
      __v: 0,
    };

    // Upsert task by title + projectId (idempotent)
    const existing = await db.collection("tasks").findOne({ workspaceId: WORKSPACE_ID, projectId, title: t.title });
    let taskId: Types.ObjectId;

    if (!existing) {
      await db.collection("tasks").insertOne(taskDoc);
      taskId = taskDoc._id;
      tasksInserted++;
    } else {
      taskId = existing._id as Types.ObjectId;
      tasksExisted++;
    }

    // Subtasks
    for (let si = 0; si < t.subtasks.length; si++) {
      const sub = t.subtasks[si];
      const subAssignees = uid(...sub.assigneeEmails);
      const subExists = await db.collection("tasks").findOne({ workspaceId: WORKSPACE_ID, parentTaskId: taskId, title: sub.title });
      if (!subExists) {
        await db.collection("tasks").insertOne({
          _id: oid(),
          workspaceId: WORKSPACE_ID,
          projectId,
          sectionId,
          parentTaskId: taskId,
          title: sub.title,
          description: null,
          status: sub.status,
          priority: sub.priority,
          type: sub.type,
          assigneeIds: subAssignees,
          labelIds: [],
          dueDate: sub.dueDate ? new Date(sub.dueDate) : null,
          startDate: null,
          completedAt: sub.completedAt ? new Date(sub.completedAt) : null,
          createdBy: farazId,
          updatedBy: farazId,
          isArchived: false,
          position: (si + 1) * 1000,
          recurrenceRule: null,
          recurrenceParentId: null,
          createdAt: now,
          updatedAt: now,
          __v: 0,
        });
        subtasksInserted++;
      }
    }

    // Comments — skip if task already had any (avoid duplicates on re-run)
    const commentCount = await db.collection("comments").countDocuments({ taskId });
    if (commentCount === 0 && t.comments.length > 0) {
      const commentDocs = t.comments.map((c, ci) => ({
        _id: oid(),
        workspaceId: WORKSPACE_ID,
        projectId,
        taskId,
        authorId: userByEmail.get(c.authorEmail) ?? farazId,
        body: c.body,
        mentionedUserIds: [],
        parentCommentId: null,
        deletedAt: null,
        createdAt: new Date(now.getTime() + ci * 1000),
        updatedAt: new Date(now.getTime() + ci * 1000),
      }));
      await db.collection("comments").insertMany(commentDocs);
      commentsInserted += commentDocs.length;
    }
  }

  console.log(`\nDone:`);
  console.log(`  Tasks   : ${tasksInserted} inserted, ${tasksExisted} already existed`);
  console.log(`  Subtasks: ${subtasksInserted} inserted`);
  console.log(`  Comments: ${commentsInserted} inserted`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
