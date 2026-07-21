import type { AssessmentDecision } from "./types.js";

const codeLike =
  /```|`[^`]*(?:=|\(|\)|\{|\}|;)[^`]*`|(?:^|\n)\s*(?:def|class|function|public|private|protected|return|if|else|while|for|switch|case|let|const|var)\b|(?:^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[^?\n]+/m;
const hiddenDisclosure =
  /hidden test|private test|secret case|expected output is|undisclosed input/i;
const markdownOrLink =
  /!?(?:\[[^\]]*\]\([^)]*\)|https?:\/\/|www\.)|(?:^|\n)\s*(?:#{1,6}|>)/i;
const mechanicalRecipe =
  /^(?:please\s+)?(?:set|assign|update|change|move|increment|decrement|write|add|insert|use)\b/i;

export function normalizeVisibleText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function safeQuestion(value: string | null): string | null {
  if (!value) return null;
  const text = normalizeVisibleText(value);
  if (
    !text ||
    text.length > 220 ||
    codeLike.test(text) ||
    hiddenDisclosure.test(text) ||
    markdownOrLink.test(text) ||
    mechanicalRecipe.test(text) ||
    !text.endsWith("?") ||
    (text.match(/\?/g)?.length ?? 0) !== 1
  )
    return null;
  return text;
}

export function enforceAssessmentSafety(
  decision: AssessmentDecision,
): AssessmentDecision {
  if (decision.action === "ask_question") {
    const question = safeQuestion(decision.question);
    if (!question)
      return {
        ...decision,
        action: "remain_silent",
        question: null,
        assessment:
          "Candidate question was blocked by the solution-safety boundary.",
      };
    return { ...decision, question };
  }
  return { ...decision, question: null };
}

export function isMeaningfulRevision(
  previous: string,
  current: string,
): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  return normalize(previous) !== normalize(current);
}
