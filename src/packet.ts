import type { TargetSymbol } from "./types.js";

const MAX_TARGET_CHARS = 6_000;
const MAX_DIFF_CHARS = 3_000;

function pythonTarget(lines: string[], start: number): string[] {
  const indentation = lines[start]?.match(/^\s*/)?.[0].length ?? 0;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    const current = line.match(/^\s*/)?.[0].length ?? 0;
    if (current <= indentation) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end);
}

interface LexicalState {
  blockComment: boolean;
  quote: string | null;
}

function braceDelta(line: string, state: LexicalState): number {
  let delta = 0;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    const next = line[index + 1] ?? "";
    if (state.blockComment) {
      if (character === "*" && next === "/") {
        state.blockComment = false;
        index += 1;
      }
      continue;
    }
    if (state.quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === state.quote) state.quote = null;
      continue;
    }
    if (character === "/" && next === "/") break;
    if (character === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (["'", '"', "`"].includes(character)) {
      state.quote = character;
      continue;
    }
    if (character === "{") delta += 1;
    else if (character === "}") delta -= 1;
  }
  return delta;
}

function bracedTarget(lines: string[], start: number): string[] {
  let balance = 0;
  let sawBrace = false;
  const lexical: LexicalState = { blockComment: false, quote: null };
  let end = Math.min(lines.length, start + 80);
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]!;
    const delta = braceDelta(line, lexical);
    if (delta > 0) sawBrace = true;
    balance += delta;
    if (sawBrace && balance <= 0) {
      end = index + 1;
      break;
    }
  }
  return lines.slice(start, end);
}

function declarationLine(
  lines: string[],
  target: TargetSymbol,
  language: string,
): number {
  const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = /python/i.test(language)
    ? [new RegExp(`^\\s*(?:async\\s+)?(?:def|class)\\s+${escaped}\\b`)]
    : [
        new RegExp(
          `^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\b`,
        ),
        new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\b`),
        new RegExp(
          `\\b(?:class|interface|struct|record|fn|func)\\s+${escaped}\\b`,
        ),
        new RegExp(`^\\s*(?:[\\w<>,.?[\\]]+\\s+)+${escaped}\\s*\\(`),
      ];
  return lines.findIndex((line) =>
    patterns.some((pattern) => pattern.test(line)),
  );
}

export function extractTargetCode(
  source: string,
  target: TargetSymbol,
  language: string,
): string {
  const lines = source.split(/\r?\n/);
  const relocated = declarationLine(lines, target, language);
  const start = Math.max(
    0,
    Math.min(relocated >= 0 ? relocated : target.line, lines.length - 1),
  );
  const selected = /python/i.test(language)
    ? pythonTarget(lines, start)
    : bracedTarget(lines, start);
  return selected.join("\n").trimEnd().slice(0, MAX_TARGET_CHARS);
}

export function compactRevisionDiff(
  previous: string | null,
  current: string,
): string | null {
  if (previous === null) return null;
  const before = previous.split(/\r?\n/);
  const after = current.split(/\r?\n/);
  const changed: string[] = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] === after[index]) continue;
    if (before[index] !== undefined)
      changed.push(`- ${index + 1}: ${before[index]}`);
    if (after[index] !== undefined)
      changed.push(`+ ${index + 1}: ${after[index]}`);
    if (changed.join("\n").length >= MAX_DIFF_CHARS) break;
  }
  return (
    changed.join("\n").slice(0, MAX_DIFF_CHARS) || "No target-level text change"
  );
}
