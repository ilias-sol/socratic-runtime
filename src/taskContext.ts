import type { TaskContext } from "./types.js";

const marker = "@socratic-task";

function summarize(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*#/]\s*/, ""))
      .find(
        (line) => line && !line.startsWith("@") && line !== "Requirements:",
      ) ?? "Programming task"
  ).slice(0, 160);
}

function cleanMarkedText(raw: string): string {
  const after = raw.slice(raw.indexOf(marker) + marker.length);
  return after
    .replace(/^\s*\r?\n/, "")
    .replace(/^\s*\*\/\s*$/gm, "")
    .replace(/^\s*\*\s?/gm, "")
    .replace(/^\s*(?:#|\/\/|--)\s?/gm, "")
    .replace(/(?:"""|'''|\*\/)\s*$/, "")
    .trim();
}

export function taskFromMarker(source: string): TaskContext | null {
  const blocks = [/("""|''')([\s\S]*?)\1/g, /\/\*([\s\S]*?)\*\//g];
  for (const pattern of blocks) {
    for (const match of source.matchAll(pattern)) {
      if (!match[0].includes(marker)) continue;
      const text = cleanMarkedText(match[0]);
      if (text) return { text, summary: summarize(text), source: "marker" };
    }
  }

  const lines = source.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  if (markerIndex < 0) return null;
  const collected: string[] = [];
  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^\s*(?:#|\/\/|--)\s?(.*)$/);
    if (!match) break;
    collected.push(match[1] ?? "");
  }
  const text = collected.join("\n").trim();
  return text ? { text, summary: summarize(text), source: "marker" } : null;
}

export function taskFromSelection(text: string): TaskContext | null {
  const value = text.trim();
  if (!value) return null;
  return {
    text: value.slice(0, 4_000),
    summary: summarize(value),
    source: "selection",
  };
}

export function inferredTask(text: string): TaskContext {
  const value = text.trim().slice(0, 4_000);
  return { text: value, summary: summarize(value), source: "inferred" };
}

export function boundedCode(source: string, maximum = 30_000): string {
  if (source.length <= maximum) return source;
  return `${source.slice(0, maximum)}\n/* file context truncated */`;
}

export function compactDiff(
  previous: string | null,
  current: string,
  maximum = 6_000,
): string | null {
  if (previous === null) return null;
  const before = previous.split(/\r?\n/);
  const after = current.split(/\r?\n/);
  const lines: string[] = [];
  const count = Math.max(before.length, after.length);
  for (let index = 0; index < count; index += 1) {
    if (before[index] === after[index]) continue;
    if (before[index] !== undefined)
      lines.push(`- ${index + 1}: ${before[index]}`);
    if (after[index] !== undefined)
      lines.push(`+ ${index + 1}: ${after[index]}`);
    if (lines.join("\n").length >= maximum) break;
  }
  return lines.join("\n").slice(0, maximum) || null;
}
