/**
 * Reports rendered per page, and how many more each "show more" adds.
 *
 * Split out of `schemas.ts` on purpose: that file imports zod, and the one client component
 * that needs this number (`ui/dsr-list.tsx`) would otherwise ship all of zod — every locale
 * and the JSON-Schema generator included — to the browser just to read a `const 7`.
 */
export const DSR_PAGE_SIZE = 7;
