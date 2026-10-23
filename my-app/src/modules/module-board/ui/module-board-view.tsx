"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, fieldClass } from "@/components/ui/select";
import {
  MODULE_BOARD_SECTION_LABELS,
  MODULE_BOARD_STATUSES,
  MODULE_BOARD_STATUS_UI,
  type ModuleBoardCardSection,
  type ModuleBoardStatus,
  type ModuleBoardStructuredSection,
} from "@/modules/module-board/constants";
import { isPatentModuleKey } from "@/modules/module-board/logic";
import {
  updateModuleBoardCardAction,
  updateModuleBoardModuleAction,
  updateModuleBoardStructuredRowAction,
} from "@/modules/module-board/server/actions";
import type {
  ModuleBoardCardDTO,
  ModuleBoardDTO,
  ModuleBoardLinkRef,
  ModuleBoardMembersOption,
  ModuleBoardModuleDTO,
  ModuleBoardStructuredRowDTO,
  ModuleBoardTaskRef,
} from "@/modules/module-board/server/dto";
import { searchWorkspaceTasksForPickerAction } from "@/modules/task/server/actions/search-tasks-for-picker";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import { cn } from "@/lib/utils";

type ModuleBoardViewProps = {
  board: ModuleBoardDTO;
  members: ModuleBoardMembersOption[];
  workspaceSlug: string;
  canEdit: boolean;
  viewerRole: WorkspaceRole;
};

type EditableProofBundle = {
  id: string;
  status: ModuleBoardStatus;
  whatVerified: string;
  proof: string;
  taskIdsText: string;
  externalUrlsText: string;
  evidenceLinksText: string;
};

