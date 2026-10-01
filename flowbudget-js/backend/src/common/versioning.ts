import type { DateStr } from './dates.js';

export interface VersionRow {
  id: string;
  lineageId: string;
  activeFrom: DateStr;
  createdAt: Date;
  isDeleted: boolean;
}

const newer = (a: VersionRow, b: VersionRow) =>
  a.activeFrom !== b.activeFrom ? a.activeFrom > b.activeFrom : a.createdAt.getTime() > b.createdAt.getTime();

// The version of a lineage that applies in the given month (null if none yet, or the lineage was deleted).
export function effectiveVersion<T extends VersionRow>(versions: T[], month: DateStr): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (v.activeFrom <= month && (!best || newer(v, best))) best = v;
  }
  return best && !best.isDeleted ? best : null;
}

export function effectiveVersions<T extends VersionRow>(rows: T[], month: DateStr): T[] {
  const byLineage = new Map<string, T[]>();
  for (const row of rows) byLineage.set(row.lineageId, [...(byLineage.get(row.lineageId) ?? []), row]);
  return [...byLineage.values()]
    .map((versions) => effectiveVersion(versions, month))
    .filter((v): v is T => v !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.lineageId.localeCompare(b.lineageId));
}

export function upcomingVersion<T extends VersionRow>(versions: T[], month: DateStr): T | null {
  return versions
    .filter((v) => v.activeFrom > month)
    .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom) || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
}
