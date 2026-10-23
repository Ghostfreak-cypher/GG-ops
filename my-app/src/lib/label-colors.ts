/**
 * Shared label/"workstream" color constants. Dependency-free so it can be
 * imported by client components, server actions, and standalone scripts alike.
 */

/** Hex swatches offered when creating a new workstream. */
export const LABEL_COLORS = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#22c55e", // green
  "#eab308", // yellow
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#d946ef", // fuchsia
  "#a855f7", // purple
  "#6b7280", // gray
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/**
 * Default workstreams seeded into every new workspace (and backfillable into
 * existing ones via `scripts/seed-labels.ts`).
 */
export const DEFAULT_WORKSTREAMS: { name: string; color: string }[] = [
  { name: "Core Engineering", color: "#6366f1" },
  { name: "Data/Genomics Analysis", color: "#14b8a6" },
  { name: "Quality & Testing", color: "#22c55e" },
  { name: "Research & Publications", color: "#d946ef" },
  { name: "Grants & Funding", color: "#f59e0b" },
  { name: "Business Development / Partnerships", color: "#ec4899" },
  { name: "Operations / Misc", color: "#6b7280" },
];
