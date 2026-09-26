/**
 * DELIBERATELY UNSAFE — not compiled, not imported, not shipped.
 *
 * This is the diff we hand CodeRabbit in the demo. It is the single most likely
 * mistake an autonomous engineer (or a tired human) makes in this codebase: a fast
 * path that executes before the gateway has spoken. It reads as a harmless
 * optimisation and removes the entire protection for the most dangerous action type.
 *
 * CodeRabbit should flag `handleActionUnsafe` under the `packages/guardian-core/**`
 * path instructions in .coderabbit.yaml.
 */
import type { ProposedAction } from "../types.js";

declare function execute(action: ProposedAction): Promise<unknown>;
declare const guardian: {
  checkAction(a: ProposedAction): Promise<{ decision: string }>;
};
declare function enforceGuardianDecision(r: { decision: string }): Promise<unknown>;

// ---------------------------------------------------------------- WRONG
// Messages skip the gateway entirely. The OTP scenario executes.
export async function handleActionUnsafe(action: ProposedAction) {
  if (action.action_type === "send_message") {
    return execute(action);
  }
  const result = await guardian.checkAction(action);
  if (result.decision !== "ALLOW") return enforceGuardianDecision(result);
  return execute(action);
}

// ---------------------------------------------------------------- RIGHT
// One path in, one check, no exceptions by action type.
export async function handleAction(action: ProposedAction) {
  const result = await guardian.checkAction(action);

  if (result.decision !== "ALLOW") {
    return enforceGuardianDecision(result);
  }

  return execute(action);
}
