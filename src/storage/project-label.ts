export function projectLabel(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) || trimmed || "unknown";
}
