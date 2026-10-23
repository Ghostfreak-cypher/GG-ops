export const DRAFT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
