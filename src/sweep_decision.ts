export type Matter = { id: string; client: string; signedAt?: string; followUpDue: string; documentKey?: string };

export function staleMatters(matters: Matter[], now: Date): Matter[] {
  return matters.filter((matter) => new Date(matter.followUpDue).getTime() < now.getTime());
}
