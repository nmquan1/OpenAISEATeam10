import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const text = (maximum = 1000) => Type.String({ minLength: 1, maxLength: maximum });
const hash = Type.String({ pattern: '^[a-f0-9]{64}$' });
const nullableText = Type.Union([text(200), Type.Null()]);
const object = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

/** Source-native historical observations; never merchant forecasts or calibrated causal effects. */
export const EvidenceCardSchema = object({
  evidence_id: text(400),
  kind: Type.Union(
    (['profile', 'association', 'voucher_geometry', 'basket'] as const).map((kind) =>
      Type.Literal(kind),
    ),
  ),
  source_dataset: Type.Union([
    Type.Literal('uci_online_retail_ii'),
    Type.Literal('completejourney'),
  ]),
  entity_type: Type.Union(
    (['product', 'category', 'basket', 'voucher'] as const).map((kind) => Type.Literal(kind)),
  ),
  entity_ids: Type.Array(text(300), { maxItems: 2 }),
  label: text(500),
  summary: text(2000),
  metrics: Type.Record(
    Type.String(),
    Type.Union([Type.String({ maxLength: 500 }), Type.Number(), Type.Null()]),
  ),
  population: Type.Record(
    Type.String(),
    Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  ),
  money_unit: Type.Union([Type.Literal('GBP'), Type.Literal('dollar_unspecified')]),
  amount_basis: text(200),
  time_basis: text(200),
  source_url: text(500),
  evidence_scope: text(200),
  limitations: Type.Array(text(1000), { minItems: 1, maxItems: 12 }),
  lineage: object({ file: text(200), row_id: text(100), sha256: hash }),
  dataset_version: text(200),
  feature_version: text(200),
});
export type EvidenceCard = Static<typeof EvidenceCardSchema>;

export const RetrievalResultSchema = object({
  enabled: Type.Boolean(),
  status: Type.Union(
    (['disabled', 'no_match', 'matched', 'unavailable'] as const).map((status) =>
      Type.Literal(status),
    ),
  ),
  dataset_version: nullableText,
  index_sha256: Type.Union([hash, Type.Null()]),
  retrieval_version: text(200),
  query: Type.String({ maxLength: 1000 }),
  items: Type.Array(EvidenceCardSchema, { maxItems: 6 }),
});
export type RetrievalResult = Static<typeof RetrievalResultSchema>;

export function parseEvidenceCard(value: unknown): EvidenceCard {
  if (!Value.Check(EvidenceCardSchema, value)) throw new Error('Invalid decision evidence card');
  return value;
}
export function parseRetrievalResult(value: unknown): RetrievalResult {
  if (!Value.Check(RetrievalResultSchema, value))
    throw new Error('Invalid decision evidence retrieval result');
  if ((value.status === 'matched') !== value.items.length > 0)
    throw new Error('Evidence retrieval status must agree with returned items');
  if (
    (!value.enabled && value.status !== 'disabled') ||
    (value.enabled && value.status === 'disabled')
  )
    throw new Error('Evidence retrieval status must agree with enabled flag');
  return value;
}
