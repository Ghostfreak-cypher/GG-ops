export type EmailContent = { subject: string; text: string; html: string };

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const CORAL = "#f06a6a";
const BLUE = "#4573d2";
const DARK = "#1e1e1e";
const MUTED = "#6d6e6f";
const BG = "#f3f4f4";
const WHITE = "#ffffff";

function logo(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <span style="color:${CORAL};font-size:18px;letter-spacing:3px;line-height:1;">&#9679;&nbsp;&#9679;&nbsp;&#9679;</span>
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="color:${DARK};font-size:19px;font-weight:700;font-family:${FONT};letter-spacing:-0.3px;line-height:1;">GGOps</span>
        </td>
      </tr>
    </table>`;
}

function ctaButton(label: string, href: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="border-radius:6px;background-color:${BLUE};">
          <a href="${href}"
             style="display:inline-block;padding:11px 26px;color:${WHITE};text-decoration:none;font-size:15px;font-weight:600;font-family:${FONT};border-radius:6px;mso-padding-alt:11px 26px;line-height:1.2;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function footer(workspaceName: string, unsubscribeUrl: string): string {
  return `
    <tr>
      <td style="padding:20px 8px 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:${MUTED};font-family:${FONT};">
          <a href="${unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">
            Turn off all GGOps emails from &#8216;${workspaceName}&#8217;
          </a>
        </p>
        <p style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">
          San Francisco, CA 94107
        </p>
      </td>
    </tr>`;
}

function wrap(logoHtml: string, bodyHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BG};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${BG};min-height:100%;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;">

          <!-- Logo -->
          <tr>
            <td style="padding:0 0 18px 2px;">${logoHtml}</td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${WHITE};border-radius:8px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bodyHtml}
              </table>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Invite email
// ---------------------------------------------------------------------------

export function inviteEmail(p: {
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
  memberNames?: string[];
}): EmailContent {
  const subject = `${p.inviterName} invited you to a team: ${p.workspaceName}`;

  const text = [
    `${p.inviterName} added you to ${p.workspaceName} team.`,
    "",
    "Accept your invitation:",
    p.inviteUrl,
    "",
    "— GGOps",
  ].join("\n");

  const membersRow =
    p.memberNames && p.memberNames.length > 0
      ? `<tr>
          <td style="padding:0 48px 40px;">
            <p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT};line-height:1.6;">
              <strong style="color:${DARK};font-weight:600;">Team members:</strong>&nbsp;${p.memberNames.join(", ")}
            </p>
          </td>
        </tr>`
      : `<tr><td style="padding-bottom:40px;"></td></tr>`;

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          ${p.inviterName} added you to <strong style="font-weight:700;">${p.workspaceName}</strong> team
        </p>
        <p style="margin:0 0 36px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.workspaceName.toLowerCase().replace(/\s+/g, "")}
        </p>
        ${ctaButton("Accept Invitation", p.inviteUrl)}
      </td>
    </tr>
    ${membersRow}`;

  const html = wrap(
    logo(),
    bodyHtml,
    footer(p.workspaceName, `${p.inviteUrl}?unsubscribe=1`),
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Mention email
// ---------------------------------------------------------------------------

export function mentionEmail(p: {
  by: string;
  taskTitle: string;
  taskUrl: string;
  preview?: string;
}): EmailContent {
  const subject = `${p.by} mentioned you on "${p.taskTitle}"`;

  const text = [
    `${p.by} mentioned you on the task "${p.taskTitle}".`,
    ...(p.preview ? ["", `"${p.preview}"`] : []),
    "",
    "View the task:",
    p.taskUrl,
    "",
    "— GGOps",
  ].join("\n");

  const previewRow = p.preview
    ? `<tr>
        <td style="padding:0 48px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f8f8f8;border-left:3px solid #e0e0e0;border-radius:3px;padding:12px 16px;">
                <p style="margin:0;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.55;font-style:italic;">
                  &#8220;${p.preview}&#8221;
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          <strong style="font-weight:700;">${p.by}</strong> mentioned you on a task
        </p>
        <p style="margin:0 0 36px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.taskTitle}
        </p>
        ${ctaButton("View Task", p.taskUrl)}
      </td>
    </tr>
    ${previewRow}
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  const html = wrap(
    logo(),
    bodyHtml,
    footer("GGOps", `${p.taskUrl}?unsubscribe=1`),
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Task assignment email
// ---------------------------------------------------------------------------

export function taskAssignedEmail(p: {
  assignedBy: string;
  taskTitle: string;
  workspaceName: string;
  projectName: string;
  taskUrl: string;
  dueDate?: string;
}): EmailContent {
  const subject = `${p.assignedBy} assigned you a task: ${p.taskTitle}`;
  const dueLine = p.dueDate ? `Due: ${p.dueDate}` : undefined;

  const text = [
    `${p.assignedBy} assigned you to "${p.taskTitle}" in ${p.projectName}.`,
    ...(dueLine ? ["", dueLine] : []),
    "",
    "View the task:",
    p.taskUrl,
    "",
    "-- GGOps",
  ].join("\n");

  const dueRow = p.dueDate
    ? `<p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
        Due ${p.dueDate}
      </p>`
    : "";

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          <strong style="font-weight:700;">${p.assignedBy}</strong> assigned you a task
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:${DARK};font-family:${FONT};font-weight:600;">
          ${p.taskTitle}
        </p>
        <p style="margin:0 0 12px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.workspaceName} / ${p.projectName}
        </p>
        ${dueRow}
        ${ctaButton("View Task", p.taskUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  const html = wrap(
    logo(),
    bodyHtml,
    footer(p.workspaceName, `${p.taskUrl}?unsubscribe=1`),
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

export function welcomeEmail(p: { name: string; appUrl: string }): EmailContent {
  const subject = `Welcome to GGOps`;

  const text = [
    `Hi ${p.name},`,
    "",
    "Your account is ready. Create a workspace, invite your team, and start tracking work.",
    "",
    p.appUrl,
    "",
    "— GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 40px;">
        <p style="margin:0 0 10px;font-size:22px;font-weight:700;color:${DARK};font-family:${FONT};line-height:1.35;">
          Welcome, ${p.name}!
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6;">
          Your account is ready. Create a workspace, invite your team, and track work from a single place.
        </p>
        ${ctaButton("Get started", p.appUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer("GGOps", p.appUrl)),
  };
}

// ---------------------------------------------------------------------------
// Workspace joined email
// ---------------------------------------------------------------------------

export function workspaceJoinedEmail(p: {
  userName: string;
  workspaceName: string;
  workspaceUrl: string;
}): EmailContent {
  const subject = `You joined ${p.workspaceName}`;

  const text = [
    `Hi ${p.userName},`,
    "",
    `You're now a member of ${p.workspaceName}. Head over to start collaborating.`,
    "",
    p.workspaceUrl,
    "",
    "— GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          You're now a member of <strong style="font-weight:700;">${p.workspaceName}</strong>
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          Start collaborating with your team.
        </p>
        ${ctaButton("Go to workspace", p.workspaceUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.workspaceUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// Role updated email
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  MAINTAINER: "Maintainer",
  ADMIN: "Admin",
  MEMBER: "Member",
  GUEST: "Guest",
};

export function roleUpdatedEmail(p: {
  userName: string;
  workspaceName: string;
  newRole: string;
  workspaceUrl: string;
}): EmailContent {
  const friendlyRole = ROLE_LABELS[p.newRole] ?? p.newRole;
  const subject = `Your role in ${p.workspaceName} was updated`;

  const text = [
    `Hi ${p.userName},`,
    "",
    `Your role in ${p.workspaceName} has been updated to ${friendlyRole}.`,
    "",
    p.workspaceUrl,
    "",
    "— GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          Your role in <strong style="font-weight:700;">${p.workspaceName}</strong> was updated
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          You are now a <strong style="color:${DARK};">${friendlyRole}</strong>.
        </p>
        ${ctaButton("Go to workspace", p.workspaceUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.workspaceUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// Task completed email
// ---------------------------------------------------------------------------

export function taskCompletedEmail(p: {
  completedBy: string;
  taskTitle: string;
  workspaceName: string;
  projectName: string;
  taskUrl: string;
}): EmailContent {
  const subject = `Task completed: ${p.taskTitle}`;

  const text = [
    `${p.completedBy} completed "${p.taskTitle}" in ${p.projectName}.`,
    "",
    "View the task:",
    p.taskUrl,
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          <strong style="font-weight:700;">${p.completedBy}</strong> completed a task
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:${DARK};font-family:${FONT};font-weight:600;">
          ${p.taskTitle}
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.workspaceName} / ${p.projectName}
        </p>
        ${ctaButton("View Task", p.taskUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.taskUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// Task overdue email
// ---------------------------------------------------------------------------

export function taskOverdueEmail(p: {
  taskTitle: string;
  workspaceName: string;
  projectName: string;
  taskUrl: string;
  dueDate: string;
}): EmailContent {
  const subject = `Overdue: ${p.taskTitle}`;

  const text = [
    `"${p.taskTitle}" was due on ${p.dueDate} and is now overdue in ${p.projectName}.`,
    "",
    "View the task:",
    p.taskUrl,
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          This task is <span style="color:#ef4444;font-weight:700;">overdue</span>
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:${DARK};font-family:${FONT};font-weight:600;">
          ${p.taskTitle}
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:#ef4444;font-family:${FONT};">
          ${p.workspaceName} / ${p.projectName} &middot; Was due ${p.dueDate}
        </p>
        ${ctaButton("View Task", p.taskUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.taskUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// New comment email
// ---------------------------------------------------------------------------

export function newCommentEmail(p: {
  commenterName: string;
  taskTitle: string;
  taskUrl: string;
  preview?: string;
}): EmailContent {
  const subject = `${p.commenterName} commented on "${p.taskTitle}"`;

  const text = [
    `${p.commenterName} commented on "${p.taskTitle}".`,
    ...(p.preview ? ["", `"${p.preview}"`] : []),
    "",
    "View the task:",
    p.taskUrl,
    "",
    "— GGOps",
  ].join("\n");

  const previewRow = p.preview
    ? `<tr>
        <td style="padding:0 48px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f8f8f8;border-left:3px solid #e0e0e0;border-radius:3px;padding:12px 16px;">
                <p style="margin:0;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.55;font-style:italic;">
                  &#8220;${p.preview}&#8221;
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          <strong style="font-weight:700;">${p.commenterName}</strong> commented on a task
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.taskTitle}
        </p>
        ${ctaButton("View comment", p.taskUrl)}
      </td>
    </tr>
    ${previewRow}
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer("GGOps", `${p.taskUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// Member joined email  (sent to workspace admins/owners)
// ---------------------------------------------------------------------------

export function memberJoinedEmail(p: {
  memberName: string;
  workspaceName: string;
  workspaceUrl: string;
  role: string;
}): EmailContent {
  const friendlyRole = ROLE_LABELS[p.role] ?? p.role;
  const subject = `${p.memberName} joined ${p.workspaceName}`;

  const text = [
    `${p.memberName} joined ${p.workspaceName} as ${friendlyRole}.`,
    "",
    p.workspaceUrl,
    "",
    "— GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 40px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          <strong style="font-weight:700;">${p.memberName}</strong> joined
          <strong style="font-weight:700;">${p.workspaceName}</strong>
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          They joined as <strong style="color:${DARK};">${friendlyRole}</strong>.
        </p>
        ${ctaButton("View team", `${p.workspaceUrl}/members`)}
      </td>
    </tr>`;

  return {
    subject,
    text,
    html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.workspaceUrl}?unsubscribe=1`)),
  };
}

// ---------------------------------------------------------------------------
// Task due email
// ---------------------------------------------------------------------------

export function taskDueEmail(p: {
  taskTitle: string;
  workspaceName: string;
  projectName: string;
  taskUrl: string;
  dueDate: string;
}): EmailContent {
  const subject = `Due today: ${p.taskTitle}`;

  const text = [
    `"${p.taskTitle}" is due today in ${p.projectName}.`,
    "",
    `Due: ${p.dueDate}`,
    "",
    "View the task:",
    p.taskUrl,
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 6px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          This task is due today
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:${DARK};font-family:${FONT};font-weight:600;">
          ${p.taskTitle}
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};">
          ${p.workspaceName} / ${p.projectName} &middot; Due ${p.dueDate}
        </p>
        ${ctaButton("View Task", p.taskUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  const html = wrap(
    logo(),
    bodyHtml,
    footer(p.workspaceName, `${p.taskUrl}?unsubscribe=1`),
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Daily digest email
// ---------------------------------------------------------------------------

export type TaskDueSummary = { title: string; projectName: string; taskUrl: string };

export function dailyDigestEmail(p: {
  userName: string;
  workspaceName: string;
  workspaceUrl: string;
  tasksDueToday: TaskDueSummary[];
  overdueCount: number;
}): EmailContent {
  const subject = `Your daily digest — ${p.workspaceName}`;

  const text = [
    `Hi ${p.userName},`,
    "",
    p.tasksDueToday.length > 0
      ? `Tasks due today (${p.tasksDueToday.length}):\n${p.tasksDueToday.map((t) => `  · ${t.title} [${t.projectName}]`).join("\n")}`
      : "No tasks due today.",
    p.overdueCount > 0 ? `Overdue: ${p.overdueCount} task${p.overdueCount !== 1 ? "s" : ""} past due.` : "",
    "",
    p.workspaceUrl,
    "— GGOps",
  ]
    .filter(Boolean)
    .join("\n");

  const taskRows =
    p.tasksDueToday.length > 0
      ? p.tasksDueToday
          .map(
            (t) => `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
              <a href="${t.taskUrl}" style="color:${DARK};text-decoration:none;font-size:14px;font-family:${FONT};font-weight:500;">${t.title}</a>
              <span style="color:${MUTED};font-size:12px;font-family:${FONT};"> · ${t.projectName}</span>
            </td>
          </tr>`,
          )
          .join("")
      : `<tr><td style="padding:8px 0;font-size:14px;color:${MUTED};font-family:${FONT};">No tasks due today.</td></tr>`;

  const overdueRow =
    p.overdueCount > 0
      ? `<tr><td style="padding:16px 48px 0;">
          <p style="margin:0;padding:12px 16px;background:#fff5f5;border-left:3px solid #ef4444;border-radius:3px;font-size:13px;color:#ef4444;font-family:${FONT};">
            <strong>${p.overdueCount}</strong> task${p.overdueCount !== 1 ? "s are" : " is"} overdue
          </p>
        </td></tr>`
      : "";

  const bodyHtml = `
    <tr>
      <td style="padding:36px 48px 8px;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${DARK};font-family:${FONT};">Good morning, ${p.userName}</p>
        <p style="margin:0 0 24px;font-size:13px;color:${MUTED};font-family:${FONT};">${p.workspaceName} &middot; daily digest</p>
        <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:${MUTED};font-family:${FONT};letter-spacing:.05em;text-transform:uppercase;">Due today</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">${taskRows}</table>
      </td>
    </tr>
    ${overdueRow}
    <tr><td style="padding:24px 48px 36px;">${ctaButton("Go to My Tasks", `${p.workspaceUrl}/my-tasks`)}</td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.workspaceUrl}?unsubscribe=1`)) };
}

// ---------------------------------------------------------------------------
// Weekly digest email
// ---------------------------------------------------------------------------

export type OverdueTaskSummary = { title: string; projectName: string };
export type TopMemberSummary = { name: string; count: number };

export function weeklyDigestEmail(p: {
  userName: string;
  workspaceName: string;
  workspaceUrl: string;
  completedThisWeek: number;
  openTasks: number;
  overdueTasks: number;
  overdueList: OverdueTaskSummary[];
  topMembers: TopMemberSummary[];
}): EmailContent {
  const subject = `Your week in review — ${p.workspaceName}`;

  const text = [
    `Hi ${p.userName},`,
    "",
    `Weekly summary for ${p.workspaceName}:`,
    `Completed this week: ${p.completedThisWeek}`,
    `Open tasks: ${p.openTasks}`,
    `Overdue tasks: ${p.overdueTasks}`,
    p.topMembers.length > 0 ? `Most active: ${p.topMembers.map((m) => `${m.name} (${m.count})`).join(", ")}` : "",
    "",
    p.workspaceUrl,
    "— GGOps",
  ]
    .filter(Boolean)
    .join("\n");

  const statCell = (value: number, label: string, color = DARK) =>
    `<td style="text-align:center;padding:0 16px;">
      <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:${color};font-family:${FONT};line-height:1;">${value}</p>
      <p style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">${label}</p>
    </td>`;

  const overdueListRows =
    p.overdueList.length > 0
      ? `<tr><td style="padding:20px 48px 0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${MUTED};font-family:${FONT};letter-spacing:.05em;text-transform:uppercase;">Overdue tasks</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${p.overdueList.map((t) => `<tr><td style="padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#ef4444;font-family:${FONT};">${t.title} <span style="color:${MUTED};">· ${t.projectName}</span></td></tr>`).join("")}
          </table>
        </td></tr>`
      : "";

  const topMembersRow =
    p.topMembers.length > 0
      ? `<tr><td style="padding:20px 48px 0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${MUTED};font-family:${FONT};letter-spacing:.05em;text-transform:uppercase;">Most active this week</p>
          ${p.topMembers.map((m, i) => `<p style="margin:0 0 4px;font-size:13px;color:${DARK};font-family:${FONT};"><span style="color:${MUTED};">${i + 1}.</span> ${m.name} <span style="color:${MUTED};">· ${m.count} task${m.count !== 1 ? "s" : ""} completed</span></p>`).join("")}
        </td></tr>`
      : "";

  const bodyHtml = `
    <tr>
      <td style="padding:36px 48px 8px;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${DARK};font-family:${FONT};">Your week in review</p>
        <p style="margin:0 0 24px;font-size:13px;color:${MUTED};font-family:${FONT};">${p.workspaceName} &middot; weekly digest</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>${statCell(p.completedThisWeek, "completed", "#22c55e")}${statCell(p.openTasks, "open")}${statCell(p.overdueTasks, "overdue", p.overdueTasks > 0 ? "#ef4444" : DARK)}</tr>
        </table>
      </td>
    </tr>
    ${overdueListRows}
    ${topMembersRow}
    <tr><td style="padding:24px 48px 36px;">${ctaButton("Go to workspace", p.workspaceUrl)}</td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer(p.workspaceName, `${p.workspaceUrl}?unsubscribe=1`)) };
}


// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export function emailVerificationEmail(p: {
  name: string;
  verifyUrl: string;
}): EmailContent {
  const subject = "Verify your email";

  const text = [
    `Hi ${p.name},`,
    "",
    "Confirm your email address to keep your account secure.",
    "",
    p.verifyUrl,
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          Verify your email address
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6;">
          Confirm your email address to keep your account secure and receive important updates.
        </p>
        ${ctaButton("Verify email", p.verifyUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer("GGOps", p.verifyUrl)) };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export function passwordResetEmail(p: {
  name: string;
  resetUrl: string;
}): EmailContent {
  const subject = "Reset your password";

  const text = [
    `Hi ${p.name},`,
    "",
    "Use the link below to choose a new password. This link expires in 1 hour.",
    "",
    p.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          Reset your password
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6;">
          Use the link below to choose a new password. This link expires in 1 hour.
        </p>
        ${ctaButton("Reset password", p.resetUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer("GGOps", p.resetUrl)) };
}

// ---------------------------------------------------------------------------
// Login alert
// ---------------------------------------------------------------------------

export function loginAlertEmail(p: {
  name: string;
  provider: string;
  occurredAt: string;
  ipAddress: string;
  userAgent: string;
  securityUrl: string;
}): EmailContent {
  const subject = "New login to your account";

  const text = [
    `Hi ${p.name},`,
    "",
    `We noticed a new ${p.provider} login to your account.`,
    `Time: ${p.occurredAt}`,
    `IP: ${p.ipAddress}`,
    `Device: ${p.userAgent}`,
    "",
    p.securityUrl,
    "",
    "If this was not you, change your password immediately.",
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          New login to your account
        </p>
        <p style="margin:0 0 18px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6;">
          We noticed a new <strong style="color:${DARK};">${p.provider}</strong> login to your account.
        </p>
        <p style="margin:0 0 6px;font-size:13px;color:${MUTED};font-family:${FONT};">Time: ${p.occurredAt}</p>
        <p style="margin:0 0 6px;font-size:13px;color:${MUTED};font-family:${FONT};">IP: ${p.ipAddress}</p>
        <p style="margin:0 0 24px;font-size:13px;color:${MUTED};font-family:${FONT};">Device: ${p.userAgent}</p>
        ${ctaButton("Review security", p.securityUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer("GGOps", p.securityUrl)) };
}

// ---------------------------------------------------------------------------
// Password changed
// ---------------------------------------------------------------------------

export function passwordChangedEmail(p: {
  name: string;
  securityUrl: string;
}): EmailContent {
  const subject = "Your password was changed";

  const text = [
    `Hi ${p.name},`,
    "",
    "Your password was changed successfully.",
    "",
    p.securityUrl,
    "",
    "If this was not you, secure your account immediately.",
    "",
    "-- GGOps",
  ].join("\n");

  const bodyHtml = `
    <tr>
      <td style="padding:44px 48px 28px;">
        <p style="margin:0 0 8px;font-size:19px;line-height:1.45;color:${DARK};font-family:${FONT};font-weight:400;">
          Your password was changed
        </p>
        <p style="margin:0 0 28px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6;">
          If you did not make this change, review your account security immediately.
        </p>
        ${ctaButton("Review security", p.securityUrl)}
      </td>
    </tr>
    <tr><td style="padding-bottom:40px;"></td></tr>`;

  return { subject, text, html: wrap(logo(), bodyHtml, footer("GGOps", p.securityUrl)) };
}
