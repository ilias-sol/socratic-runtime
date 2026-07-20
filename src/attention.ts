export interface AttentionLineRange {
  start: number;
  end: number;
}

export function currentSymbolLine(
  lines: string[],
  symbolName: string,
  fallbackLine: number,
): number {
  const escapedName = symbolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = new RegExp(
    `^\\s*(?:async\\s+)?(?:def|class)\\s+${escapedName}\\b`,
  );
  const located = lines.findIndex((line) => declaration.test(line));
  return located >= 0 ? located : fallbackLine;
}

export function attentionLineRange(
  lines: string[],
  targetLine: number,
  diagnosticLines: number[],
  recentlyChangedLines: number[],
): AttentionLineRange {
  const lastLine = Math.max(0, lines.length - 1);
  const target = Math.min(Math.max(0, targetLine), lastLine);
  const targetIndent = lines[target]?.match(/^\s*/)?.[0].length ?? 0;
  let targetEnd = Math.min(lastLine, target + 12);
  for (let line = target + 1; line <= lastLine; line += 1) {
    const text = lines[line] ?? "";
    if (!text.trim()) continue;
    const indent = text.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= targetIndent) {
      targetEnd = line - 1;
      break;
    }
    targetEnd = line;
  }

  const inTarget = (line: number) => line >= target && line <= targetEnd;
  const recent = recentlyChangedLines.find(inTarget);
  const diagnostic = diagnosticLines.find(inTarget);
  let start = recent ?? diagnostic ?? target;
  if (recent === undefined && diagnostic === undefined) {
    for (let line = target + 1; line <= targetEnd; line += 1) {
      if (/^\s*(while|for|if)\b/.test(lines[line] ?? "")) {
        start = line;
        break;
      }
    }
  }
  return { start, end: Math.min(targetEnd, start + 2) };
}
