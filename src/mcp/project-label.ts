export function projectLabel(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "project";
}
