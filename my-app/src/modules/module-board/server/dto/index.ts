import type { ModuleBoardStatus } from "@/modules/module-board/constants";

export type ModuleBoardUserRef = {
  userId: string;
  name: string;
  image: string | null;
};

export type ModuleBoardTaskRef = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  href: string;
};

export type ModuleBoardLinkRef = {
  label: string;
  url: string;
};

export type ModuleBoardProofBundleDTO = {
  id: string;
  status: ModuleBoardStatus;
  whatVerified: string;
  proof: string;
  taskLinks: ModuleBoardTaskRef[];
  externalUrls: ModuleBoardLinkRef[];
  evidenceLinks: ModuleBoardLinkRef[];
  updatedBy: ModuleBoardUserRef | null;
  updatedAt: string | null;
};

export type ModuleBoardModuleDTO = {
  id: string;
  moduleKey: string;
  title: string;
  owner: ModuleBoardUserRef | null;
  validator: ModuleBoardUserRef | null;
  status: ModuleBoardStatus;
  summary: string;
  whatClosesIt: string;
  verificationSummary: string;
  validatingReason: string;
  blockerReason: string;
  linkedTasks: ModuleBoardTaskRef[];
  prUrls: ModuleBoardLinkRef[];
  proofBundles: ModuleBoardProofBundleDTO[];
  updatedBy: ModuleBoardUserRef | null;
  updatedAt: string | null;
  warnings: string[];
};

export type ModuleBoardStructuredRowDTO = {
  id: string;
  title: string;
  owner: ModuleBoardUserRef | null;
  status: ModuleBoardStatus;
  note: string;
  linkedTasks: ModuleBoardTaskRef[];
  externalUrls: ModuleBoardLinkRef[];
  updatedBy: ModuleBoardUserRef | null;
  updatedAt: string | null;
};

export type ModuleBoardCardDTO = {
  id: string;
  title: string;
  note: string;
  status: ModuleBoardStatus;
  updatedBy: ModuleBoardUserRef | null;
  updatedAt: string | null;
};

export type ModuleBoardDTO = {
  id: string;
  workspaceId: string;
  finishLines: ModuleBoardCardDTO[];
  masterGate: ModuleBoardCardDTO[];
  modules: ModuleBoardModuleDTO[];
  pilotRoadmap: ModuleBoardStructuredRowDTO[];
  openItems: ModuleBoardStructuredRowDTO[];
  outreachPipeline: ModuleBoardStructuredRowDTO[];
  spendDiscipline: ModuleBoardStructuredRowDTO[];
  loadFlags: ModuleBoardStructuredRowDTO[];
  scopeHolds: ModuleBoardCardDTO[];
  lastUpdatedBy: ModuleBoardUserRef | null;
  lastUpdatedAt: string | null;
  sundayWarningCount: number;
};

export type ModuleBoardMembersOption = {
  userId: string;
  name: string;
  image: string | null;
  role: string;
};
