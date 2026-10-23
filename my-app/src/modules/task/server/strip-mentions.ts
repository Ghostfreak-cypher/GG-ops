/**
 * Strip `@mentions` from model-produced text before it reaches a task description.
 *
 * `createTaskForActor` runs `notifyDescriptionMentions` over the description, so an
 * injected `@everyone` in AI-authored content (an email body, a meeting note) would become
 * a workspace-wide notification fan-out — a small injection turning into a large, noisy
 * side effect. Shared by the inbound-email pipeline and task-draft creation; anything that
 * stores AI-authored text destined for a task description should call this first.
 */
export function stripMentions(text: string): string {
  return text.replace(/(^|\s)@([\w.-]+)/g, "$1$2");
}
