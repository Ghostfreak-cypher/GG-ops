import { describe, it, expect, vi, beforeEach } from "vitest";

const envMock = vi.hoisted(() => ({ value: { INBOUND_EMAIL_ENABLED: undefined as string | undefined } }));
const mocks = vi.hoisted(() => ({
  isGmailConfigured: vi.fn(),
  gmailClient: vi.fn(),
  ensureLabel: vi.fn(),
  listUnprocessed: vi.fn(),
  getMessage: vi.fn(),
  claimMessage: vi.fn(),
  markFailed: vi.fn(),
  isExtractionConfigured: vi.fn(),
  extractTask: vi.fn(),
  createTaskForActor: vi.fn(),
  resolveSender: vi.fn(),
  resolveTarget: vi.fn(),
  verifyAuthResults: vi.fn(),
  parseGmailMessage: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: envMock.value }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, clientIp: () => "127.0.0.1" }));
vi.mock("@/lib/gmail", () => ({
  isGmailConfigured: mocks.isGmailConfigured,
  gmailClient: mocks.gmailClient,
  ensureLabel: mocks.ensureLabel,
  listUnprocessed: mocks.listUnprocessed,
  getMessage: mocks.getMessage,
  claimMessage: mocks.claimMessage,
  markFailed: mocks.markFailed,
  PROCESSED_LABEL: "ggops-processed",
  FAILED_LABEL: "ggops-failed",
}));
vi.mock("@/modules/inbound-email/normalize", () => ({ parseGmailMessage: mocks.parseGmailMessage }));
vi.mock("@/modules/inbound-email/verify", () => ({
  verifyAuthResults: mocks.verifyAuthResults,
  resolveSender: mocks.resolveSender,
  resolveTarget: mocks.resolveTarget,
}));
vi.mock("@/modules/inbound-email/extract", () => ({
  extractTask: mocks.extractTask,
  isExtractionConfigured: mocks.isExtractionConfigured,
}));
vi.mock("@/modules/task/server/create-task-core", () => ({
  createTaskForActor: mocks.createTaskForActor,
}));

const { ingestInboundEmail } = await import("@/modules/inbound-email/ingest");

const ACTOR = { id: "507f1f77bcf86cd799439011", name: "Ada" };

