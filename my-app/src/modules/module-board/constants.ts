export const MODULE_BOARD_STATUSES = [
  "UNSET",
  "WORKING",
  "VALIDATING",
  "BLOCKED",
  "HOLD",
] as const;

export type ModuleBoardStatus = (typeof MODULE_BOARD_STATUSES)[number];

export const MODULE_BOARD_WORKING_LIKE_STATUSES: ModuleBoardStatus[] = [
  "WORKING",
  "VALIDATING",
] as const;

export const MODULE_BOARD_STATUS_UI: Record<
  ModuleBoardStatus,
  {
    label: string;
    badge: string;
    dot: string;
    panel: string;
    panelTitle: string;
    panelSubtle: string;
  }
> = {
  UNSET: {
    label: "Unset",
    badge: "border-border bg-background text-foreground",
    dot: "bg-muted-foreground",
    panel: "border-border/60 bg-card",
    panelTitle: "text-card-foreground",
    panelSubtle: "text-muted-foreground",
  },
  WORKING: {
    label: "Working",
    badge: "border-[#2563eb] bg-[#dbeafe] text-[#1d4ed8]",
    dot: "bg-[#2563eb]",
    panel: "border-[#93c5fd] bg-[#eff6ff]",
    panelTitle: "text-[#1e3a8a]",
    panelSubtle: "text-[#1d4ed8]",
  },
  VALIDATING: {
    label: "Validating",
    badge: "border-[#f59e0b] bg-[#fef3c7] text-[#b45309]",
    dot: "bg-[#f59e0b]",
    panel: "border-[#fcd34d] bg-[#fffbeb]",
    panelTitle: "text-[#78350f]",
    panelSubtle: "text-[#92400e]",
  },
  BLOCKED: {
    label: "Blocked",
    badge: "border-[#dc2626] bg-[#fee2e2] text-[#b91c1c]",
    dot: "bg-[#dc2626]",
    panel: "border-[#fca5a5] bg-[#fef2f2]",
    panelTitle: "text-[#7f1d1d]",
    panelSubtle: "text-[#b91c1c]",
  },
  HOLD: {
    label: "Hold",
    badge: "border-[#7c3aed] bg-[#ede9fe] text-[#6d28d9]",
    dot: "bg-[#7c3aed]",
    panel: "border-[#c4b5fd] bg-[#f5f3ff]",
    panelTitle: "text-[#4c1d95]",
    panelSubtle: "text-[#6d28d9]",
  },
};

export const MODULE_BOARD_STRUCTURED_SECTIONS = [
  "pilotRoadmap",
  "openItems",
  "outreachPipeline",
  "spendDiscipline",
  "loadFlags",
] as const;

export type ModuleBoardStructuredSection = (typeof MODULE_BOARD_STRUCTURED_SECTIONS)[number];

export const MODULE_BOARD_CARD_SECTIONS = [
  "finishLines",
  "masterGate",
  "scopeHolds",
] as const;

export type ModuleBoardCardSection = (typeof MODULE_BOARD_CARD_SECTIONS)[number];

export const MODULE_BOARD_SECTION_LABELS: Record<
  ModuleBoardStructuredSection | ModuleBoardCardSection | "modules",
  string
> = {
  finishLines: "Finish Lines",
  masterGate: "Master Gate",
  modules: "Modules",
  pilotRoadmap: "Pilot Roadmap",
  openItems: "Open Items",
  outreachPipeline: "Outreach Pipeline",
  spendDiscipline: "Spend Discipline",
  loadFlags: "Load Flags",
  scopeHolds: "Scope Holds",
};
