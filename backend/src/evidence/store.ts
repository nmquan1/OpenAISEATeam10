import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceCard, type EvidenceCard } from '../../../contracts/evidence.ts';

export interface EvidenceIndex {
  datasetVersion: string;
  indexSha256: string;
  cards: readonly EvidenceCard[];
}
const evidenceRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'data/evidence');
const MAX_PACK_BYTES = 20 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const cache = new Map<string, Promise<EvidenceIndex>>();

/** Validate the immutable artifact once per process. A failed load never supplies partial evidence. */
export function loadEvidenceIndex(directory = evidenceRoot): Promise<EvidenceIndex> {
  const absolute = resolve(directory);
  let loading = cache.get(absolute);
  if (!loading) {
    loading = readEvidenceIndex(absolute);
    cache.set(absolute, loading);
    // Permit a later retry after a missing/corrupt pack is repaired, without an unhandled rejection.
    void loading.catch(() => cache.delete(absolute));
  }
  return loading;
}

export async function readEvidenceIndex(directory: string): Promise<EvidenceIndex> {
  const manifestPath = resolve(directory, 'manifest.json');
  const indexPath = resolve(directory, 'decision_evidence.jsonl');
  const [manifestStat, indexStat] = await Promise.all([stat(manifestPath), stat(indexPath)]);
  if (manifestStat.size > 128 * 1024 || indexStat.size > MAX_PACK_BYTES)
    throw new Error('Evidence pack exceeds supported size');
  const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid evidence manifest');
  const info = manifest as Record<string, unknown>;
  const index = info.index as Record<string, unknown> | undefined;
  if (
    info.schema_version !== '1.0' ||
    typeof info.dataset_version !== 'string' ||
    !info.dataset_version ||
    !Number.isSafeInteger(info.record_count) ||
    (info.record_count as number) < 1 ||
    (info.record_count as number) > 10000 ||
    !index ||
    index.file !== 'decision_evidence.jsonl' ||
    typeof index.sha256 !== 'string' ||
    !SHA256.test(index.sha256) ||
    index.bytes !== indexStat.size
  )
    throw new Error('Invalid evidence manifest');
  const bytes = await readFile(indexPath);
  if (createHash('sha256').update(bytes).digest('hex') !== index.sha256)
    throw new Error('Evidence checksum mismatch');
  const cards = bytes
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .map((line) => parseEvidenceCard(JSON.parse(line)));
  if (cards.length !== info.record_count) throw new Error('Evidence count mismatch');
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.evidence_id) || card.dataset_version !== info.dataset_version)
      throw new Error('Evidence identity/version mismatch');
    ids.add(card.evidence_id);
  }
  return { datasetVersion: info.dataset_version, indexSha256: index.sha256, cards };
}
