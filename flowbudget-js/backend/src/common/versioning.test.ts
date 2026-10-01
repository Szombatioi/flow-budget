import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveVersion, effectiveVersions, upcomingVersion, type VersionRow } from './versioning.js';

const row = (id: string, lineageId: string, activeFrom: string, createdAt = 0, isDeleted = false): VersionRow => ({
  id,
  lineageId,
  activeFrom,
  createdAt: new Date(createdAt),
  isDeleted,
});

test('picks the latest version started by the month', () => {
  const versions = [row('v1', 'a', '2026-01-01'), row('v2', 'a', '2026-03-01'), row('v3', 'a', '2026-06-01')];
  assert.equal(effectiveVersion(versions, '2026-02-01')?.id, 'v1');
  assert.equal(effectiveVersion(versions, '2026-03-01')?.id, 'v2');
  assert.equal(effectiveVersion(versions, '2025-12-01'), null);
  assert.equal(upcomingVersion(versions, '2026-03-01')?.id, 'v3');
});

test('ties within a month are broken by creation time', () => {
  const versions = [row('old', 'a', '2026-03-01', 1), row('new', 'a', '2026-03-01', 2)];
  assert.equal(effectiveVersion(versions, '2026-04-01')?.id, 'new');
});

test('a tombstone ends the lineage but keeps earlier months', () => {
  const versions = [row('v1', 'a', '2026-01-01'), row('end', 'a', '2026-05-01', 0, true)];
  assert.equal(effectiveVersion(versions, '2026-04-01')?.id, 'v1');
  assert.equal(effectiveVersion(versions, '2026-05-01'), null);
});

test('groups by lineage', () => {
  const rows = [row('a1', 'a', '2026-01-01'), row('b1', 'b', '2026-01-01', 5), row('a2', 'a', '2026-02-01')];
  assert.deepEqual(effectiveVersions(rows, '2026-02-01').map((r) => r.id).sort(), ['a2', 'b1']);
});
