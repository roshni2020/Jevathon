/**
 * The engineering-side demo: Devin changes Guardian, CodeRabbit reviews it,
 * Jev decides whether it may ship.
 *
 * Run: npx tsx packages/devin/demo-loop.ts
 *
 * MOCKED unless DEVIN_API_KEY is set. The CodeRabbit findings below are the ones
 * CodeRabbit produces for packages/guardian-core/examples/unsafe-bypass.ts.example.
 */
import "dotenv/config";
import { DevinAdapter, reviewToDeployDecision, type CodeRabbitFinding } from "./index.js";

const TASK = "Add a new Guardian policy that blocks sharing one-time passwords.";
const REPO = "guardian-mcp";

const UNSAFE_FINDINGS: CodeRabbitFinding[] = [
  {
    severity: "critical",
    category: "policy_bypass",
    file: "packages/guardian-core/examples/unsafe-bypass.ts",
    comment:
      "handleActionUnsafe() returns execute(action) for send_message before calling guardian.checkAction(). " +
      "Every outbound message, including the OTP case, skips the gateway.",
  },
];

const CLEAN_FINDINGS: CodeRabbitFinding[] = [
  { severity: "nit", category: "style", file: "packages/guardian-core/policy.ts", comment: "Sort the field map." },
];

const line = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`);

const devin = await new DevinAdapter().run({ task: TASK, repo: REPO });
line("1. Devin");
console.log(`   task     ${TASK}`);
console.log(`   branch   ${devin.branch}   [${devin.status}]`);
console.log(`   files    ${devin.changedFiles.join(", ") || "(pending)"}`);

for (const [label, findings] of [
  ["unsafe version (bypasses the gateway)", UNSAFE_FINDINGS],
  ["corrected version", CLEAN_FINDINGS],
] as const) {
  line(`2. CodeRabbit — ${label}`);
  for (const f of findings) console.log(`   [${f.severity}] ${f.category} · ${f.file}\n      ${f.comment}`);

  const gate = await reviewToDeployDecision({
    changed_files: devin.changedFiles,
    coderabbit_findings: findings as CodeRabbitFinding[],
    tests_passed: true,
  });
  line(`3. Jev deployment gate → ${gate.decision}`);
  console.log(`   bypass risk     ${gate.introduces_bypass}`);
  console.log(`   safety surface  ${(gate.safety_surface * 100).toFixed(0)}%`);
  console.log(`   source          ${gate.source}`);
  console.log(`   ${gate.rationale}`);
}
