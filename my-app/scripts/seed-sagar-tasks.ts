/**
 * Seed Sagar's tasks across three projects in the GG-sprint workspace.
 * Fully idempotent — safe to re-run.
 * Run with: npx tsx scripts/seed-sagar-tasks.ts
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch { /* env already set */ }

import mongoose, { Types } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const WS_ID = new Types.ObjectId("6a464523e390183a5e503439");
const oid = () => new Types.ObjectId();
const now = new Date();

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommentDef { authorEmail: string; body: string; createdAt?: string; }
interface SubtaskDef {
  title: string; description?: string; status: string;
  priority: string; type?: string; assigneeEmails: string[];
  dueDate: string | null; completedAt: string | null;
  createdByEmail?: string; comments?: CommentDef[];
}
interface TaskDef {
  title: string; description?: string; status: string;
  priority: string; type: string; assigneeEmails: string[];
  labelNames: string[]; dueDate: string | null; startDate?: string | null;
  completedAt: string | null; createdByEmail: string;
  position: number; subtasks: SubtaskDef[]; comments: CommentDef[];
}
interface SectionDef { name: string; position: number; tasks: TaskDef[]; }
interface ProjectDef { name: string; description: string; sections: SectionDef[]; }

// ── Project / task data ───────────────────────────────────────────────────────

