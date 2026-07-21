import type { ParsedTask, TargetSymbol } from "./types.js";

interface TaskCandidate {
  task: ParsedTask;
  markerLine: number;
}

const marker = "@socratic-task";

function summarize(text: string): string {
  const first = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line && !line.startsWith("@") && !line.startsWith("Requirements:"),
    );
  return (first ?? "Selected programming task")
    .replace(/^[-*]\s*/, "")
    .slice(0, 120);
}

function normalizedBody(raw: string): string {
  const markerIndex = raw.indexOf(marker);
  return raw
    .slice(markerIndex + marker.length)
    .replace(/^\s*\r?\n/, "")
    .trim();
}

export function parseTaskCandidates(source: string): ParsedTask[] {
  const lines = source.split(/\r?\n/);
  const candidates: TaskCandidate[] = [];

  const blockPatterns: Array<{
    pattern: RegExp;
    source: ParsedTask["source"];
  }> = [
    { pattern: /("""|''')([\s\S]*?)\1/g, source: "triple_quote" },
    { pattern: /\/\*([\s\S]*?)\*\//g, source: "block_comment" },
  ];
  for (const entry of blockPatterns) {
    for (const match of source.matchAll(entry.pattern)) {
      const body = match[2] ?? match[1] ?? "";
      if (!body.includes(marker)) continue;
      const before = source.slice(0, match.index ?? 0);
      const startLine = before.split(/\r?\n/).length - 1;
      const endLine = startLine + (match[0].match(/\r?\n/g)?.length ?? 0);
      const text = normalizedBody(body.replace(/^\s*\*\s?/gm, ""));
      if (!text) continue;
      candidates.push({
        markerLine: startLine,
        task: {
          text,
          summary: summarize(text),
          source: entry.source,
          startLine,
          endLine,
        },
      });
    }
  }

  const lineComment = /^\s*(#|\/\/|--)\s?/;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!lineComment.test(line) || !line.includes(marker)) continue;
    const prefix = line.match(lineComment)?.[1] ?? "#";
    const samePrefix = new RegExp(
      `^\\s*${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s?`,
    );
    let start = index;
    while (start > 0 && samePrefix.test(lines[start - 1] ?? "")) start -= 1;
    let end = index;
    while (end + 1 < lines.length && samePrefix.test(lines[end + 1] ?? ""))
      end += 1;
    const raw = lines
      .slice(start, end + 1)
      .map((value) => value.replace(samePrefix, ""))
      .join("\n");
    const text = normalizedBody(raw);
    if (!text) continue;
    candidates.push({
      markerLine: index,
      task: {
        text,
        summary: summarize(text),
        source: "line_comment",
        startLine: start,
        endLine: end,
      },
    });
    index = end;
  }

  return candidates
    .sort((a, b) => a.markerLine - b.markerLine)
    .map(({ task }) => task)
    .filter(
      (task, index, all) =>
        !all
          .slice(0, index)
          .some((other) => other.startLine === task.startLine),
    );
}

export function chooseNearestTask(
  tasks: ParsedTask[],
  cursorLine: number,
): ParsedTask | null {
  if (tasks.length === 0) return null;
  return (
    [...tasks].sort((left, right) => {
      const leftDistance =
        cursorLine < left.startLine
          ? left.startLine - cursorLine
          : cursorLine > left.endLine
            ? cursorLine - left.endLine
            : 0;
      const rightDistance =
        cursorLine < right.startLine
          ? right.startLine - cursorLine
          : cursorLine > right.endLine
            ? cursorLine - right.endLine
            : 0;
      return leftDistance - rightDistance || right.startLine - left.startLine;
    })[0] ?? null
  );
}

function symbolOnLine(
  text: string,
  languageId: string,
): { name: string; kind: TargetSymbol["kind"] } | null {
  const language = languageId.toLowerCase();
  const classMatch = text.match(
    /\b(?:class|interface|struct|record)\s+([A-Za-z_$][\w$]*)/,
  );
  if (classMatch) return { name: classMatch[1]!, kind: "class" };

  if (language === "python") {
    const match = text.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\b/);
    return match ? { name: match[1]!, kind: "function" } : null;
  }
  if (
    ["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(
      language,
    )
  ) {
    const match = text.match(
      /(?:function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)\b|^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/,
    );
    const name = match?.[1] ?? match?.[2];
    return name ? { name, kind: "function" } : null;
  }
  const method = text.match(
    /^\s*(?:(?:public|private|protected|static|final|virtual|override|async|synchronized)\s+)*(?:(?:[\w<>,.?]+|\[|\])+\s+)+([A-Za-z_$][\w$]*)\s*\(/,
  );
  if (method) return { name: method[1]!, kind: "method" };
  const rustGo = text.match(/\b(?:fn|func)\s+([A-Za-z_]\w*)\s*\(/);
  return rustGo ? { name: rustGo[1]!, kind: "function" } : null;
}

export function findTargetSymbol(
  source: string,
  task: ParsedTask,
  file: string,
  languageId = "python",
): TargetSymbol | null {
  const lines = source.split(/\r?\n/);
  for (let line = task.endLine + 1; line < lines.length; line += 1) {
    const text = lines[line] ?? "";
    if (/^\s*(?:@|#|\/\/|\*|$)/.test(text)) continue;
    const symbol = symbolOnLine(text, languageId);
    if (symbol) return { ...symbol, line, file };
    if (/^\S/.test(text)) return null;
  }
  return null;
}

export function selectedTask(
  text: string,
  startLine: number,
): ParsedTask | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return {
    text: trimmed,
    summary: summarize(trimmed),
    source: "selection",
    startLine,
    endLine: startLine + text.split(/\r?\n/).length - 1,
  };
}

export function taskMarkerFor(languageId: string, text: string): string {
  const body = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const language = languageId.toLowerCase();
  if (language === "python") return ['"""', marker, ...body, '"""'].join("\n");
  const prefix = ["sql", "lua"].includes(language) ? "--" : "//";
  return [
    `${prefix} ${marker}`,
    ...body.map((line) => `${prefix} ${line}`),
  ].join("\n");
}

export type TaskBindingStatus = "unchanged" | "changed" | "missing";

export function classifyTaskBinding(
  source: string,
  activeTask: ParsedTask,
  target: TargetSymbol,
  languageId = "python",
): TaskBindingStatus {
  if (activeTask.source === "selection") {
    const selectedLines = source
      .split(/\r?\n/)
      .slice(activeTask.startLine, activeTask.endLine + 1)
      .join("\n")
      .trim();
    return selectedLines === activeTask.text ? "unchanged" : "changed";
  }
  const associatedTasks = parseTaskCandidates(source).filter((candidate) => {
    const associated = findTargetSymbol(
      source,
      candidate,
      target.file,
      languageId,
    );
    return associated?.name === target.name && associated.kind === target.kind;
  });
  if (associatedTasks.length === 0) return "missing";
  return associatedTasks.some(
    (candidate) =>
      candidate.source === activeTask.source &&
      candidate.text === activeTask.text,
  )
    ? "unchanged"
    : "changed";
}
