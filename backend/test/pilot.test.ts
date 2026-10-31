import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePilot } from '../../scripts/evaluation/pilot.ts';
import { parsePilotEpisode, type PilotEpisode } from '../../contracts/pilot.ts';

function synthetic(): PilotEpisode {
  const rows = [
    ...[-10, 0, 0, 110].map((profit, index) => ({
      exposure_id: `control_${index}`,
      arm: 'control' as const,
      eligible: true,
      exposed: false,
      converted: index === 3,
      net_profit_dong: profit,
      cost_basis_version: 'synthetic-v1',
    })),
    ...[0, 100, 100, 200].map((profit, index) => ({
      exposure_id: `treatmnt_${index}`,
      arm: 'treatment' as const,
      eligible: true,
      exposed: index !== 0,
      converted: index !== 0,
      net_profit_dong: profit,
      cost_basis_version: 'synthetic-v1',
    })),
  ];
  return {
    schema_version: 'merchant-pilot.v1',
    episode_id: 'synthetic_known',
    data_origin: 'synthetic_test',
    currency: 'VND',
    assignment_unit: 'customer',
    assignment_method: 'randomized',
    eligibility_timing: 'before_assignment',
    assignment_registry_complete: true,
    post_assignment_exclusions: 0,
    outcome_window_days: 30,
    returns_finalized: true,
    cost_basis: {
      version: 'synthetic-v1',
      definition: 'Synthetic demonstration only, final net receipts minus all costs and returns.',
    },
    assignments: rows.map(({ exposure_id, arm, eligible }) => ({ exposure_id, arm, eligible })),
    rows,
  };
}
test('synthetic known difference keeps nonexposed and nonconverters in assigned denominators', () => {
  const report = analyzePilot(synthetic());
  assert.equal(report.status, 'synthetic_validation_only');
  assert.equal(report.treatment.assigned_customers, 4);
  assert.equal(report.treatment.exposed_customers, 3);
  assert.equal(report.control.net_profit_dong, 100);
  assert.equal(report.treatment.net_profit_dong, 400);
  assert.equal(report.control.conversion_rate, 0.25);
  assert.equal(report.treatment_minus_control.conversion_rate.estimate, 0.5);
  assert.equal(report.treatment_minus_control.conversion_percentage_points, 50);
  assert.equal(report.treatment_minus_control.relative_conversion_lift, 2);
  assert.equal(report.treatment_minus_control.net_profit_dong_per_assigned_customer.estimate, 75);
  assert.ok(
    Math.abs(report.treatment_minus_control.conversion_rate.standard_error - Math.sqrt(0.125)) <
      1e-12,
  );
  assert.equal(report.normal_approximation_concern, true);
  assert.equal(report.causal_claim_verified, false);
});
test('synthetic null outcome and zero baseline conversion have defined absolute effects, undefined relative lift', () => {
  const input = synthetic();
  for (const row of input.rows) {
    row.converted = false;
    row.net_profit_dong = 0;
  }
  const report = analyzePilot(input);
  assert.equal(report.treatment_minus_control.conversion_rate.estimate, 0);
  assert.equal(report.treatment_minus_control.relative_conversion_lift, null);
  assert.equal(report.treatment_minus_control.net_profit_dong_per_assigned_customer.estimate, 0);
  assert.equal(report.normal_approximation_concern, true);
});
test('reject duplicates, absent assignments, missing outcomes, cross-arm changes and post-treatment exclusions', () => {
  const duplicateOutcome = synthetic();
  duplicateOutcome.rows.push(duplicateOutcome.rows[0]!);
  assert.throws(() => analyzePilot(duplicateOutcome), /Duplicate outcome/);
  const duplicateAssignment = synthetic();
  duplicateAssignment.assignments.push(duplicateAssignment.assignments[0]!);
  assert.throws(() => analyzePilot(duplicateAssignment), /Duplicate assignment/);
  const missingAssignment = synthetic();
  missingAssignment.assignments[0]!.exposure_id = 'unmatched_999';
  assert.throws(() => analyzePilot(missingAssignment), /no registered assignment/);
  const missingOutcome = synthetic();
  missingOutcome.rows.pop();
  assert.throws(() => analyzePilot(missingOutcome), /Missing outcome/);
  const switched = synthetic();
  switched.rows[0]!.arm = 'treatment';
  assert.throws(() => analyzePilot(switched), /differs from registered assignment/);
  const excluded = synthetic();
  excluded.rows[0]!.eligible = false;
  assert.throws(() => analyzePilot(excluded), /Post-assignment eligibility/);
  assert.throws(
    () => analyzePilot({ ...synthetic(), post_assignment_exclusions: 1 }),
    /Invalid pilot episode/,
  );
});
test('strict contract rejects missing arm, floats, mixed accounting, unfinished returns and insufficient arm size', () => {
  const missingArm = synthetic();
  delete (missingArm.rows[0] as { arm?: string }).arm;
  assert.throws(() => parsePilotEpisode(missingArm), /Invalid pilot episode/);
  const floatMoney = synthetic();
  floatMoney.rows[0]!.net_profit_dong = 1.5;
  assert.throws(() => analyzePilot(floatMoney), /Invalid pilot episode/);
  const mixed = synthetic();
  mixed.rows[0]!.cost_basis_version = 'different';
  assert.throws(() => analyzePilot(mixed), /cost basis/);
  assert.throws(
    () => analyzePilot({ ...synthetic(), returns_finalized: false }),
    /Invalid pilot episode/,
  );
  const smallArm = synthetic();
  for (let index = 0; index < 3; index++) {
    smallArm.rows[index]!.arm = 'treatment';
    smallArm.assignments[index]!.arm = 'treatment';
  }
  assert.throws(() => analyzePilot(smallArm), /At least two/);
  assert.throws(
    () => analyzePilot({ ...synthetic(), customer_email: 'do-not-export@example.test' }),
    /Invalid pilot episode/,
  );
});
