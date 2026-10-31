import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaults } from '../../contracts/model.ts';
import type { EvidenceCard } from '../../contracts/evidence.ts';
import { loadEvidenceIndex } from '../../backend/src/evidence/store.ts';
import { retrieveEvidence } from '../../backend/src/evidence/retrieve.ts';

export interface RelevanceRule {
  source_dataset: EvidenceCard['source_dataset'];
  kinds: EvidenceCard['kind'][];
  entity_type: EvidenceCard['entity_type'];
  entity_groups: string[][];
}
interface Qrels {
  version: string;
  scope: string;
  index_sha256: string;
  corpus_count: number;
  limitations: string[];
  queries: {
    id: string;
    query: string;
    negative_control: boolean;
    relevance_definition: string;
    rule: RelevanceRule;
    relevant_ids: string[];
  }[];
}

/** Independent binary judgement: no retrieval tokenization, aliases or scores are used. */
export function relevanceMatches(card: EvidenceCard, rule: RelevanceRule): boolean {
  return (
    card.source_dataset === rule.source_dataset &&
    rule.kinds.includes(card.kind) &&
    card.entity_type === rule.entity_type &&
    rule.entity_groups.every((alternatives) =>
      alternatives.some((entity) => card.entity_ids.includes(entity)),
    )
  );
}

export function retrievalMetrics(retrievedIds: string[], relevantIds: readonly string[]) {
  if (retrievedIds.length > 6 || new Set(retrievedIds).size !== retrievedIds.length)
    throw new Error('Expected at most six distinct retrieved IDs');
  const relevant = new Set(relevantIds);
  const labels = retrievedIds.map((id) => (relevant.has(id) ? 1 : 0));
  const hits = labels.reduce<number>((sum, label) => sum + label, 0);
  const idealDcg = Array.from(
    { length: Math.min(6, relevant.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((sum, gain) => sum + gain, 0);
  return {
    retrieved_count: retrievedIds.length,
    relevant_count: relevant.size,
    relevant_retrieved_count: hits,
    relevance_at_rank: labels,
    precision_at_actual_k: relevant.size
      ? retrievedIds.length
        ? hits / retrievedIds.length
        : 0
      : null,
    precision_at_6: relevant.size ? hits / 6 : null,
    recall_at_6: relevant.size ? hits / relevant.size : null,
    ndcg_at_6: relevant.size
      ? labels.reduce<number>((sum, label, rank) => sum + label / Math.log2(rank + 2), 0) / idealDcg
      : null,
  };
}

export async function runRetrievalAudit(
  qrelsFile = 'data/eval/retrieval-qrels.v1.json',
  outputDirectory = '.local/retrieval-audit',
) {
  const bytes = await readFile(resolve(qrelsFile));
  const qrels = JSON.parse(bytes.toString('utf8')) as Qrels;
  const index = await loadEvidenceIndex();
  if (
    qrels.version !== 'retrieval-qrels.v1' ||
    qrels.index_sha256 !== index.indexSha256 ||
    qrels.corpus_count !== index.cards.length ||
    !Array.isArray(qrels.queries) ||
    !qrels.queries.length ||
    new Set(qrels.queries.map((query) => query.id)).size !== qrels.queries.length
  )
    throw new Error('Invalid qrels or corpus snapshot mismatch');
  const rows = [];
  for (const query of qrels.queries) {
    // Scan ALL cards before calling retrieval; oracle membership does not depend on returned results.
    const relevantIds = index.cards
      .filter((card) => relevanceMatches(card, query.rule))
      .map((card) => card.evidence_id)
      .sort();
    if (JSON.stringify(relevantIds) !== JSON.stringify([...query.relevant_ids].sort()))
      throw new Error(`Stored qrels disagree with exhaustive oracle: ${query.id}`);
    if (query.negative_control !== (relevantIds.length === 0))
      throw new Error(`Empty oracle must be an explicit negative control: ${query.id}`);
    const result = await retrieveEvidence(defaults, {
      seller_notes: '',
      reference_query: query.query,
    });
    if (result.status === 'unavailable' || result.index_sha256 !== index.indexSha256)
      throw new Error(`Retrieval index unavailable or changed: ${query.id}`);
    const retrievedIds = result.items.map((card) => card.evidence_id);
    rows.push({
      query_id: query.id,
      query: query.query,
      negative_control: query.negative_control,
      relevance_definition: query.relevance_definition,
      rule: query.rule,
      oracle_scanned_count: index.cards.length,
      relevant_ids: relevantIds,
      retrieved_ids: retrievedIds,
      retrieved_labels: result.items.map((card) => card.label),
      status: result.status,
      retrieval_version: result.retrieval_version,
      ...retrievalMetrics(retrievedIds, relevantIds),
      negative_control_pass: query.negative_control ? retrievedIds.length === 0 : null,
    });
  }
  const positive = rows.filter((row) => !row.negative_control);
  const mean = (key: 'precision_at_actual_k' | 'precision_at_6' | 'recall_at_6' | 'ndcg_at_6') =>
    positive.length
      ? positive.reduce((sum, row) => sum + (row[key] ?? 0), 0) / positive.length
      : null;
  const report = {
    version: 'retrieval-audit.v1',
    created_at: new Date().toISOString(),
    qrels_file: qrelsFile,
    qrels_version: qrels.version,
    qrels_sha256: createHash('sha256').update(bytes).digest('hex'),
    dataset_version: index.datasetVersion,
    index_sha256: index.indexSha256,
    corpus_count: index.cards.length,
    paid_calls: 0,
    scope: qrels.scope,
    metric_conventions: {
      precision_at_actual_k:
        'Relevant returned / actual returned; zero for no return on a positive query.',
      precision_at_6: 'Relevant returned / 6; unfilled slots count as misses.',
      recall_at_6:
        'Relevant returned / all relevant corpus IDs; record-level, not payout-equivalence groups.',
      ndcg_at_6: 'Binary gain with log2(rank + 1) discount; ideal has min(6, total relevant) hits.',
      zero_relevance:
        'All four metrics null; negative controls evaluated separately for empty retrieval.',
      aggregation:
        'Unweighted macro mean over positive queries only; aliases are correlated observations.',
    },
    summary: {
      query_count: rows.length,
      positive_queries: positive.length,
      negative_controls: rows.length - positive.length,
      negative_controls_passed: rows.filter((row) => row.negative_control_pass).length,
      macro_precision_at_actual_k: mean('precision_at_actual_k'),
      macro_precision_at_6: mean('precision_at_6'),
      macro_recall_at_6: mean('recall_at_6'),
      macro_ndcg_at_6: mean('ndcg_at_6'),
    },
    limitations: qrels.limitations,
    rows,
  };
  const destination = resolve(outputDirectory, `${report.created_at.replaceAll(':', '-')}`);
  await mkdir(destination, { recursive: true });
  await writeFile(resolve(destination, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: resolve(destination, 'report.json'), ...report.summary }));
  return report;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const args = process.argv.slice(2);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !['--qrels', '--output'].includes(key) || !value || value.startsWith('--'))
      throw new Error(
        'Usage: tsx scripts/evaluation/retrieval-audit.ts [--qrels PATH] [--output DIR]',
      );
    values[key] = value;
  }
  await runRetrievalAudit(values['--qrels'], values['--output']);
}