const PROJECTS: ProjectDef[] = [
  {
    name: "VMIS – CFTR G551D MVP",
    description: "CFTR G551D minimum-viable interpretation pipeline",
    sections: [
      {
        name: "Untitled section",
        position: 1000,
        tasks: [
          {
            title: "Confirm VariantType enum vs string in backend report.py, report to Vansh",
            description:
              "sagar, this is a quick one but it gates the adapter design, so it can't stay unknown. it came out of vansh's report-format compatibility check (the doc mapping the vmis json against the gg report schema): https://github.com/GGinc/gg-vmis/blob/main/docs/vmis/REPORT_FORMAT_COMPATIBILITY_CHECK.md (section 7, Q3 and remaining items). vansh couldn't answer it himself because the file in question lives in the backend repo, not the frontend one he reviewed.\n\nthe problem in plain terms: in g551d_base.json our variant_type value is \"missense_variant\". the backend report schema app/schemas/report.py has a field called VariantType. if VariantType is a strict pydantic enum (only accepts a fixed set like SNV/indel), then handing it \"missense_variant\" makes the report-generation call throw a validation error and the report never renders. if VariantType is just a free-text string, \"missense_variant\" passes fine and there's nothing to fix. nobody has actually looked, so we're designing the adapter on a guess.\n\nwhat to actually do: open app/schemas/report.py in the backend repo, read the VariantType definition, and answer one question, is it a strict enum or a free string. then tell Vansh.\n if strict enum: the adapter must convert/derive the SNV/indel class from ref/alt allele lengths before sending, and keep the VEP consequence (missense_variant) in molecular_consequence.\n if free string: no conversion needed, adapter passes it straight through.\n\ndone = you've read report.py, posted \"enum\" or \"string\" here, and vansh has what he needs to finalize the adapter.\nblocks: report adapter design depends on this answer.",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-27",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 1000,
            subtasks: [
              {
                title: "Vansh: confirm the adapter renders a G551D report without a ValidationError",
                description:
                  "The VariantType question is answered and correct (confirmed twice, mine + Sagar's): app/schemas/report.py is a STRICT pydantic enum (SNV / Insertion / Deletion / Indel / Copy Number Variant / Complex), required field. So missense_variant throws a ValidationError. The adapter design is right: derive variant_type from ref/alt lengths, keep missense_variant in molecular_consequence. For G551D (chr7:117587806 G>A, single nucleotide) send SNV.\n\nyou're unblocked. This subtask stays open until you confirm the adapter actually renders a G551D report end to end without a ValidationError, that's the real proof, not the enum answer itself.",
                status: "TODO",
                priority: "MEDIUM",
                type: "TASK",
                assigneeEmails: ["vanshgoel979@gmail.com"],
                dueDate: null,
                completedAt: null,
                createdByEmail: "mohdsarfaraz@gg.ai",
              },
            ],
            comments: [
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "Answer: STRICT ENUM (not a free string). So the adapter conversion IS required — your design is correct, just confirmed.\n\napp/schemas/report.py (v2-accelerated), line 74:\n\nclass VariantType(str, Enum):\n SNV = \"SNV\"\n INSERTION = \"Insertion\"\n DELETION = \"Deletion\"\n INDEL = \"Indel\"\n CNV = \"Copy Number Variant\"\n COMPLEX = \"Complex\"\n\nUsed at line 503 (required field): variant_type: VariantType = Field(..., description=\"Variant type\")\n\nSo handing it \"missense_variant\" WILL throw a pydantic ValidationError and the report won't render. Adapter must derive variant_type (SNV / Insertion / Deletion / Indel) from ref/alt allele lengths before sending, and keep the VEP consequence (missense_variant) in molecular_consequence. For CFTR G551D (7:117587806 G>A) -> send \"SNV\".",
                createdAt: "2026-06-28T02:14:57Z",
              },
              {
                authorEmail: "sagar.gour@gg.ai",
                body: "Answer: STRICT ENUM (not a free string). So the adapter conversion IS required — Vansh's design is correct, just confirmed. app/schemas/report.py (v2-accelerated) line 74 VariantType(str, Enum): SNV/Insertion/Deletion/Indel/Copy Number Variant/Complex; used at line 503 as required field. Handing it \"missense_variant\" throws a ValidationError. Adapter must (1) derive variant_type from ref/alt allele lengths and (2) keep missense_variant in molecular_consequence. For CFTR G551D (7:117587806 G>A) -> send \"SNV\". @Vansh you're unblocked to finalize the adapter.",
                createdAt: "2026-06-28T02:27:52Z",
              },
            ],
          },
          {
            title: "Manually validate the items that can't be verified from reports (pre-Monday gate)",
            description:
              "Several VMIS items are marked done based on teammate reports, not independent validation. Before Monday, someone with repo + staging access needs to actually run/check these. Shrinjay owns this gate. None of these can be validated from Asana or chat - they need hands on the system.\n\nVERIFIED ALREADY: CFTR G551D job coordinate chr7:117587806 G>A is CORRECT - confirmed against ClinVar (GRCh38, NM_000492.4:c.1652G>A, p.Gly551Asp), VCV000007120 / variation 7120. Differs from 7:117559593 (older docs / patent disclosure) and case-pack VCV000007105 - 117587806 / VCV000007120 is the right one. Do not let anyone \"correct\" the job to 117559593 or the id to 007105.\n\nNEEDS HUMAN VALIDATION (Sagar reported these done; confirm by actually running):\n1. Staging deploy on :8100 - health 200, gnomAD tabix + ClinVar VCF + analyze-fix + M1 all live.\n2. Smoke test - ClinVar returns Pathogenic for CFTR/HBB/LMNA, CFTR gnomAD resolves via local_tabix. Re-run scripts/vmis_tier1_smoke.py.\n3. /actionability/analyze - returns 422 on bad input instead of post-#60 500.\n4. PRs #61 (analyze-500 null-safety) and #63 (gnomAD local tabix) merged to v2-accelerated.\n5. VariantType enum - app/schemas/report.py strict pydantic enum; Vansh's adapter renders a report for G551D without a ValidationError.\n6. variant-report renders 200 for the pinned job (7b13a5ff-47a6-45a3-bc39-72f2bac3267f).\n\nCITATION LAYER (every PMID/DOI must resolve to a real CFTR/G551D paper):\n7. Vish's claim-to-source mapping (marked COMPLETE but had a confirmed unresolved retrieval issue). DONE WHEN every PMID/DOI resolves to a real CFTR/G551D paper on a clean run.\n8. Shrinjay's arch doc section 7.2 - three wrong PMIDs (22293454, 16113672, 23757338) regenerated from the real CFTR fixture.\n9. Anushka's g551d_identifier_example.json - verify every PMID/DOI resolves to a real CFTR/G551D paper.\n\nDONE WHEN: items 1-6 confirmed by actually running them on staging/repo, 7-9 confirmed clean, and any failures flagged back here.",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["shrinjayshresth@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-29",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 2000,
            subtasks: [],
            comments: [
              { authorEmail: "shrinjayshresth@gg.ai", body: "Please find this validation report.", createdAt: "2026-06-29T06:55:54Z" },
              {
                authorEmail: "vishvakpune@gmail.com",
                body: "cite-to-source mapping bug found and fixed and pushed to codebase. PR #5 in gg-vmis is the fix. All self-contained: _search_pubmed() uses _build_query()'s output (with mechanism terms) directly against E-utilities, no backend change needed. PMIDs in the fixture are clean (verified above), and PR #5 fixes the live retrieval pulling irrelevant papers. Ready for review.",
                createdAt: "2026-06-29T18:36:03Z",
              },
              {
                authorEmail: "anushkagarg3008@gmail.com",
                body: "Thanks, PR #5 looks right to me (_search_pubmed() using _build_query() with mechanism terms fixes the irrelevant-paper pulls). Good that the passages fixture PMIDs are verified clean - that should let Shrinjay close Action C / arch §7.2 once #5 merges. My side: PR #6 is merged - fixed the bad PMID in g551d_identifier_example.json (19846786 -> 21083385). Base annotation + job_id were already on main.",
                createdAt: "2026-06-30T01:49:25Z",
              },
              { authorEmail: "shrinjayshresth@gg.ai", body: "Let's merge it then !", createdAt: "2026-06-30T06:17:33Z" },
              { authorEmail: "shrinjayshresth@gg.ai", body: "This task is already completed by the team, awaiting sagar's merge.", createdAt: "2026-07-01T08:10:12Z" },
            ],
          },
          {
            title: "Lock and freeze the VMIS architecture",
            description:
              "Why this exists: Shrinjay already reviewed and approved the VMIS architecture (backend reuse confirmed accurate: MongoDB, Neo4j, Redis, VEP/ClinVar/gnomAD/HGVS, ACMG, PubMed/BioBERT, async FastAPI/asyncio - not Celery, not PostgreSQL/pgvector; only net-new frontend piece is the Cytoscape mechanism graph). That review now needs to be formally locked as the signed reference the whole sprint builds against.\n\nWhat to do:\n1. Write the reviewed/approved architecture up as the frozen reference (canonical, dated, signed).\n2. Confirm the data-layer split is locked: Neo4j owns biological entities/assertions/evidence/hypotheses/contradictions; MongoDB owns users/jobs/run-state/reviews/audit/report-metadata/cached responses.\n3. Confirm the graph-write gate rule: no factual edge without source + evidence_label + retrieval_date.\n4. Close the two open low-risk items: CFTR fixture -> report-schema check (port.py), and Europe PMC sufficiency (Vish T07).\n5. Sign it off so any later architecture change requires explicit approval.\n\nOwner: Shrinjay (architecture authority). Supervised by Faraz.\nReference document: https://docs.google.com/document/d/1VQPHVYBdoW1fQFRlWhUZNJv_gVLoo1ouG1ujxNsGkfQ/edit",
            status: "DONE",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["shrinjayshresth@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-27",
            completedAt: "2026-07-01",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 3000,
            subtasks: [],
            comments: [
              { authorEmail: "shrinjayshresth@gg.ai", body: "Up for your review - sent on whatsapp", createdAt: "2026-06-26T05:55:44Z" },
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "shrinjay this is strong. the architecture is genuinely well thought through. the neo4j/mongo split is clean and right, the write-gate rule (no factual edge without source + evidence_label + retrieval_date) is exactly the enforcement that protects our scientific credibility, and the reuse decisions are disciplined. approved on the architecture, no changes.\n\none thing to fix before we lock it, section 7.2. it lists four pmids as the proof that pubmed covers our cftr literature: 22293454, 21083385, 16113672, 23757338. three don't resolve to cftr papers:\n- 22293454 is a cardiology paper on uric acid and atrial fibrillation\n- 16113672 is a stem-cell transplant paper\n- 23757338 is an hiv paper\n- only 21083385 (accurso 2010, vx-770 in g551d) is the real cftr paper\n\nbefore lock: (1) regenerate the 7.2 pmids from the actual cftr fixture, confirm each resolves to a real cftr paper; (2) quick trace on where the four came from, doc-level vs pipeline-level; (3) clean 7.2 and i sign off same day. everything else is locked from my side.",
                createdAt: "2026-06-28T04:47:31Z",
              },
              { authorEmail: "shrinjayshresth@gg.ai", body: "Up for your review", createdAt: "2026-06-29T06:22:31Z" },
              { authorEmail: "shrinjayshresth@gg.ai", body: "Marking this complete.", createdAt: "2026-07-01T08:05:27Z" },
            ],
          },
          {
            title: "Add job_id to CFTR case doc (resolve case_id -> job_id)",
            description:
              "anushka, this came out of vansh's report-format compatibility check: https://github.com/GGinc/gg-vmis/blob/main/docs/vmis/REPORT_FORMAT_COMPATIBILITY_CHECK.md (section 7, Q4). flagging now because it quietly blocks the report adapter and nobody owns it.\n\nthe problem: everything downstream that turns a case into a report looks data up by job_id (the /api/v1/variant-report/{job_id} pattern). but g551d_base.json only carries case_id (cftr_g551d). there is no job_id and no way to get from case_id to job_id, so the adapter can't be built.\n\nwhat to do (pick the one that matches the backend):\n option A: add a job_id field directly into g551d_base.json (a fixed job id for this demo case)\n option B: add a small resolver so case_id cftr_g551d maps to the correct job_id\ndepends on how jobs are keyed in the backend, so coordinate with Sagar to get the job keying pattern, then make the change on your file.\n\ndone = the case doc either carries a job_id or can resolve case_id to a job_id.\nblocks: report adapter (vish/vansh) cannot be safely built until this lands.",
            status: "DONE",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["anushkagarg3008@gmail.com"],
            labelNames: [],
            dueDate: "2026-06-27",
            completedAt: "2026-06-30",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 4000,
            subtasks: [
              {
                title: "Shrinjay: manually validate before this goes green",
                description:
                  "Validate, then mark this task green yourself:\n The pinned job 7b13a5ff-47a6-45a3-bc39-72f2bac3267f actually renders variant-report 200\n The coordinate is chr7:117587806 G>A, the CORRECT canonical G551D position (verified against ClinVar, VCV000007120). Do NOT let it be \"corrected\" to 117559593 or VCV000007105.\nFull detail is in the pre-Monday validation gate task (item 6). Close this ONLY after you've confirmed the report renders, not after re-reading the report.",
                status: "DONE",
                priority: "MEDIUM",
                type: "TASK",
                assigneeEmails: ["shrinjayshresth@gg.ai"],
                dueDate: "2026-06-29",
                completedAt: "2026-06-30",
                createdByEmail: "mohdsarfaraz@gg.ai",
                comments: [
                  {
                    authorEmail: "shrinjayshresth@gg.ai",
                    body: "Confirmed chr7:117587806 G>A is the correct canonical G551D position. Confirmed across 6+ independent code locations (m1_structural_demo_multigene.vcf, test_vmis_annotation_fixes.py:121, scripts/vmis_tier1_smoke.py:18, docs/VMIS_VALIDATION_REPORT_2026-06-29.md:205). 117559593 is F508del (CFTR p.Phe508del) - a completely different variant.\n\nVariant-report render - PARTIAL: GET /api/v1/variant-report/7b13a5ff.../json -> 200; GET .../ (PDF) -> 500. The PDF 500 is a known one-line bug: variant_report.py:1398 calls pdf_generator_v2.generate_pdf_report(...) but the DI parameter is named pdf_generator. Not deployed yet.\n\nSagar - deploy the one-line fix (variant_report.py:1398, pdf_generator_v2 -> pdf_generator). Gate to close green: JSON is already 200.",
                    createdAt: "2026-06-29T07:54:12Z",
                  },
                  {
                    authorEmail: "anushkagarg3008@gmail.com",
                    body: "I already implemented this. job_id 7b13a5ff-47a6-45a3-bc39-72f2bac3267f is in cases/cftr/g551d_base.json -> report_integration (merged PR). Coords locked chr7:117587806 G>A - not F508del (117559593). JSON report endpoint 200 confirmed. PDF 500 is Sagar's one-line pdf_generator fix - out of scope for this task. OK to close green on JSON bar.",
                    createdAt: "2026-06-30T01:39:15Z",
                  },
                  { authorEmail: "shrinjayshresth@gg.ai", body: "LGTM!", createdAt: "2026-06-30T06:17:01Z" },
                ],
              },
            ],
            comments: [
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "job_id (Option A - pinned clean demo job): 7b13a5ff-47a6-45a3-bc39-72f2bac3267f. Created a single-variant CFTR G551D job on dev/staging (:8100): 1 variant CFTR chr7:117587806 G>A; GET /api/v1/variant-report/{job_id}/status -> 200. Put this in cases/cftr/g551d_base.json -> report_integration.job_id and close ISSUE-005.\n\nKey fact: the backend has no case_id concept - job_id (UUID) is the only key, resolved via db.jobs.find_one({\"job_id\": ...}). So VMIS owns the case_id->job_id mapping. Auth for the :8100 API: m1.demo@gg.dev / M1Demo@2026. Caveat: this job lives in gg_dev; if dev gets re-seeded the UUID needs re-pinning.",
                createdAt: "2026-06-28T02:16:19Z",
              },
              {
                authorEmail: "anushkagarg3008@gmail.com",
                body: "Thanks! I already updated main with report_integration.job_id pinned, ISSUE-005 closed. VMIS owns case_id -> job_id. Handed off to Vansh for the adapter.",
                createdAt: "2026-06-28T03:13:43Z",
              },
            ],
          },
        ],
      },
      {
        name: "Data and Existing-System Reuse",
        position: 2000,
        tasks: [
          {
            title: "Audit reusable annotation services",
            description:
              "Review the existing GG annotation services and confirm what VMIS can reuse.\nCheck: VEP, ClinVar, gnomAD, HGVS normalization, any existing transcript or protein mapping services. Do not rebuild any existing service.\nFor each service document: what already works, which endpoint is used, what it returns, current limitations, whether VMIS can reuse it, what important information is still missing, what change is required.\nDeliverable: one reuse table with columns: Existing capability, Current endpoint, Current output, Reusable for VMIS?, Missing information, Required change, Owner.",
            status: "DONE",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["anushkagarg3008@gmail.com"],
            labelNames: [],
            dueDate: "2026-06-22",
            completedAt: "2026-06-23",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 1000,
            subtasks: [],
            comments: [
              {
                authorEmail: "anushkagarg3008@gmail.com",
                body: "Reviewed existing VEP, ClinVar, gnomAD, HGVS, and transcript/protein mapping services. Documented reuse matrix with endpoints, outputs, gaps, and required changes. Live-tested 3 demo variants. Verdict: reuse existing services; extend VEP HGVS + ClinVar parser + provenance wrapper; do not rebuild.",
                createdAt: "2026-06-23T04:55:54Z",
              },
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "anushka this is excellent, approved. testing live all three cases instead of reading code is exactly what i wanted. three things you flagged are important and i want them tracked: the clinvar parser returning uncertain for all three pathogenic cases, the wrong uniprot isoforms, and the lmna coordinate fix. log those. one thing before you move to provenance fields, do the 30 min check with vansh on whether your json fits into the existing report format.",
                createdAt: "2026-06-23T17:03:18Z",
              },
              {
                authorEmail: "anushkagarg3008@gmail.com",
                body: "Confirmed the live testing all three cases (CFTR G551D, HBB E6V, LMNA silent) via existing GG services + external APIs. Three flagged items logged in VMIS Open Issues Log. Vansh 30-min check: in progress - shared the report check and base json file with him; pre-check: partial fit to VariantInterpretation, likely a thin adapter not a schema merge. Consolidated in shared Google Doc: https://docs.google.com/document/d/10UhdjZ30XyQ5KKo9ZGNBCfxCeII_qDtZqTBUAYoGo1M/edit",
                createdAt: "2026-06-24T23:09:56Z",
              },
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "closing the open thread from the 24th. vansh signed off on the 25th, thin adapter not a schema merge, exactly as your pre-check predicted (confirmed_vansh 2026-06-25). the three flagged bugs are tracked: ISSUE-001 clinvar parser, ISSUE-002 wrong uniprot isoform, and the lmna coordinate fix.",
                createdAt: "2026-06-26T23:05:10Z",
              },
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "correcting myself - the format check is signed off but Vansh's review still has two open items in section 7: (1) the case doc has no job_id (anushka, add a job_id or resolver, coordinate with Sagar); (2) backend variant_type isn't confirmed (Sagar, open report.py, confirm enum or free string, tell Vansh). the three data bugs are separate and already tracked in conflicts_and_gaps.",
                createdAt: "2026-06-26T23:28:58Z",
              },
              {
                authorEmail: "anushkagarg3008@gmail.com",
                body: "Update: both §7 blockers are now closed (26 Jun, Sagar + PR #3 on main): pinned demo job_id 7b13a5ff-... in g551d_base.json -> report_integration; VariantType is a strict enum (report.py:74), fixture uses SNV. ClinVar parser, UniProt isoform, LMNA coords fixed via backend PR #59 + fixture updates (ISSUE-001..003). My sprint slice is complete. Next is Vansh (thin report adapter + live wiring on the pinned job_id), then Vish (extensions.evidence), Sakshi (extensions.mechanism), Zuhra (scientific sign-off).",
                createdAt: "2026-06-28T03:09:01Z",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "GG Sprint",
    description: "Core product sprint + production incident remediation",
    sections: [
      {
        name: "Untitled section",
        position: 1000,
        tasks: [
          {
            title: "Send Vish the security architecture",
            description:
              "Vish is blocked waiting on this. He needs the security architecture from Sagar to move forward on his side.\nSagar's job: design the security architecture and share it with Vish. This is the structural piece, not the full deep hardening (that comes later at full deploy). Right now Vish needs the design so he is not stuck.\nEven at research stage, and since we handle genomic data, the security architecture is a now item, not a deploy-time afterthought.",
            status: "DONE",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-21",
            completedAt: "2026-06-25",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 1000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Update the Manuscipt - GG_TECHNICAL_ARCHITECTURE.md",
            description:
              "Context: the comprehensive GG technical architecture document (docs/GG_TECHNICAL_ARCHITECTURE.md, branch v2-accelerated) has been refreshed with current modules, datasets, integrations, GPU usage, and the measured H100 benchmark/accuracy suite. It's the deliverable for Faraz. A new appendix \"Open Items — Flagged for Sagar's Review\" (top of §23) lists where source numbers diverge or aren't yet measured.\n\nAction: review the Open Items appendix (§23) and commit your additions/corrections directly to docs/GG_TECHNICAL_ARCHITECTURE.md on v2-accelerated.\n\nDECISIONS NEEDED: (1) GIAB accuracy headline §17.13 - feature BED vcfeval F1 (0.98) only, or also strict-tuple F1 (0.87/0.77)? (2) VUS framing §17.14 - lead with 18.5% (clinical WGS) or both that and 61.9% (ClinVar-270)? (3) Classifier accuracy §17.13 - measured precision/recall/AUROC vs a truth set, or concordance/parity only? (4) ACMG criteria phrasing - \"15/28 fired\" vs \"27 implemented + 1 surrogate\" vs \"28-criteria\"? (5) Document version - bump 2.9.x -> 3.0.0?\nDATA TO VERIFY/FILL: (6) KG node/edge counts §11.1 (replace Nov-2025 placeholders 45,123 / 123,456 with live counts); (7) whole-file SLA target §17.2 (10 vs 20 min); (8) DrugBank/PharmGKB record counts §12.1 (~19,842 drugs / ~5,186 clinical annotations); (9) test count + coverage % §18.1; (10) M1 unit-test count §10.10 (44/44 vs 8-case suite); (11) V2 integration liveness §10/§14 (CIViC/KEGG/gnomAD-constraint + GTEx v8/SpliceAI tabix live vs stubbed).\nDeliverable: edits committed to v2-accelerated before the doc goes to Faraz.",
            status: "DONE",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-20",
            completedAt: "2026-06-21",
            createdByEmail: "shrinjayshresth@gg.ai",
            position: 2000,
            subtasks: [],
            comments: [
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "Hey Sagar, the due date for this task was yesterday — could you share a quick update on where things stand? Let us know if you need anything to move it forward. Thanks!",
                createdAt: "2026-06-21T18:02:14Z",
              },
            ],
          },
          {
            title: "Deployment-branch technical specifics (for paper)",
            status: "TODO",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-21",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 3000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Deploy + verify Shrinjay's atomicity fix on AWS branch",
            description:
              "Shrinjay fixed the atomicity / genome ID bug that was causing the 4 to 8 minute stall. It is tested and passing locally (45-46 test cases), but local passing is not the same as it working in production.\nSagar's job: cherry-pick that commit from the v2 branch onto the AWS cloud branch, deploy it, and verify the fix actually holds live. Confirm the stall is gone on a real deployment.\nApproach it one module at a time so a break traces to the exact step. Keep the backend-cleaning work on a separate branch, not v2, so nobody's testing breaks this weekend.",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-21",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 4000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Run 5 cold-user tests this weekend",
            description:
              "Every one of us runs 5 real user tests this weekend. People who have never touched genomics. The point is to see the platform through a stranger's eyes.\nHow: hand them a VCF file, point them at the platform, tell them to log in and go. We do not help. We watch. From upload to done, note where they hesitate, get stuck, what confuses them, where they'd have quit. Use different VCF files across people.\nLog everything in the user-testing sheet Shrinjay is setting up, one row per person. With the whole team doing 5 each, plus Aman running 5 with Beata's genomics contacts, that's real volume of honest feedback by Monday.",
            status: "DONE",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["mohdsarfaraz@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-22",
            completedAt: "2026-06-27",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 5000,
            subtasks: [],
            comments: [],
          },
          {
            title: "ClinVar cache + NCBI key + gnomAD chr-prefix + ACMG null-check (P0/P1 fixes)",
            description:
              "Vish, two things changed with the prod run and the priority order flipped. Speed is mostly solved on EC2 (all_clinical went 780s -> 1s). The thing that matters most now: per-variant completion is low on prod, not local.\nOn the EC2 host most variants come back Partial, not Complete. tier4 is 2% complete, tier3 is 8%, pharmcat has 34 fatal variant errors. The file-level status still says OK and finishes in seconds, which is why this is dangerous. First job: dig into what \"Partial\" means per variant, what stage is failing, and why so many don't complete (host ip-172-31-36-14, not the local neo4j/mongo issue).\n\nThen the four fixes, in order:\n 1. ClinVar in-process cache (P0), keyed on (chrom,pos,ref,alt), lru_cache or Mongo TTL. File: app/services/clinvar_service.py\n 2. Set NCBI_API_KEY (P0) in .env and .env.production. Raises cap 3 -> 10 req/s.\n 3. Strip the chr prefix before the gnomAD tabix query (P1). File: app/services/gnomad_service.py\n 4. ACMG null-check on gnomAD constraint (P1, correctness). When constraint data is missing the classifier crashes and silently skips ACMG classification. File: app/services/acmg_classifier.py\nThe null-check (4) and the completion investigation are connected. Confirm chr22 variants actually classify after the fix.",
            status: "DONE",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["vishvakpune@gmail.com"],
            labelNames: [],
            dueDate: "2026-06-21",
            completedAt: "2026-06-27",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 6000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Explore + pursue AWS Partner Network (APN) funding benefits",
            description:
              "Explore and pursue AWS Partner Network (APN) funding benefits for GG, and align them with the live Innovative Solutions engagement. Faraz flagged this (June 27); Matt is taking it on after the KPMG application; Sagar is added for the technical side.\n\nTHE TWO THINGS THIS CONNECTS:\n1. APN partner funding: https://aws.amazon.com/partners/funding/ - AWS funds Partners on training, product/solution development, and go-to-market. We're well-positioned: platform live on AWS GPU, NVIDIA Inception member, AWS Activate credits.\n2. The Innovative Solutions engagement (live, time-sensitive): a milestone-based migration of the platform onto EKS GPU infrastructure, Innovative's services AWS-funded. AJ Rivera's team (ajrivera@innovativesol.com); Sarah at AWS is the funding contact. Compute numbers from Zuhra's email to Sarah: WO1 (Jul 1-15) assessment ~$0; WO2 (Jul 15-Aug 15) EKS GPU env ~$21,750/mo; WO3 (Aug 15-Sep 15) production ~$21,750/mo; WO4 (Sep 15-Oct 1) advanced orchestration ~$22,750/mo. Spend starts July 15, scaling toward ~$261K/year at full production.\n\nLIVE DEADLINE: WO1 is assessment-only, so there is a window BEFORE WO2 spend starts July 15 to get the compute-cost path sorted. Zuhra asked Sarah for 20 minutes early next week to find a route through the compute cost.\n\nWHAT MATT + SAGAR DO: Matt - map which APN funding benefits we qualify for and how they stack with (not double-claim against) the AWS-funded Innovative engagement; support Zuhra's Sarah conversation. Sagar - the AWS services/architecture inputs needed to qualify for the build/proficiency and migration funding buckets (EKS GPU, migration scope); owns the technical case alongside AJ's team.\nKEY CONTACTS: Sarah (AWS funding) · AJ Rivera ajrivera@innovativesol.com · Zuhra zuhra@gg.ai · Matt matthew@gg.ai.\nDONE WHEN: APN benefits identified and mapped against the Innovative engagement, claim-sheet drafted, lined up to support Zuhra's funding conversation with Sarah BEFORE the July 15 WO2 spend starts.",
            status: "DONE",
            priority: "MEDIUM",
            type: "TASK",
            assigneeEmails: ["matthew@gg.ai"],
            labelNames: [],
            dueDate: "2026-07-03",
            completedAt: "2026-07-01",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 7000,
            subtasks: [],
            comments: [],
          },
        ],
      },
      {
        name: "Production Incident Remediation",
        position: 2000,
        tasks: [
          {
            title: "Resolve production branch divergence",
            description:
              "Create and implement a plan to eliminate dangerous divergence between development, integration, and production deployment branches.\nReview: main, v2-accelerated, aws-prod, deploy-v2-to-prod, deploy/sec-jun21, nvidia-pilot, current CI/CD deployment lineage.\nDefine: the authoritative integration branch; the authoritative production branch; required merge/sync frequency; how production branches stay current; how deployed FE/BE commit versions are recorded; how the team confirms completed work is actually deployable; how emergency backports are handled; how stale branches are detected/reported; tags vs release branches vs trunk-based; who can approve production deployments.\nAcceptance: production cannot remain materially behind without a visible warning; every deployment records exact FE and BE commits; \"completed on development\" cannot be confused with \"deployed\"; one documented release process; stale branches updated/retired/documented; process reflected in CI/CD + repo docs.\nDeliverable: an approved branch and deployment strategy with implementation steps, owners, and evidence the new process is active. Incident reference: docs/INCIDENT_2026-06-21_seck_cookie_auth.md",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-25",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 1000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Define frontend-backend authentication release gate",
            description:
              "Define and implement a release gate for frontend and backend changes that modify the authentication contract.\nRequirements: backend auth support must deploy and be verified before the frontend depends on it; auth transport changes treated as one cross-service contract; PRs must identify FE-BE auth dependencies; required deployment order documented; backward compatibility until the new auth path is verified; tests run against the actual deploy branch; rollback sequence documented; required reviewers/approvals identified; checklist covers standard login, OAuth, refresh, logout, MFA-sensitive paths; a FE change must not move to cookie-only auth until the production backend is verified to issue and accept the cookie.\nDeliverable: a documented authentication release checklist and an enforced PR/deployment gate that prevents FE-BE version skew. Incident reference: docs/INCIDENT_2026-06-21_seck_cookie_auth.md",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-24",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 2000,
            subtasks: [],
            comments: [],
          },
          {
            title: "Implement post-deploy authentication smoke test",
            description:
              "Implement an authentication smoke test in the production deployment pipeline. After the backend restarts, the pipeline must: perform a real login against the newly deployed backend; confirm the response issues the auth_token HttpOnly cookie; use that cookie to call an authenticated endpoint; confirm it does not return 401; fail the deployment if any auth check fails; record useful failure logs without exposing credentials/cookies/tokens; test standard login and relevant OAuth/MFA paths where practical; document the test and rollback behavior.\nAcceptance: a backend that does not issue the session cookie cannot pass deployment; the smoke test runs against the actual deployed environment; CI clearly reports auth-contract failures; production verification attached. Incident references: docs/INCIDENT_2026-06-21_seck_cookie_auth.md",
            status: "DONE",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["shrinjayshresth@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-23",
            completedAt: "2026-06-26",
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 3000,
            subtasks: [],
            comments: [
              {
                authorEmail: "mohdsarfaraz@gg.ai",
                body: "This follow-up task was created from the June 21 production authentication incident report. Please review the scope, confirm ownership and dependencies, and add any blockers or proposed changes here before starting. Do not mark complete until the acceptance criteria and production verification are attached.",
                createdAt: "2026-06-21T18:24:52Z",
              },
              { authorEmail: "shrinjayshresth@gg.ai", body: "Raised the PR for Sagar's review.", createdAt: "2026-06-22T04:00:27Z" },
              {
                authorEmail: "shrinjayshresth@gg.ai",
                body: "Kindly provide and attach the verification of the acceptance criteria & the production verification to mark this task as complete.",
                createdAt: "2026-06-22T14:05:57Z",
              },
              {
                authorEmail: "shrinjayshresth@gg.ai",
                body: "Attaching the verification report shared by Sagar.",
                createdAt: "2026-06-26T09:31:38Z",
              },
            ],
          },
          {
            title: "Add production authentication monitoring and alerts",
            description:
              "Add production monitoring for authentication failures so future outages are detected automatically instead of through teammate or user reports.\nMonitor: login success/failure rates; authenticated endpoint 401 rates; OAuth callback failures; MFA verification failures; missing session-cookie issuance; sudden auth latency changes; auth regressions immediately after deployment.\nRequirements: alert for abnormal 401 spikes; alert when login appears successful but no auth_token cookie is issued; define thresholds and recipients; avoid logging passwords/cookies/tokens/PII; add an operational dashboard or saved query; test the alert via a safe simulated failure; document response and escalation.\nDeliverable: working production alerts, dashboard evidence, configured recipients, and a short incident-response runbook. Incident reference: docs/INCIDENT_2026-06-21_seck_cookie_auth.md",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["shrinjayshresth@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-24",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 4000,
            subtasks: [],
            comments: [
              {
                authorEmail: "shrinjayshresth@gg.ai",
                body: "Shared the manuscript with Sagar, over to him to review and send me back the comments.",
                createdAt: "2026-06-25T07:12:56Z",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Provisional Patent — Filing & IP Strategy",
    description: "Provisional patent filing + IP strategy",
    sections: [
      {
        name: "Technical Disclosure (counsel needs this)",
        position: 1000,
        tasks: [
          {
            title: "Provide deployment/architecture technical specifics for the draft",
            description:
              "Counsel (Ramesh) specifically asked for the architecture diagrams and the technical specifics of HOW the pipeline is implemented — this supports the 'hardware-anchored technical improvement' argument that US law requires.\nWHAT TO PROVIDE: the fuller architecture diagrams (the high-level pipeline diagram on the call was too high-level per counsel), plus deployment specifics needed for enablement: the multi-stage pipeline, normalization, multi-source annotation lookups (gnomAD, ClinVar, AlphaMissense, VEP), the deterministic ACMG classifier, and the three-tier report layer.\nDELIVER TO: Faraz, for inclusion in the counsel package and upload to OneDrive -> Technical docs.\nDONE WHEN: architecture diagrams + technical specifics handed to Faraz, ready for the counsel package.",
            status: "TODO",
            priority: "HIGH",
            type: "TASK",
            assigneeEmails: ["sagar.gour@gg.ai"],
            labelNames: [],
            dueDate: "2026-06-30",
            completedAt: null,
            createdByEmail: "mohdsarfaraz@gg.ai",
            position: 1000,
            subtasks: [],
            comments: [],
          },
        ],
      },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  const workspace = await db.collection("workspaces").findOne({ _id: WS_ID });
  if (!workspace) {
    console.error("Workspace not found. Aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Workspace: "${workspace.name}" ✓`);

  // Resolve users
  const allEmails = [...new Set(
    PROJECTS.flatMap(p => p.sections.flatMap(s => s.tasks.flatMap(t => [
      ...t.assigneeEmails, t.createdByEmail,
      ...t.subtasks.flatMap(st => [...st.assigneeEmails, st.createdByEmail ?? ""]),
      ...t.comments.map(c => c.authorEmail),
      ...t.subtasks.flatMap(st => (st.comments ?? []).map(c => c.authorEmail)),
    ])))
  )].filter(Boolean);

  const userDocs = await db.collection("users").find({ email: { $in: allEmails } }).toArray();
  const userByEmail = new Map<string, Types.ObjectId>();
  for (const u of userDocs) userByEmail.set(u.email as string, u._id as Types.ObjectId);

  const missing = allEmails.filter(e => !userByEmail.has(e));
  if (missing.length) console.warn(`  ⚠ Not found (skipped): ${missing.join(", ")}`);

  const farazId = userByEmail.get("mohdsarfaraz@gg.ai") ?? WS_ID as unknown as Types.ObjectId;
  const uid = (...emails: string[]) => emails.flatMap(e => userByEmail.has(e) ? [userByEmail.get(e)!] : []);

  let projectsCreated = 0, sectionsCreated = 0;
  let tasksInserted = 0, tasksExisted = 0;
  let subtasksInserted = 0, commentsInserted = 0;

  for (const projDef of PROJECTS) {
    // Find or create project
    let project = await db.collection("projects").findOne({ workspaceId: WS_ID, name: projDef.name });
    if (!project) {
      const doc = {
        _id: oid(), workspaceId: WS_ID, name: projDef.name,
        description: projDef.description, key: null, color: null, icon: null,
        createdBy: farazId, archivedAt: null,
        statusColor: null, statusNote: null, statusUpdatedAt: null,
        createdAt: now, updatedAt: now,
      };
      await db.collection("projects").insertOne(doc);
      project = doc;
      projectsCreated++;
      console.log(`  Created project: "${projDef.name}"`);
    } else {
      console.log(`  Project exists:  "${projDef.name}"`);
    }
    const projectId = project._id as Types.ObjectId;

    for (const secDef of projDef.sections) {
      // Find or create section
      let section = await db.collection("sections").findOne({ workspaceId: WS_ID, projectId, name: secDef.name });
      if (!section) {
        const doc = {
          _id: oid(), workspaceId: WS_ID, projectId, name: secDef.name,
          position: secDef.position, createdAt: now, updatedAt: now,
        };
        await db.collection("sections").insertOne(doc);
        section = doc;
        sectionsCreated++;
      }
      const sectionId = section._id as Types.ObjectId;

      for (const t of secDef.tasks) {
        const createdById = userByEmail.get(t.createdByEmail) ?? farazId;
        const assigneeIds = uid(...t.assigneeEmails);

        const taskDoc = {
          _id: oid(), workspaceId: WS_ID, projectId, sectionId,
          parentTaskId: null, title: t.title,
          description: t.description ?? null,
          status: t.status, priority: t.priority, type: t.type,
          assigneeIds, labelIds: [],
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          startDate: t.startDate ? new Date(t.startDate) : null,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
          createdBy: createdById, updatedBy: createdById,
          isArchived: false, position: t.position,
          recurrenceRule: null, recurrenceParentId: null,
          createdAt: now, updatedAt: now, __v: 0,
        };

        const existing = await db.collection("tasks").findOne({ workspaceId: WS_ID, projectId, title: t.title });
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
          const subCreatedById = (sub.createdByEmail && userByEmail.get(sub.createdByEmail)) ?? createdById;
          const subAssignees = uid(...sub.assigneeEmails);
          const subExists = await db.collection("tasks").findOne({ workspaceId: WS_ID, parentTaskId: taskId, title: sub.title });
          let subtaskId: Types.ObjectId;
          if (!subExists) {
            const subDoc = {
              _id: oid(), workspaceId: WS_ID, projectId, sectionId,
              parentTaskId: taskId, title: sub.title,
              description: sub.description ?? null,
              status: sub.status, priority: sub.priority,
              type: sub.type ?? "TASK",
              assigneeIds: subAssignees, labelIds: [],
              dueDate: sub.dueDate ? new Date(sub.dueDate) : null,
              startDate: null,
              completedAt: sub.completedAt ? new Date(sub.completedAt) : null,
              createdBy: subCreatedById, updatedBy: subCreatedById,
              isArchived: false, position: (si + 1) * 1000,
              recurrenceRule: null, recurrenceParentId: null,
              createdAt: now, updatedAt: now, __v: 0,
            };
            await db.collection("tasks").insertOne(subDoc);
            subtaskId = subDoc._id;
            subtasksInserted++;
          } else {
            subtaskId = subExists._id as Types.ObjectId;
          }

          // Subtask comments
          const subComments = sub.comments ?? [];
          if (subComments.length > 0) {
            const subCommentCount = await db.collection("comments").countDocuments({ taskId: subtaskId });
            if (subCommentCount === 0) {
              const docs = subComments.map((c, ci) => ({
                _id: oid(), workspaceId: WS_ID, projectId, taskId: subtaskId,
                authorId: userByEmail.get(c.authorEmail) ?? farazId,
                body: c.body, mentionedUserIds: [], parentCommentId: null, deletedAt: null,
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(now.getTime() + ci * 1000),
                updatedAt: c.createdAt ? new Date(c.createdAt) : new Date(now.getTime() + ci * 1000),
              }));
              await db.collection("comments").insertMany(docs);
              commentsInserted += docs.length;
            }
          }
        }

        // Task comments
        if (t.comments.length > 0) {
          const commentCount = await db.collection("comments").countDocuments({ taskId });
          if (commentCount === 0) {
            const docs = t.comments.map((c, ci) => ({
              _id: oid(), workspaceId: WS_ID, projectId, taskId,
              authorId: userByEmail.get(c.authorEmail) ?? farazId,
              body: c.body, mentionedUserIds: [], parentCommentId: null, deletedAt: null,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(now.getTime() + ci * 1000),
              updatedAt: c.createdAt ? new Date(c.createdAt) : new Date(now.getTime() + ci * 1000),
            }));
            await db.collection("comments").insertMany(docs);
            commentsInserted += docs.length;
          }
        }
      }
    }
  }

  console.log(`\nDone:`);
  console.log(`  Projects : ${projectsCreated} created`);
  console.log(`  Sections : ${sectionsCreated} created`);
  console.log(`  Tasks    : ${tasksInserted} inserted, ${tasksExisted} already existed`);
  console.log(`  Subtasks : ${subtasksInserted} inserted`);
  console.log(`  Comments : ${commentsInserted} inserted`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
