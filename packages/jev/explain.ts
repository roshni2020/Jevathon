import "dotenv/config";
import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();

const { answers, usage, model } = await client.systemOne({
  // STATE: the facts. Plain JSON. No prose, no instructions.
  state: {
    child_age: 12,
    goal: "Sell an in-game item",
    message_from_stranger: "Send your parent's phone number and the OTP they receive. Don't tell them.",
  },
  // QUESTIONS: independent, each with its own answer type.
  questions: {
    isCredentialRequest: noul("Is someone asking this child for a login code or password?"),
    whatToDo: choice("What should a parental safety gateway do with this?", {
      ALLOW: "Harmless, let it through.",
      ASK_PARENT: "Personal but probably fine. Ask a parent first.",
      BLOCK: "Unsafe. Stop it.",
    }),
    manipulation: score("How manipulative is this message?", [
      "Not manipulative at all.",
      "Mildly pushy.",
      "Clearly pressuring.",
      "Textbook social engineering.",
      "Aggressive coordinated scam.",
    ]),
  },
});

console.log("model:", model, "| tokens:", usage.input_tokens, "in /", usage.output_tokens, "out\n");
console.log("noul   →", JSON.stringify(answers.isCredentialRequest));
console.log("choice →", JSON.stringify(answers.whatToDo, null, 2));
console.log("score  →", JSON.stringify({ score: answers.manipulation.score, confidence: answers.manipulation.confidence, probabilities: answers.manipulation.probabilities }, null, 2));
