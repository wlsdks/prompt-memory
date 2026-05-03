export function formatRulesFileCount(count: number): string {
  return `${count} rules file${count === 1 ? "" : "s"}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTrendDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function daysAgoDateInput(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
