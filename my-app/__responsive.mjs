// Temporary responsive sweep — delete after use.
// Usage: RESP_EMAIL=.. RESP_PASSWORD=.. node __responsive.mjs <outDir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "./__shots";
const VIEWPORTS = [
  { name: "360", viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
  { name: "768", viewport: { width: 768, height: 1024 }, hasTouch: true },
  { name: "1024", viewport: { width: 1024, height: 768 } },
  { name: "1440", viewport: { width: 1440, height: 900 } },
];

const PUBLIC = [
  ["sign-in", "/sign-in"],
  ["sign-up", "/sign-up"],
  ["forgot-password", "/forgot-password"],
  ["not-found", "/this-page-does-not-exist"],
];

function overflowReport() {
  const vw = document.documentElement.clientWidth;
  const clips = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (["auto", "scroll", "hidden", "clip"].includes(cs.overflowX)) {
        const r = p.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
      if (cs.position === "fixed") return true;
    }
    return false;
  };
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (clips(el)) continue;
      const parentBad = bad.some((b) => b.el.contains(el));
      if (parentBad) continue;
      bad.push({ el, tag: el.tagName.toLowerCase(), cls: String(el.className?.baseVal ?? el.className).slice(0, 140), text: (el.textContent ?? "").trim().slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  return {
    vw,
    sw: document.documentElement.scrollWidth,
    coarse: matchMedia("(pointer: coarse)").matches,
    offenders: bad.slice(0, 8).map(({ el, ...rest }) => rest),
  };
}

async function login(page, email, password) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function firstHref(page, url, re) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && re.test(h)) ?? null;
}

async function discover(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  const slug = new URL(page.url()).pathname.split("/")[2];
  const w = `/w/${slug}`;
  const routes = [
    ["home", w], ["my-tasks", `${w}/my-tasks`], ["inbox", `${w}/inbox`], ["drafts", `${w}/drafts`],
    ["calendar", `${w}/calendar`], ["search", `${w}/search?q=a`], ["projects", `${w}/projects`],
    ["people", `${w}/people`], ["teams", `${w}/people/teams`], ["members", `${w}/members`],
    ["settings-notifications", `${w}/settings/notifications`],
    ["dsr", `${w}/dsr`], ["dsr-team", `${w}/dsr/team`],
    ["spend", `${w}/spend`], ["spend-trends", `${w}/spend/trends`],
    ["goals", `${w}/strategy/goals`], ["module-board", `${w}/strategy/module-board`],
    ["reporting", `${w}/strategy/reporting`], ["resourcing", `${w}/strategy/resourcing`],
    ["account-profile", "/account/profile"], ["account-security", "/account/security"],
    ["account-api-keys", "/account/api-keys"],
  ];
  const project = await firstHref(page, `${BASE}${w}/projects`, /\/projects\/[a-f0-9]{24}$/);
  if (project) {
    routes.push(["project-list", project], ["project-board", `${project}/board`],
      ["project-timeline", `${project}/timeline`], ["project-settings", `${project}/settings`]);
    const task = await firstHref(page, `${BASE}${project}`, /\/tasks\/[a-f0-9]{24}$/);
    if (task) routes.push(["task-detail", task]);
  }
  for (const [name, list, re] of [
    ["person", `${w}/people`, /\/people\/[a-f0-9]{24}$/],
    ["team-detail", `${w}/people/teams`, /\/people\/teams\/[a-f0-9]{24}$/],
    ["spend-date", `${w}/spend`, /\/spend\/\d{4}-\d{2}-\d{2}$/],
  ]) {
    const h = await firstHref(page, `${BASE}${list}`, re);
    if (h) routes.push([name, h]);
  }
  return routes;
}

async function sweep(browser, routes, storageState) {
  const results = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ ...vp, storageState, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    fs.mkdirSync(path.join(OUT, vp.name), { recursive: true });
    for (const [name, route] of routes) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(600);
        const rep = await page.evaluate(overflowReport);
        await page.screenshot({ path: path.join(OUT, vp.name, `${name}.png`), fullPage: true });
        results.push({ vp: vp.name, name, route, ...rep });
        const flag = rep.sw > rep.vw || rep.offenders.length ? "OVERFLOW" : "ok";
        console.log(`${vp.name}\t${flag}\t${name}\tsw=${rep.sw} vw=${rep.vw} coarse=${rep.coarse}`);
        for (const o of rep.offenders) console.log(`\t\t<${o.tag}> [${o.left},${o.right}] .${o.cls} "${o.text}"`);
      } catch (e) {
        console.log(`${vp.name}\tERROR\t${name}\t${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
}

const browser = await chromium.launch();
let routes = PUBLIC;
let storageState;
if (process.env.RESP_EMAIL && process.env.RESP_PASSWORD) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, process.env.RESP_EMAIL, process.env.RESP_PASSWORD);
  storageState = await ctx.storageState();
  routes = await discover(page);
  await ctx.close();
}
await sweep(browser, routes, storageState);
await browser.close();
