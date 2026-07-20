export function appendBoundedTail(
  current: string,
  chunk: string,
  maximumLength = 16_000,
): string {
  if (maximumLength <= 0) return "";
  const combined = current + chunk;
  return combined.length <= maximumLength
    ? combined
    : combined.slice(-maximumLength);
}
