import { parse } from 'csv-parse/sync';
import { Type } from '@sinclair/typebox';
import {
  defaults,
  normalizeCampaignLabel,
  HistoricalSummarySchema,
  parseRecommendationRequest,
  ValidationError,
  type RecommendationRequest,
} from '../../../contracts/model.ts';

export const HistoryValidationRequestSchema = Type.Object(
  { csv: Type.String({ minLength: 1, maxLength: 32_768 }) },
  { additionalProperties: false },
);
export const HistoryValidationResultSchema = HistoricalSummarySchema;
type History = NonNullable<RecommendationRequest['context']['history']>;
const headers = ['label', 'visits', 'orders', 'revenue_dong', 'voucher_spend_dong'] as const;
/** CSV is user-reported aggregate evidence, never a calibrated demand model. */
export function validateHistoryCsv(body: unknown): History {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).join() !== 'csv' ||
    typeof (body as { csv?: unknown }).csv !== 'string'
  )
    throw new ValidationError('Expected {csv:string}');
  const csv = (body as { csv: string }).csv;
  if (Buffer.byteLength(csv, 'utf8') > 32_768 || csv.length === 0)
    throw new ValidationError('CSV must contain 1..32768 UTF-8 bytes');
  let rows: string[][];
  try {
    rows = parse(csv, {
      bom: true,
      columns: false,
      skip_empty_lines: false,
      relax_column_count: false,
      max_record_size: 32_768,
      cast: false,
    }) as string[][];
  } catch {
    throw new ValidationError('Malformed CSV: check quoting, row lengths and delimiters');
  }
  if (rows.length < 2 || rows.length > 21)
    throw new ValidationError('CSV requires a header and 1..20 campaign rows');
  if (rows[0]!.join(',') !== headers.join(','))
    throw new ValidationError(`CSV headers must be exactly ${headers.join(',')}`);
  const seen = new Set<string>();
  const campaigns = rows.slice(1).map((row, index) => {
    const line = index + 2;
    if (row.length !== headers.length)
      throw new ValidationError(`CSV row ${line}: expected five columns`);
    let label: string;
    try {
      label = normalizeCampaignLabel(row[0]!);
    } catch {
      throw new ValidationError(`CSV row ${line}: invalid campaign label`);
    }
    const normalized = label.toLocaleLowerCase('vi');
    if (seen.has(normalized))
      throw new ValidationError(`CSV row ${line}: duplicate campaign label`);
    seen.add(normalized);
    const values = row.slice(1).map((cell, column) => {
      if (!/^(0|[1-9]\d*)$/.test(cell))
        throw new ValidationError(
          `CSV row ${line}: ${headers[column + 1]} requires an explicit nonnegative integer; blank is not zero`,
        );
      const value = Number(cell);
      const maximum = column < 2 ? 100_000_000 : 1_000_000_000_000;
      if (!Number.isSafeInteger(value) || value > maximum)
        throw new ValidationError(
          `CSV row ${line}: ${headers[column + 1]} exceeds supported range`,
        );
      return value;
    });
    if (values[1]! > values[0]!)
      throw new ValidationError(`CSV row ${line}: orders must not exceed visits`);
    return {
      label,
      visits: values[0]!,
      orders: values[1]!,
      revenue_dong: values[2]!,
      voucher_spend_dong: values[3]!,
    };
  });
  return parseRecommendationRequest({
    input: defaults,
    context: { seller_notes: '', history: { source: 'user_reported', campaigns } },
  }).context.history!;
}
