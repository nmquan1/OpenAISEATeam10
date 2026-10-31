import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaults } from '../../contracts/model.ts';
import { loadEvidenceIndex } from '../../backend/src/evidence/store.ts';
import { retrieveEvidence as legacy } from '../../backend/src/evidence/retrieve-legacy.ts';
import { retrieveEvidence as revised } from '../../backend/src/evidence/retrieve.ts';
import { rankAtK } from './rank-metrics.ts';
import { hash } from './metrics.ts';

export async function main() {
  const cases = JSON.parse(await readFile('data/eval/retrieval-holdout.v1.json', 'utf8')) as {
    version: string;
    scope: string;
    queries: {
      id: string;
      query: string;
      source: string;
      kind: string;
      entity_type: string;
      entity_groups: string[][];
      relevant_ids: string[];
      negative_control: boolean;
    }[];
  };
  const index = await loadEvidenceIndex();
  const rows: (ReturnType<typeof rankAtK> & {
    query_id: string;
    query: string;
    method: 'legacy' | 'revised';
    negative_control: boolean;
    negative_control_pass: boolean | null;
    labels: string[];
    ids: string[];
  })[] = [];
  for (const item of cases.queries) {
    const fullOracle = index.cards
      .filter(
        (card) =>
          card.source_dataset === item.source &&
          card.kind === item.kind &&
          card.entity_type === item.entity_type &&
          item.entity_groups.every((group) =>
            group.some((entity) => card.entity_ids.includes(entity)),
          ),
      )
      .map((card) => card.evidence_id)
      .sort();
    if (JSON.stringify(fullOracle) !== JSON.stringify([...item.relevant_ids].sort()))
      throw new Error(`Oracle mismatch: ${item.id}`);
    for (const [method, retrieve] of [
      ['legacy', legacy],
      ['revised', revised],
    ] as const) {
      const result = await retrieve(
        defaults,
        { seller_notes: '', reference_query: item.query },
        { limit: 5 },
      );
      rows.push({
        query_id: item.id,
        query: item.query,
        method,
        negative_control: item.negative_control,
        negative_control_pass: item.negative_control ? result.items.length === 0 : null,
        labels: result.items.map((card) => card.label),
        ids: result.items.map((card) => card.evidence_id),
        ...rankAtK(
          result.items.map((card) => card.evidence_id),
          Object.fromEntries(fullOracle.map((id) => [id, 1])),
          5,
        ),
      });
    }
  }
  const summary = ['legacy', 'revised'].map((method) => {
    const selected = rows.filter((row) => row.method === method);
    const positive = selected.filter((row) => !row.negative_control);
    const mean = (
      field:
        | 'precision_at_k'
        | 'precision_at_returned'
        | 'recall_at_k'
        | 'ndcg_at_k'
        | 'mrr'
        | 'recall_ceiling_at_k',
    ) => positive.reduce((sum, row) => sum + (row[field] ?? 0), 0) / positive.length;
    return {
      method,
      positive_queries: positive.length,
      negative_controls: selected.length - positive.length,
      negatives_passed: selected.filter((row) => row.negative_control_pass).length,
      precision_at_5: mean('precision_at_k'),
      precision_at_returned: mean('precision_at_returned'),
      recall_at_5: mean('recall_at_k'),
      ndcg_at_5: mean('ndcg_at_k'),
      mrr_at_5: mean('mrr'),
      recall_ceiling_at_5: mean('recall_ceiling_at_k'),
    };
  });
  const report = {
    version: 'retrieval-heldout.v1',
    scope: cases.scope,
    cases_sha256: hash(cases),
    index_sha256: index.indexSha256,
    k: 5,
    summary,
    rows,
    limitations: [
      'Parent-authored synthetic intent labels; implementer did not inspect heldout before freeze, but this is not externally blinded human evaluation.',
      'Macro means over positive queries; empty retrieval scores zero. No-relevance queries assessed separately.',
      'Fixed-K precision counts missing slots as misses. Geometry has 96 relevant cards: recall ceiling at five is 5/96, not one.',
    ],
  };
  await mkdir('.local/methods-retrieval', { recursive: true });
  await writeFile('.local/methods-retrieval/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  return report;
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) await main();
