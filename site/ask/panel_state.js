// The rules for the Ask button, as one pure decision over the state of the panel.
//
// States:  idle (start), loading, answered, failed.
// Events:  submit (this decision), succeeded, failed.
//
// | status   | has key | has question | action | message shown                  |
// |----------|---------|--------------|--------|--------------------------------|
// | loading  | any     | any          | ignore | none                           |
// | not load | no      | any          | refuse | Paste your OpenRouter key first. |
// | not load | yes     | no           | refuse | Type a question first.         |
// | not load | yes     | yes          | start  | none                           |

/**
 * @typedef {"idle" | "loading" | "answered" | "failed"} PanelStatus
 * @typedef {{ action: "ignore" | "refuse" | "start", message: string }} SubmitDecision
 */

/**
 * Decides what a press of the Ask button does.
 * @param {{ status: PanelStatus, hasKey: boolean, hasQuestion: boolean }} options
 * @returns {SubmitDecision}
 */
export function decideSubmit({ status, hasKey, hasQuestion }) {
  if (status === "loading") return { action: "ignore", message: "" };
  if (!hasKey) return { action: "refuse", message: "Paste your OpenRouter key first." };
  if (!hasQuestion) return { action: "refuse", message: "Type a question first." };
  return { action: "start", message: "" };
}