function happyPath() {
  envMock.value.INBOUND_EMAIL_ENABLED = "true";
  mocks.isGmailConfigured.mockReturnValue(true);
  mocks.isExtractionConfigured.mockReturnValue(true);
  mocks.gmailClient.mockReturnValue({});
  mocks.ensureLabel.mockResolvedValue("label-id");
  mocks.listUnprocessed.mockResolvedValue(["m1"]);
  mocks.getMessage.mockResolvedValue({ id: "m1" });
  mocks.parseGmailMessage.mockReturnValue({
    messageId: "m1", from: "Ada <ada@acme.test>", fromEmail: "ada@acme.test",
    to: ["inbound@ggops.test"], subject: "[Billing] fix", body: "broken", authResults: "dmarc=pass",
  });
  mocks.verifyAuthResults.mockReturnValue({ ok: true });
  mocks.resolveSender.mockResolvedValue({ ok: true, actor: ACTOR });
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.resolveTarget.mockResolvedValue({
    ok: true, projectId: "507f1f77bcf86cd799439031", projectName: "Billing", workspaceName: "Acme",
  });
  mocks.extractTask.mockResolvedValue({ isTask: true, title: "Fix billing", confidence: 0.9 });
  mocks.createTaskForActor.mockResolvedValue({ ok: true, data: { id: "507f1f77bcf86cd799439099" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  envMock.value.INBOUND_EMAIL_ENABLED = undefined;
  // These are awaited (and markFailed is `.catch()`-ed) in the real code, so the stubs must
  // be thenable — a bare vi.fn() returns undefined and blows up on `.catch`.
  mocks.claimMessage.mockResolvedValue(undefined);
  mocks.markFailed.mockResolvedValue(undefined);
});

describe("kill switch", () => {
  it("does nothing at all unless INBOUND_EMAIL_ENABLED is exactly \"true\"", async () => {
    const summary = await ingestInboundEmail();
    expect(summary.enabled).toBe(false);
    expect(summary.scanned).toBe(0);
    expect(mocks.gmailClient).not.toHaveBeenCalled();
  });

  it("stays off when enabled but not configured", async () => {
    envMock.value.INBOUND_EMAIL_ENABLED = "true";
    mocks.isGmailConfigured.mockReturnValue(false);
    mocks.isExtractionConfigured.mockReturnValue(true);
    expect((await ingestInboundEmail()).enabled).toBe(false);
  });
});

describe("gate ordering — nothing costs a token until the sender is proven", () => {
  it("creates a task when every gate passes", async () => {
    happyPath();
    const summary = await ingestInboundEmail();
    expect(summary.created).toBe(1);
    expect(summary.details[0]?.verdict).toBe("created");
    expect(mocks.createTaskForActor).toHaveBeenCalledWith(
      ACTOR,
      "507f1f77bcf86cd799439031",
      expect.objectContaining({ title: "Fix billing" }),
    );
  });

  it("does NOT call the LLM when DMARC fails", async () => {
    happyPath();
    mocks.verifyAuthResults.mockReturnValue({ ok: false, reason: "DMARC did not pass" });

    const summary = await ingestInboundEmail();
    expect(summary.details[0]?.verdict).toBe("unverified_sender");
    expect(mocks.extractTask).not.toHaveBeenCalled();
    expect(mocks.createTaskForActor).not.toHaveBeenCalled();
  });

  it("does NOT call the LLM for an unknown sender", async () => {
    happyPath();
    mocks.resolveSender.mockResolvedValue({ ok: false, reason: "not a user" });

    expect((await ingestInboundEmail()).details[0]?.verdict).toBe("unknown_sender");
    expect(mocks.extractTask).not.toHaveBeenCalled();
  });

  it("does NOT call the LLM when no project resolves", async () => {
    happyPath();
    mocks.resolveTarget.mockResolvedValue({ ok: false, reason: "no target" });

    expect((await ingestInboundEmail()).details[0]?.verdict).toBe("no_target");
    expect(mocks.extractTask).not.toHaveBeenCalled();
  });

  it("rate-limits a single sender before extracting", async () => {
    happyPath();
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    expect((await ingestInboundEmail()).details[0]?.verdict).toBe("rate_limited");
    expect(mocks.extractTask).not.toHaveBeenCalled();
  });

  it("honours a write rejection from createTaskForActor", async () => {
    happyPath();
    mocks.createTaskForActor.mockResolvedValue({ ok: false, error: "You don't have permission." });

    const summary = await ingestInboundEmail();
    expect(summary.details[0]?.verdict).toBe("rejected");
    expect(summary.created).toBe(0);
  });
});

describe("claim-before-work", () => {
  it("labels the message before the LLM runs, so two runs can't double-create", async () => {
    happyPath();
    const order: string[] = [];
    mocks.claimMessage.mockImplementation(async () => void order.push("claim"));
    mocks.extractTask.mockImplementation(async () => {
      order.push("extract");
      return { isTask: true, title: "x", confidence: 0.9 };
    });

    await ingestInboundEmail();
    expect(order).toEqual(["claim", "extract"]);
  });

  it("labels non-successes as failed so drops stay visible", async () => {
    happyPath();
    mocks.verifyAuthResults.mockReturnValue({ ok: false, reason: "nope" });
    await ingestInboundEmail();
    expect(mocks.markFailed).toHaveBeenCalled();
  });
});

describe("@mention stripping", () => {
  it("neutralises mentions in the model-authored description", async () => {
    happyPath();
    mocks.extractTask.mockResolvedValue({
      isTask: true,
      title: "Fix it",
      // An injected mention would otherwise reach notifyDescriptionMentions and fan out
      // notifications to the whole workspace.
      description: "Please ping @everyone and @ada about this",
      confidence: 0.9,
    });

    await ingestInboundEmail();

    const input = mocks.createTaskForActor.mock.calls[0]?.[2] as { description: string };
    expect(input.description).not.toContain("@everyone");
    expect(input.description).not.toContain("@ada");
    expect(input.description).toContain("everyone");
  });
});
