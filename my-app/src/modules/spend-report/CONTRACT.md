# Spend Report — UI contract

This foundation wave ships the model, calc, DTO, and access gate. Three agents build UI on
top of it in parallel; this doc is the seam so their pieces fit together without touching
each other's files.

## What's already built (import these, don't redefine them)

- `src/models/SpendReport.ts` — `SpendReport` model, `SpendReportDoc` type.
- `src/modules/spend-report/schemas.ts` — `spendReportInputSchema`, `SpendReportInput`,
  `spendServiceSchema`, `SpendServiceInput`. Validate every write with this.
- `src/modules/spend-report/calc.ts` — `computeDerived(report, prior, ctx)` → `DerivedMetrics`.
  Pure, fully unit-tested. `prior` is the most recent report before this one's `date`, or
  `null`. `ctx: MonthContext` (today/daysElapsed/daysInMonth/daysRemaining/daysToCreditExpiry)
  is computed by the caller (server action/query), not by this module.
- `src/modules/spend-report/server/dto/index.ts` — `SpendReportDTO`, `toSpendReportDTO(doc, derived)`.
  This is what every UI component below renders. All money is `number`, all dates/timestamps
  are ISO strings, all Mongo ids are strings. `derived: DerivedMetrics` is embedded on the DTO.
  **Every projected/forecast field in `derived` is a run-rate forecast** — label it
  `projected (run-rate)` in the UI (`allowedDailyBurn`, `runwayDays`, `projectedExhaustionDate`,
  `projectedMonthEndGross`, `projectedMonthEndNet`).
- `src/modules/spend-report/access.ts` — `requireFinanceWorkspace()` (call at the top of every
  spend-report page/action/query — resolves the finance workspace + verifies ACTIVE membership,
  or `notFound()`s), `canEditSpendReport` (always true for members), `canDeleteSpendReport`
  (MAINTAINER only).
- `src/app/(dashboard)/w/[workspaceSlug]/spend/layout.tsx` — calls `requireFinanceWorkspace()`,
  renders the Reports/Trends sub-nav, guards the URL's `workspaceSlug` against the real finance
  workspace slug. Your pages render inside this as `children`.
- Sidebar: "Spend Report" link appears only when the current workspace slug equals
  `FINANCE_WORKSPACE_SLUG` — nothing further needed here.

## What each UI agent builds

### Agent A — single report: form + view
Route: `spend/[date]/page.tsx` (date = `"YYYY-MM-DD"`).

```tsx
<ReportForm
  defaultValues={SpendReportInput}   // existing report, or schema defaults for a new day
  derived={DerivedMetrics}           // live preview computed client- or server-side as the user types
  onSubmit={(input: SpendReportInput) => Promise<void>}
/>

<ReportView dto={SpendReportDTO} />
```

Write the create/update server action here (validate with `spendReportInputSchema`, call
`requireFinanceWorkspace()`, then `computeDerived` + `toSpendReportDTO` to return a `SpendReportDTO`).
Guard writes with `canEditSpendReport`; guard delete with `canDeleteSpendReport`.

### Agent B — history + filters
Route: `spend/page.tsx`.

```tsx
<ReportList reports={SpendReportDTO[]} />
<ReportFilters />  {/* date range / risk status, etc. — your call on props */}
```

Write the list query here (`SpendReport.find({ workspaceId }).sort({ date: -1 })`, map each
through `computeDerived` + `toSpendReportDTO`, using the previous report in the sorted list as
`prior`).

### Agent C — trends + attachments
Route: `spend/trends/page.tsx`.

```tsx
<TrendCharts reports={SpendReportDTO[]} />
<ReportAttachments reportId={string} />
```

`ReportAttachments` is net-new (no model exists yet for it) — scope and build its own
storage/model if you take this on; it's out of this wave's contract.

## Ground rules

- Never construct a `SpendReportDTO` by hand — always go through `toSpendReportDTO`.
- Never query `SpendReport` without `workspaceId` from `requireFinanceWorkspace()`.
- `date` is a plain `"YYYY-MM-DD"` string throughout (model, schema, DTO) — no `Date` objects,
  no timezone conversion.
