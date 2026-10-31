import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const object = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });
const text = (maximum = 500) => Type.String({ minLength: 1, maxLength: maximum });
const identifier = Type.String({ pattern: '^[A-Za-z0-9_-]{8,128}$' });
const arm = Type.Union([Type.Literal('control'), Type.Literal('treatment')]);
export const PilotAssignmentSchema = object({
  exposure_id: identifier,
  arm,
  eligible: Type.Boolean(),
});
export const PilotExposureSchema = object({
  exposure_id: identifier,
  arm,
  eligible: Type.Boolean(),
  exposed: Type.Boolean(),
  converted: Type.Boolean(),
  net_profit_dong: Type.Integer({ minimum: -1_000_000_000_000, maximum: 1_000_000_000_000 }),
  cost_basis_version: text(100),
});
export const PilotEpisodeSchema = object({
  schema_version: Type.Literal('merchant-pilot.v1'),
  episode_id: identifier,
  campaign_id: Type.Optional(text(100)),
  data_origin: Type.Union([Type.Literal('merchant_observed'), Type.Literal('synthetic_test')]),
  currency: Type.Literal('VND'),
  assignment_unit: Type.Literal('customer'),
  assignment_method: Type.Literal('randomized'),
  eligibility_timing: Type.Literal('before_assignment'),
  assignment_registry_complete: Type.Literal(true),
  post_assignment_exclusions: Type.Literal(0),
  outcome_window_days: Type.Integer({ minimum: 1, maximum: 365 }),
  returns_finalized: Type.Literal(true),
  cost_basis: object({ version: text(100), definition: text(4000) }),
  assignments: Type.Array(PilotAssignmentSchema, { minItems: 4, maxItems: 1_000_000 }),
  rows: Type.Array(PilotExposureSchema, { minItems: 4, maxItems: 1_000_000 }),
});
export type PilotEpisode = Static<typeof PilotEpisodeSchema>;
export type PilotExposure = Static<typeof PilotExposureSchema>;
export function parsePilotEpisode(value: unknown): PilotEpisode {
  if (!Value.Check(PilotEpisodeSchema, value)) {
    const first = [...Value.Errors(PilotEpisodeSchema, value)][0];
    throw new Error(
      `Invalid pilot episode: ${first?.path ?? '/'} ${first?.message ?? 'schema mismatch'}`,
    );
  }
  const assignments = new Map<string, Static<typeof PilotAssignmentSchema>>();
  for (const assignment of value.assignments) {
    if (assignments.has(assignment.exposure_id))
      throw new Error('Duplicate assignment exposure_id');
    if (!assignment.eligible)
      throw new Error(
        'Assignment cohort must be eligible before assignment; do not filter post-treatment',
      );
    assignments.set(assignment.exposure_id, assignment);
  }
  const outcomes = new Set<string>();
  for (const row of value.rows) {
    if (outcomes.has(row.exposure_id)) throw new Error('Duplicate outcome exposure_id');
    outcomes.add(row.exposure_id);
    const assignment = assignments.get(row.exposure_id);
    if (!assignment) throw new Error('Outcome has no registered assignment');
    if (assignment.arm !== row.arm)
      throw new Error('Outcome arm differs from registered assignment');
    if (!row.eligible) throw new Error('Post-assignment eligibility exclusions are forbidden');
    if (row.cost_basis_version !== value.cost_basis.version)
      throw new Error('Mixed or incorrect cost basis version');
  }
  if (outcomes.size !== assignments.size)
    throw new Error(
      'Missing outcome for assigned customer; never drop unexposed or nonconverting customers',
    );
  for (const group of ['control', 'treatment'])
    if (value.rows.filter((row) => row.arm === group).length < 2)
      throw new Error('At least two assigned customers per arm are required');
  return value;
}
