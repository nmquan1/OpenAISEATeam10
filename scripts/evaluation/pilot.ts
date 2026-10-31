import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePilotEpisode, type PilotExposure } from '../../contracts/pilot.ts';
import { hash } from './metrics.ts';

function exactNumber(value: bigint): number {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric))
    throw new Error('Pilot aggregate exceeds exact supported integer range');
  return numeric;
}
function describe(rows: PilotExposure[]) {
  const n = rows.length;
  const profits = rows.map((row) => BigInt(row.net_profit_dong));
  const total = profits.reduce((sum, value) => sum + value, 0n);
  const squares = profits.reduce((sum, value) => sum + value * value, 0n);
  const converted = rows.filter((row) => row.converted).length;
  const conversionRate = converted / n;
  // Exact integer numerator avoids cancellation before the final floating-point variance calculation.
  const variance = Number(BigInt(n) * squares - total * total) / (n * (n - 1));
  return {
    assigned_customers: n,
    exposed_customers: rows.filter((row) => row.exposed).length,
    converted_customers: converted,
    nonconverted_customers: n - converted,
    conversion_rate: conversionRate,
    net_profit_dong: exactNumber(total),
    mean_net_profit_dong_per_assigned_customer: exactNumber(total) / n,
    sample_profit_variance: variance,
    sample_conversion_variance: (conversionRate * (1 - conversionRate) * n) / (n - 1),
  };
}
function difference(
  treatmentMean: number,
  controlMean: number,
  treatmentVariance: number,
  controlVariance: number,
  treatmentN: number,
  controlN: number,
) {
  const estimate = treatmentMean - controlMean;
  const standardError = Math.sqrt(treatmentVariance / treatmentN + controlVariance / controlN);
  return {
    estimate,
    standard_error: standardError,
    descriptive_normal_95_interval: {
      lower: estimate - 1.959963984540054 * standardError,
      upper: estimate + 1.959963984540054 * standardError,
    },
    interval_method: 'unpooled sample-variance normal approximation; not a small-sample guarantee',
  };
}
export function analyzePilot(raw: unknown) {
  const episode = parsePilotEpisode(raw);
  const control = describe(episode.rows.filter((row) => row.arm === 'control'));
  const treatment = describe(episode.rows.filter((row) => row.arm === 'treatment'));
  const conversion = difference(
    treatment.conversion_rate,
    control.conversion_rate,
    treatment.sample_conversion_variance,
    control.sample_conversion_variance,
    treatment.assigned_customers,
    control.assigned_customers,
  );
  const profit = difference(
    treatment.mean_net_profit_dong_per_assigned_customer,
    control.mean_net_profit_dong_per_assigned_customer,
    treatment.sample_profit_variance,
    control.sample_profit_variance,
    treatment.assigned_customers,
    control.assigned_customers,
  );
  const approximationConcern = [control, treatment].some(
    (arm) =>
      arm.assigned_customers < 30 || arm.converted_customers < 5 || arm.nonconverted_customers < 5,
  );
  return {
    report_version: 'merchant-pilot-analysis.v1',
    episode_id: episode.episode_id,
    campaign_id: episode.campaign_id ?? null,
    dataset_sha256: hash(episode),
    assignment_registry_sha256: hash(episode.assignments),
    data_origin: episode.data_origin,
    status:
      episode.data_origin === 'synthetic_test'
        ? 'synthetic_validation_only'
        : 'observed_pilot_descriptive',
    independent_data_verification: false,
    currency: 'VND',
    estimand:
      'intention-to-treat per assigned eligible customer over the prespecified outcome window',
    outcome_window_days: episode.outcome_window_days,
    returns_finalized: episode.returns_finalized,
    cost_basis: episode.cost_basis,
    control,
    treatment,
    treatment_minus_control: {
      conversion_rate: conversion,
      conversion_percentage_points: conversion.estimate * 100,
      relative_conversion_lift:
        control.conversion_rate > 0 ? conversion.estimate / control.conversion_rate : null,
      net_profit_dong_per_assigned_customer: profit,
    },
    normal_approximation_concern: approximationConcern,
    causal_claim_verified: false,
    assumptions: [
      'Independent random assignment at customer level; one row per customer, no interference or cross-arm exposure contamination.',
      'The assignment registry was complete before outcomes were observed; eligibility was fixed before assignment.',
      'Equal prespecified observation windows and comparable finalized return/cost accounting in both arms.',
      'Independent sampling and finite variance for the descriptive standard errors; normal intervals may be unreliable with small groups, rare conversions or skewed profit.',
    ],
    limitations: [
      'These metadata assertions do not prove actual randomization, completeness or absence of hidden exclusions. Reconcile against the original assignment ledger.',
      'n >= 2 permits variance calculation, not adequate experimental power. Boundary conversion rates can yield zero estimated variance; this is not certainty.',
      'No model fitting, response-curve change, projection to total merchant profit or causal uplift claim is performed.',
      'Do not stop the experiment when results first look favorable; predefine duration, sample size and analysis before enrollment.',
    ],
  };
}
export async function main(args = process.argv.slice(2)) {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (
      !['--input', '--output'].includes(flag) ||
      !args[index + 1] ||
      args[index + 1]!.startsWith('--')
    )
      throw new Error('Usage: pilot.ts --input episode.json [--output .local/pilot-report.json]');
    flags[flag] = args[++index]!;
  }
  if (!flags['--input'])
    throw new Error(
      'Provide --input with actual episode data or an explicitly synthetic test fixture',
    );
  const report = analyzePilot(JSON.parse(await readFile(resolve(flags['--input']), 'utf8')));
  const output = resolve(flags['--output'] ?? '.local/pilot-report.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      output,
      status: report.status,
      assigned_customers: report.control.assigned_customers + report.treatment.assigned_customers,
      normal_approximation_concern: report.normal_approximation_concern,
    }),
  );
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Pilot analysis failed');
    process.exitCode = 1;
  });