export function ModuleBoardView({
  board,
  members,
  workspaceSlug,
  canEdit,
  viewerRole,
}: ModuleBoardViewProps) {
  const patentModules = board.modules.filter((row) => isPatentModuleKey(row.moduleKey));
  const supportTracks = board.modules.filter((row) => !isPatentModuleKey(row.moduleKey));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-[4px]">
          <CardHeader className="gap-3 border-b-[3px] border-border bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge
                  variant={board.sundayWarningCount > 0 ? "warning" : "success"}
                  className="w-fit"
                >
                  {board.sundayWarningCount > 0
                    ? `${board.sundayWarningCount} Sunday readiness gaps`
                    : "Sunday-ready at a glance"}
                </Badge>
                <div>
                  <h1 className="font-display text-2xl uppercase tracking-wide">
                    GG Module Board
                  </h1>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    The readable source of truth for module status, finish lines, pilot
                    movement, spend discipline, and proof links. This page does not replace the
                    task board; it points to it.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm">
                <p className="font-medium">Board freshness</p>
                <p className="text-muted-foreground">
                  {board.lastUpdatedBy?.name ?? "Unknown"} · {formatTimestamp(board.lastUpdatedAt)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Editable by all workspace members. Current role: {viewerRole}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
            <SummaryStat
              icon={<ShieldCheck className="size-4" />}
              label="Modules tracked"
              value={String(patentModules.length)}
              tone="neutral"
            />
            <SummaryStat
              icon={<CheckCircle2 className="size-4" />}
              label="Working or validating"
              value={String(
                patentModules.filter(
                  (row) => row.status === "WORKING" || row.status === "VALIDATING",
                ).length,
              )}
              tone="good"
            />
            <SummaryStat
              icon={<AlertTriangle className="size-4" />}
              label="Rows needing honesty or proof"
              value={String(board.sundayWarningCount)}
              tone={board.sundayWarningCount > 0 ? "warn" : "good"}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <BoardCardSection
            title={MODULE_BOARD_SECTION_LABELS.finishLines}
            cards={board.finishLines}
            canEdit={canEdit}
            workspaceSlug={workspaceSlug}
            section="finishLines"
          />
          <BoardCardSection
            title={MODULE_BOARD_SECTION_LABELS.masterGate}
            cards={board.masterGate}
            canEdit={canEdit}
            workspaceSlug={workspaceSlug}
            section="masterGate"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={MODULE_BOARD_SECTION_LABELS.modules}
          subtitle="Each module row holds the owner, separate validator, honest status language, and the linked proof trail."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {patentModules.map((row) => (
            <ModuleRowCard
              key={`${row.id}-${row.updatedAt ?? "new"}`}
              row={row}
              members={members}
              workspaceSlug={workspaceSlug}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Support Tracks"
          subtitle="Coordinates and BioNeMo use the same owner/validator tracking as modules, but aren't counted in the patent-module stats above."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {supportTracks.map((row) => (
            <ModuleRowCard
              key={`${row.id}-${row.updatedAt ?? "new"}`}
              row={row}
              members={members}
              workspaceSlug={workspaceSlug}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BoardStructuredSection
          title={MODULE_BOARD_SECTION_LABELS.pilotRoadmap}
          rows={board.pilotRoadmap}
          canEdit={canEdit}
          members={members}
          workspaceSlug={workspaceSlug}
          section="pilotRoadmap"
        />
        <BoardStructuredSection
          title={MODULE_BOARD_SECTION_LABELS.openItems}
          rows={board.openItems}
          canEdit={canEdit}
          members={members}
          workspaceSlug={workspaceSlug}
          section="openItems"
        />
        <BoardStructuredSection
          title={MODULE_BOARD_SECTION_LABELS.outreachPipeline}
          rows={board.outreachPipeline}
          canEdit={canEdit}
          members={members}
          workspaceSlug={workspaceSlug}
          section="outreachPipeline"
        />
        <BoardStructuredSection
          title={MODULE_BOARD_SECTION_LABELS.spendDiscipline}
          rows={board.spendDiscipline}
          canEdit={canEdit}
          members={members}
          workspaceSlug={workspaceSlug}
          section="spendDiscipline"
        />
        <BoardStructuredSection
          title={MODULE_BOARD_SECTION_LABELS.loadFlags}
          rows={board.loadFlags}
          canEdit={canEdit}
          members={members}
          workspaceSlug={workspaceSlug}
          section="loadFlags"
        />
        <BoardCardSection
          title={MODULE_BOARD_SECTION_LABELS.scopeHolds}
          cards={board.scopeHolds}
          canEdit={canEdit}
          workspaceSlug={workspaceSlug}
          section="scopeHolds"
        />
      </section>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "warn"
          ? "border-[#f59e0b]/50 bg-[#fffbeb]"
          : tone === "good"
            ? "border-[#22c55e]/30 bg-[#f0fdf4]"
            : "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 font-display text-3xl">{value}</p>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function BoardCardSection({
  title,
  cards,
  canEdit,
  workspaceSlug,
  section,
}: {
  title: string;
  cards: ModuleBoardCardDTO[];
  canEdit: boolean;
  workspaceSlug: string;
  section: ModuleBoardCardSection;
}) {
  return (
    <Card>
      <CardHeader className="border-b-[3px] border-border bg-muted/20">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {cards.map((card) => (
          <BoardCardEditor
            key={`${card.id}-${card.updatedAt ?? "new"}`}
            card={card}
            section={section}
            workspaceSlug={workspaceSlug}
            canEdit={canEdit}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function BoardCardEditor({
  card,
  section,
  workspaceSlug,
  canEdit,
}: {
  card: ModuleBoardCardDTO;
  section: ModuleBoardCardSection;
  workspaceSlug: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = React.useState(card.title);
  const [note, setNote] = React.useState(card.note);
  const [status, setStatus] = React.useState<ModuleBoardStatus>(card.status);

  async function onSave() {
    start(async () => {
      const result = await updateModuleBoardCardAction(workspaceSlug, section, card.id, {
        title,
        note,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Board card updated");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Badge className={MODULE_BOARD_STATUS_UI[card.status].badge}>
            {MODULE_BOARD_STATUS_UI[card.status].label}
          </Badge>
          <div>
            <h3 className="font-medium">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.note || "No note yet."}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {card.updatedBy?.name ?? "Unknown"} · {formatTimestamp(card.updatedAt)}
          </p>
        </div>
        {canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close" : "Edit"}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Select value={status} onChange={(event) => setStatus(event.target.value as ModuleBoardStatus)}>
            {MODULE_BOARD_STATUSES.map((item) => (
              <option key={item} value={item}>
                {MODULE_BOARD_STATUS_UI[item].label}
              </option>
            ))}
          </Select>
          <TextArea value={note} onChange={setNote} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={pending || !title.trim()}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BoardStructuredSection({
  title,
  rows,
  canEdit,
  members,
  workspaceSlug,
  section,
}: {
  title: string;
  rows: ModuleBoardStructuredRowDTO[];
  canEdit: boolean;
  members: ModuleBoardMembersOption[];
  workspaceSlug: string;
  section: ModuleBoardStructuredSection;
}) {
  return (
    <Card>
      <CardHeader className="border-b-[3px] border-border bg-muted/20">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {rows.map((row) => (
          <StructuredRowCard
            key={`${row.id}-${row.updatedAt ?? "new"}`}
            row={row}
            members={members}
            workspaceSlug={workspaceSlug}
            canEdit={canEdit}
            section={section}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function StructuredRowCard({
  row,
  members,
  workspaceSlug,
  canEdit,
  section,
}: {
  row: ModuleBoardStructuredRowDTO;
  members: ModuleBoardMembersOption[];
  workspaceSlug: string;
  canEdit: boolean;
  section: ModuleBoardStructuredSection;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = React.useState(row.title);
  const [ownerUserId, setOwnerUserId] = React.useState(row.owner?.userId ?? "");
  const [status, setStatus] = React.useState<ModuleBoardStatus>(row.status);
  const [note, setNote] = React.useState(row.note);
  const [linkedTasks, setLinkedTasks] = React.useState(row.linkedTasks);
  const [externalUrlsText, setExternalUrlsText] = React.useState(linksToText(row.externalUrls));

  async function onSave() {
    start(async () => {
      const result = await updateModuleBoardStructuredRowAction(workspaceSlug, section, row.id, {
        title,
        ownerUserId: ownerUserId || null,
        status,
        note,
        taskIds: linkedTasks.map((task) => task.id),
        externalUrls: textToLinks(externalUrlsText),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Board row updated");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={MODULE_BOARD_STATUS_UI[row.status].badge}>
              {MODULE_BOARD_STATUS_UI[row.status].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Owner: {row.owner?.name ?? "Unassigned"}
            </span>
          </div>
          <div>
            <h3 className="font-medium">{row.title}</h3>
            <p className="text-sm text-muted-foreground">{row.note || "No note yet."}</p>
          </div>
          <ModuleBoardLinks
            tasks={row.linkedTasks}
            externalUrls={row.externalUrls}
            emptyTaskLabel="No linked tasks."
            emptyLinkLabel="No linked URLs."
          />
          <p className="text-xs text-muted-foreground">
            {row.updatedBy?.name ?? "Unknown"} · {formatTimestamp(row.updatedAt)}
          </p>
        </div>
        {canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close" : "Edit"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(event) => setStatus(event.target.value as ModuleBoardStatus)}>
              {MODULE_BOARD_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {MODULE_BOARD_STATUS_UI[item].label}
                </option>
              ))}
            </Select>
          </div>
          <TextArea value={note} onChange={setNote} placeholder="Current note" />
          <TaskLinkPicker
            workspaceSlug={workspaceSlug}
            label="Linked tasks"
            tasks={linkedTasks}
            onChange={setLinkedTasks}
          />
          <TextBlockField
            label="Outbound links"
            value={externalUrlsText}
            onChange={setExternalUrlsText}
            placeholder="One URL per line, or label | https://example.com"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={pending || !title.trim()}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModuleRowCard({
  row,
  members,
  workspaceSlug,
  canEdit,
}: {
  row: ModuleBoardModuleDTO;
  members: ModuleBoardMembersOption[];
  workspaceSlug: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = useTransition();
  const [ownerUserId, setOwnerUserId] = React.useState(row.owner?.userId ?? "");
  const [validatorUserId, setValidatorUserId] = React.useState(row.validator?.userId ?? "");
  const [status, setStatus] = React.useState<ModuleBoardStatus>(row.status);
  const [summary, setSummary] = React.useState(row.summary);
  const [whatClosesIt, setWhatClosesIt] = React.useState(row.whatClosesIt);
  const [verificationSummary, setVerificationSummary] = React.useState(row.verificationSummary);
  const [validatingReason, setValidatingReason] = React.useState(row.validatingReason);
  const [blockerReason, setBlockerReason] = React.useState(row.blockerReason);
  const [linkedTasks, setLinkedTasks] = React.useState(row.linkedTasks);
  const [prUrlsText, setPrUrlsText] = React.useState(linksToText(row.prUrls));
  const [proofBundles, setProofBundles] = React.useState<EditableProofBundle[]>(
    row.proofBundles.map(toEditableProofBundle),
  );

  const editingWarnings = [
    ...((status === "WORKING" || status === "VALIDATING") && !validatorUserId
      ? ["Add a validator before using a working or validating state."]
      : []),
    ...((status === "WORKING" || status === "VALIDATING") && !verificationSummary.trim()
      ? ["Add a verification summary before using a working or validating state."]
      : []),
    ...(status === "WORKING" &&
    proofBundles.every(
      (bundle) =>
        !bundle.proof.trim() &&
        !bundle.whatVerified.trim() &&
        !bundle.taskIdsText.trim() &&
        !bundle.externalUrlsText.trim() &&
        !bundle.evidenceLinksText.trim(),
    )
      ? ["Working rows should carry at least one proof bundle."]
      : []),
    ...(status === "VALIDATING" && !validatingReason.trim()
      ? ["Validating rows should explain what is still being checked."]
      : []),
  ];

  async function onSave() {
    start(async () => {
      const result = await updateModuleBoardModuleAction(workspaceSlug, row.id, {
        ownerUserId: ownerUserId || null,
        validatorUserId: validatorUserId || null,
        status,
        summary,
        whatClosesIt,
        verificationSummary,
        validatingReason,
        blockerReason,
        taskIds: linkedTasks.map((task) => task.id),
        prUrls: textToLinks(prUrlsText),
        proofBundles: proofBundles.map((bundle) => ({
          id: bundle.id,
          status: bundle.status,
          whatVerified: bundle.whatVerified,
          proof: bundle.proof,
          taskIds: textToLines(bundle.taskIdsText),
          externalUrls: textToLinks(bundle.externalUrlsText),
          evidenceLinks: textToLinks(bundle.evidenceLinksText),
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.moduleKey} updated`);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card className={cn("overflow-hidden", row.warnings.length > 0 && "border-[#f59e0b]")}>
      <CardHeader
        className={cn(
          "border-b-[3px] border-border",
          MODULE_BOARD_STATUS_UI[row.status].panel,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={MODULE_BOARD_STATUS_UI[row.status].badge}>
                {MODULE_BOARD_STATUS_UI[row.status].label}
              </Badge>
              <Badge variant="outline">{row.moduleKey}</Badge>
              {row.warnings.length > 0 ? (
                <Badge variant="warning">
                  {row.warnings.length} warning{row.warnings.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <div>
              <CardTitle
                className={cn(
                  "text-base tracking-wide",
                  MODULE_BOARD_STATUS_UI[row.status].panelTitle,
                )}
              >
                {row.title}
              </CardTitle>
              <p className={cn("mt-1 text-sm", MODULE_BOARD_STATUS_UI[row.status].panelSubtle)}>
                Owner: {row.owner?.name ?? "Unassigned"} · Validator:{" "}
                {row.validator?.name ?? "Unassigned"}
              </p>
            </div>
          </div>
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className={MODULE_BOARD_STATUS_UI[row.status].panelTitle}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Close" : "Edit"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <InfoBlock label="Board summary" value={row.summary} />
        <InfoBlock label="What closes it" value={row.whatClosesIt} />
        <InfoBlock label="Verification summary" value={row.verificationSummary} />
        {row.status === "VALIDATING" ? (
          <InfoBlock label="Why it's validating" value={row.validatingReason} />
        ) : null}
        {row.status === "BLOCKED" ? (
          <InfoBlock label="Blocker reason" value={row.blockerReason} />
        ) : null}

        {row.warnings.length > 0 ? (
          <div className="rounded-xl border border-[#f59e0b]/50 bg-[#fffbeb] p-3 text-sm">
            <p className="font-medium text-[#b45309]">Sunday readiness warnings</p>
            <ul className="mt-2 space-y-1 text-[#92400e]">
              {row.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ModuleBoardLinks
          tasks={row.linkedTasks}
          externalUrls={row.prUrls}
          emptyTaskLabel="No linked tasks."
          emptyLinkLabel="No PR links yet."
          externalHeading="PRs and external proof"
        />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proof bundles
          </p>
          {row.proofBundles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proof bundles yet.</p>
          ) : (
            row.proofBundles.map((bundle) => (
              <div key={bundle.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={MODULE_BOARD_STATUS_UI[bundle.status].badge}>
                    {MODULE_BOARD_STATUS_UI[bundle.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {bundle.updatedBy?.name ?? "Unknown"} · {formatTimestamp(bundle.updatedAt)}
                  </span>
                </div>
                <InfoBlock label="What they verified" value={bundle.whatVerified} compact />
                <InfoBlock label="Proof" value={bundle.proof} compact />
                <ModuleBoardLinks
                  tasks={bundle.taskLinks}
                  externalUrls={[...bundle.externalUrls, ...bundle.evidenceLinks]}
                  emptyTaskLabel="No linked tasks."
                  emptyLinkLabel="No evidence links."
                  externalHeading="Proof links"
                />
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {row.updatedBy?.name ?? "Unknown"} · {formatTimestamp(row.updatedAt)}
        </p>

        {editing ? (
          <div className="space-y-4 border-t border-border/60 pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
                <option value="">Owner</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <Select
                value={validatorUserId}
                onChange={(event) => setValidatorUserId(event.target.value)}
              >
                <option value="">Validator</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value as ModuleBoardStatus)}>
                {MODULE_BOARD_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {MODULE_BOARD_STATUS_UI[item].label}
                  </option>
                ))}
              </Select>
            </div>

            {editingWarnings.length > 0 ? (
              <div className="rounded-xl border border-[#f59e0b]/50 bg-[#fffbeb] p-3 text-sm text-[#92400e]">
                {editingWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <TextBlockField label="Board summary" value={summary} onChange={setSummary} />
            <TextBlockField
              label="What closes it"
              value={whatClosesIt}
              onChange={setWhatClosesIt}
            />
            <TextBlockField
              label="Verification summary"
              value={verificationSummary}
              onChange={setVerificationSummary}
            />
            <TextBlockField
              label="Validating reason"
              value={validatingReason}
              onChange={setValidatingReason}
            />
            <TextBlockField
              label="Blocker reason"
              value={blockerReason}
              onChange={setBlockerReason}
            />

            <TaskLinkPicker
              workspaceSlug={workspaceSlug}
              label="Linked tasks"
              tasks={linkedTasks}
              onChange={setLinkedTasks}
            />

            <TextBlockField
              label="PR and external URLs"
              value={prUrlsText}
              onChange={setPrUrlsText}
              placeholder="One URL per line, or label | https://example.com"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Proof bundles</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setProofBundles((bundles) => [
                      ...bundles,
                      {
                        id: crypto.randomUUID(),
                        status: "UNSET",
                        whatVerified: "",
                        proof: "",
                        taskIdsText: "",
                        externalUrlsText: "",
                        evidenceLinksText: "",
                      },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  Add proof bundle
                </Button>
              </div>
              {proofBundles.map((bundle, index) => (
                <ProofBundleEditor
                  key={bundle.id}
                  bundle={bundle}
                  onChange={(next) =>
                    setProofBundles((bundles) =>
                      bundles.map((current) => (current.id === bundle.id ? next : current)),
                    )
                  }
                  onRemove={() =>
                    setProofBundles((bundles) =>
                      bundles.filter((current) => current.id !== bundle.id),
                    )
                  }
                  index={index}
                />
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_ACCEPT =
  "image/*,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip";

function ProofBundleEditor({
  bundle,
  onChange,
  onRemove,
  index,
}: {
  bundle: EditableProofBundle;
  onChange: (bundle: EditableProofBundle) => void;
  onRemove: () => void;
  index: number;
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFilesSelected(files: FileList) {
    const toUpload = Array.from(files);
    setUploading(true);
    try {
      const uploadedLines: string[] = [];
      for (const file of toUpload) {
        if (file.size > UPLOAD_MAX_BYTES) {
          toast.error(`${file.name} exceeds the 25 MB limit.`);
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(json.error ?? `Failed to upload ${file.name}`);
          continue;
        }
        const { data } = (await res.json()) as { data: { fileUrl: string; fileName: string } };
        uploadedLines.push(`${data.fileName} | ${data.fileUrl}`);
      }
      if (uploadedLines.length > 0) {
        const nextText = [bundle.evidenceLinksText, ...uploadedLines]
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n");
        onChange({ ...bundle, evidenceLinksText: nextText });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Proof bundle {index + 1}</p>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <Select
          value={bundle.status}
          onChange={(event) =>
            onChange({ ...bundle, status: event.target.value as ModuleBoardStatus })
          }
        >
          {MODULE_BOARD_STATUSES.map((item) => (
            <option key={item} value={item}>
              {MODULE_BOARD_STATUS_UI[item].label}
            </option>
          ))}
        </Select>
        <TextBlockField
          label="What they verified"
          value={bundle.whatVerified}
          onChange={(value) => onChange({ ...bundle, whatVerified: value })}
        />
        <TextBlockField
          label="Proof"
          value={bundle.proof}
          onChange={(value) => onChange({ ...bundle, proof: value })}
        />
        <TextBlockField
          label="Task IDs"
          value={bundle.taskIdsText}
          onChange={(value) => onChange({ ...bundle, taskIdsText: value })}
          placeholder="One task ID per line"
        />
        <TextBlockField
          label="External proof links"
          value={bundle.externalUrlsText}
          onChange={(value) => onChange({ ...bundle, externalUrlsText: value })}
          placeholder="One URL per line, or label | https://example.com"
        />
        <TextBlockField
          label="Evidence links"
          value={bundle.evidenceLinksText}
          onChange={(value) => onChange({ ...bundle, evidenceLinksText: value })}
          placeholder="One URL per line, or label | https://example.com"
        />
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Paperclip className="size-3.5" />
            )}
            Upload file (PDF, image, etc.)
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) void handleFilesSelected(event.target.files);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ModuleBoardLinks({
  tasks,
  externalUrls,
  emptyTaskLabel,
  emptyLinkLabel,
  externalHeading = "External links",
}: {
  tasks: ModuleBoardTaskRef[];
  externalUrls: ModuleBoardLinkRef[];
  emptyTaskLabel: string;
  emptyLinkLabel: string;
  externalHeading?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked tasks
        </p>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyTaskLabel}</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
              >
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{task.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {task.projectName}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {externalHeading}
        </p>
        {externalUrls.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLinkLabel}</p>
        ) : (
          <div className="space-y-1.5">
            {externalUrls.map((link) => (
              <a
                key={`${link.url}-${link.label}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
              >
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskLinkPicker({
  workspaceSlug,
  label,
  tasks,
  onChange,
}: {
  workspaceSlug: string;
  label: string;
  tasks: ModuleBoardTaskRef[];
  onChange: (tasks: ModuleBoardTaskRef[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ModuleBoardTaskRef[]>([]);
  const [searching, setSearching] = React.useState(false);

  async function runSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const found = await searchWorkspaceTasksForPickerAction(workspaceSlug, nextQuery);
      const selectedIds = new Set(tasks.map((task) => task.id));
      setResults(
        found
          .filter((task) => !selectedIds.has(task.id))
          .map((task) => ({
            ...task,
            href: `/w/${workspaceSlug}/projects/${task.projectId}/tasks/${task.id}`,
          })),
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked tasks.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
            >
              <Link href={task.href} className="hover:text-primary">
                {task.title}
              </Link>
              <span className="text-muted-foreground">{task.projectName}</span>
              <button
                type="button"
                onClick={() => onChange(tasks.filter((current) => current.id !== task.id))}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <Input
        value={query}
        onChange={(event) => void runSearch(event.target.value)}
        placeholder="Search tasks to link..."
      />
      {searching ? <p className="text-xs text-muted-foreground">Searching tasks...</p> : null}
      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks found.</p>
      ) : null}
      {!searching && results.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/60">
          {results.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                onChange([...tasks, task]);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{task.title}</p>
                <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>
              </div>
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function TextBlockField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <TextArea value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      placeholder={placeholder}
      className={cn(fieldClass, "w-full px-3 py-2")}
    />
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function linksToText(links: ModuleBoardLinkRef[]) {
  return links
    .map((link) => (link.label && link.label !== link.url ? `${link.label} | ${link.url}` : link.url))
    .join("\n");
}

function textToLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function textToLinks(value: string): ModuleBoardLinkRef[] {
  return textToLines(value).map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    const url = parts.length > 1 ? parts[parts.length - 1] : line.trim();
    const label = parts.length > 1 ? parts.slice(0, -1).join(" | ") : url;
    return { label: label || url, url };
  });
}

function toEditableProofBundle(
  bundle: ModuleBoardModuleDTO["proofBundles"][number],
): EditableProofBundle {
  return {
    id: bundle.id,
    status: bundle.status,
    whatVerified: bundle.whatVerified,
    proof: bundle.proof,
    taskIdsText: bundle.taskLinks.map((task) => task.id).join("\n"),
    externalUrlsText: linksToText(bundle.externalUrls),
    evidenceLinksText: linksToText(bundle.evidenceLinks),
  };
}
