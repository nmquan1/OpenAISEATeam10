"""Freeze audited aggregate features as reproducible, source-native decision evidence.

Usage: python3 scripts/evidence/build.py --source /path/to/market-maker-dataset
Never reads raw transaction/customer archives and never changes source artifacts.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

VERSION = 'decision-evidence.v1'
FILES = ['decision_features.csv', 'associations.csv', 'voucher_geometry.csv', 'basket_profiles.csv']
SOURCE_INFO = {
    'uci_online_retail_ii': {
        'money_unit': 'GBP', 'amount_basis': 'retained_product_subtotal_proxy',
        'time_basis': 'source_invoice_datetime',
        'source_url': 'https://archive.ics.uci.edu/dataset/502/online+retail+ii',
        'license': 'CC BY 4.0',
        'attribution': 'Chen, D. (2012). Online Retail II. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D',
        'scope': 'UK gift retailer, 2009–2011; customer residence is not merchant market.',
    },
    'completejourney': {
        'money_unit': 'dollar_unspecified', 'amount_basis': 'retailer_receipts',
        'time_basis': 'rebased_2017_derived_seconds',
        'source_url': 'https://bradleyboehmke.github.io/completejourney/',
        'license': 'CC0 declared by completejourney data package; separate retired upstream terms unresolved',
        'attribution': 'completejourney data package, Brad Boehmke and Steven M. Mortimer; upstream Complete Journey 2.0 / 84.51 degrees.',
        'scope': 'Grocery categories; dollar ISO currency unverified; dates rebased.',
    },
}
COMMON_LIMITS = [
    'Foreign historical subset; no automatic merchant/entity matching or currency conversion.',
    'No causal/forecast claims. Keep merchant costs, funding, stock, budget and response curve unchanged.',
]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def rows(path):
    with path.open(encoding='utf-8', newline='') as stream:
        yield from csv.DictReader(stream)


def metrics(row, keys):
    # Preserve decimal text exactly; unavailable never becomes zero.
    return {key: row[key] if row[key] != '' else None for key in keys}


def population(row, keys):
    return {key: int(row[key]) for key in keys if row[key] != ''}


def card(row, filename, line, hashes, dataset_version):
    source = row.get('source_dataset') or row['source']
    info = SOURCE_INFO[source]
    result = {
        'source_dataset': source,
        'money_unit': info['money_unit'],
        'amount_basis': row.get('amount_basis') or row.get('basket_value_basis') or info['amount_basis'],
        'time_basis': row.get('time_basis') or info['time_basis'],
        'source_url': info['source_url'],
        'evidence_scope': row['evidence_scope'],
        'limitations': [*COMMON_LIMITS, info['scope']],
        'lineage': {'file': 'features/' + filename, 'row_id': str(line), 'sha256': hashes[filename]},
        'dataset_version': dataset_version,
        'feature_version': VERSION,
    }
    if filename == 'decision_features.csv':
        result.update(
            evidence_id=row['evidence_id'], kind='profile', entity_type=row['entity_type'],
            entity_ids=[row['entity_id']], label=row['label'],
            summary=f"{row['label']} occurs in {row['sample_baskets']} of {row['source_eligible_baskets']} eligible sampled baskets; historical descriptive profile.",
            population=population(row, ['sample_baskets', 'source_eligible_baskets', 'active_relative_weeks', 'source_relative_weeks', 'early_entity_baskets', 'early_source_baskets', 'late_entity_baskets', 'late_source_baskets', 'unit_price_comparable_baskets']),
            metrics=metrics(row, ['historical_sample_basket_share', 'sample_active_week_fraction', 'early_basket_share', 'late_basket_share', 'late_to_early_basket_share_ratio', 'presence_stable_within_factor_two', 'peak_week_share_of_entity_baskets', 'single_product_basket_share', 'basket_products_p50', 'entity_amount_share_p50', 'containing_basket_amount_p25', 'containing_basket_amount_p50', 'containing_basket_amount_p75', 'historical_unit_price_p25', 'historical_unit_price_p50', 'historical_unit_price_p75', 'loyalty_discount_basket_share', 'manufacturer_coupon_basket_share', 'retailer_match_basket_share', 'positive_loyalty_discount_amount_p50']),
        )
        result['limitations'].append('Quantiles interpolate; source boundary weeks may be partial. Discount components are not headline voucher rate, cap or seller funding.')
    elif filename == 'associations.csv':
        identity = json.dumps([source, row['antecedent_id'], row['consequent_id']], ensure_ascii=False, separators=(',', ':'))
        result.update(
            evidence_id='association:' + source + ':' + hashlib.sha256(identity.encode()).hexdigest()[:24],
            kind='association', entity_type=row['item_level'],
            entity_ids=[row['antecedent_id'], row['consequent_id']],
            label=row['antecedent_label'] + ' → ' + row['consequent_label'],
            summary=f"{row['joint_baskets']}/{row['antecedent_baskets']} antecedent baskets also contain the consequent; observational co-purchase.",
            population=population(row, ['eligible_baskets', 'antecedent_baskets', 'consequent_baskets', 'joint_baskets', 'early_eligible_baskets', 'early_antecedent_baskets', 'early_consequent_baskets', 'early_joint_baskets', 'late_eligible_baskets', 'late_antecedent_baskets', 'late_consequent_baskets', 'late_joint_baskets']),
            metrics=metrics(row, ['rank_for_antecedent', 'support_basket_fraction', 'confidence_b_given_a', 'baseline_b_fraction', 'lift', 'early_lift', 'late_lift']),
        )
        result['limitations'].append('Direction matters. Split-window stability and support filters are heuristic, not held-out causal validation.')
    elif filename == 'voucher_geometry.csv':
        population_keys = ['cohort_basket_count', 'eligible_basket_count', 'cap_hit_eligible_basket_count']
        meta_keys = ['feature_version', 'scenario_id', 'source', 'currency', 'evidence_scope', 'basket_value_basis']
        result.update(
            evidence_id='geometry:' + row['scenario_id'], kind='voucher_geometry', entity_type='voucher',
            entity_ids=[row['scenario_id']], label=f"Hypothetical percent voucher: {row['rate_bps']} bps, cap {row['cap_cents']} GBP pennies, minimum {row['minimum_spend_cents']} GBP pennies",
            summary='Static replay of rate, cap and minimum on unchanged historical subtotal proxies; mechanical payout equivalence only.',
            population=population(row, population_keys),
            metrics=metrics(row, [key for key in row if key not in meta_keys + population_keys]),
        )
        result['limitations'].extend([
            'Hypothetical GBP payouts, not actual historic voucher offers or VND recommendations; do not copy monetary thresholds to a merchant.',
            'Assumes 100% seller funding, unlimited quota/budget and no fees, returns, stock or basket/demand response. Same payout does not imply same behavior.',
            'Payout-vector comparisons require identical cohort hashes. Cap saturation can be rounding-dependent.',
        ])
    else:
        result.update(
            evidence_id='basket:' + source, kind='basket', entity_type='basket', entity_ids=[source],
            label=source + ' eligible basket profile',
            summary=f"Distribution across {row['eligible_baskets']} eligible source baskets; selected foreign-retail subset.",
            population=population(row, ['eligible_baskets', 'eligible_rows', 'early_baskets', 'late_baskets', 'relative_weeks']),
            metrics=metrics(row, ['single_product_basket_share', 'basket_products_p50', 'basket_products_p90', 'basket_amount_p25', 'basket_amount_p50', 'basket_amount_p75', 'basket_amount_p90']),
        )
        result['limitations'].append('Observed source-native basket distributions are not merchant AOV or conversion estimates; no cross-currency totals.')
    return result


def build(source, output):
    source = source.resolve()
    source_manifest = json.loads((source / 'manifest.json').read_text())
    central = json.loads((source / 'audit/central_validation.json').read_text())
    validation = json.loads((source / 'features/validation_report.json').read_text())
    if central.get('status') != 'passed' or validation.get('status') != 'passed':
        raise ValueError('Only a passed dataset and feature snapshot can be packaged')
    if digest(source / 'manifest.json') != central['manifest_sha256']:
        raise ValueError('Dataset manifest changed after validation')
    preprocessing = json.loads((source / 'features/preprocessing_report.json').read_text())
    if preprocessing['input_csv_sha256'] != central['csv_sha256']:
        raise ValueError('Feature input differs from validated dataset')
    hashes = validation['artifact_sha256']
    # Verify every audited feature artifact, not just files exported into cards.
    for filename, expected in hashes.items():
        if digest(source / 'features' / filename) != expected:
            raise ValueError('Feature artifact changed after validation: ' + filename)
    dataset_version = 'reference-v1-' + central['csv_sha256'][:16]
    cards = [card(row, filename, line, hashes, dataset_version)
             for filename in FILES
             for line, row in enumerate(rows(source / 'features' / filename), start=2)]
    cards.sort(key=lambda item: item['evidence_id'])
    if len({item['evidence_id'] for item in cards}) != len(cards):
        raise ValueError('Duplicate evidence IDs')
    expected_counts = {'profile': validation['checks']['all_profile_counts_quantiles_support_and_unknowns'],
                       'association': validation['checks']['all_associations_counts_windows_filters_and_top_three'],
                       'voucher_geometry': validation['checks']['all_voucher_integer_payouts_thresholds_equivalence_and_differences'],
                       'basket': validation['checks']['source_basket_summaries']}
    if dict(Counter(item['kind'] for item in cards)) != expected_counts:
        raise ValueError('Card counts differ from independent audit')
    payload = ''.join(json.dumps(item, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n' for item in cards).encode()
    manifest = {
        'schema_version': '1.0', 'dataset_version': dataset_version, 'feature_version': VERSION,
        'record_count': len(cards), 'counts_by_kind': expected_counts,
        'source_dataset_sha256': central['csv_sha256'],
        'source_artifacts': {name: hashes[name] for name in FILES},
        'source_validation_sha256': digest(source / 'features/validation_report.json'),
        'index': {'file': 'decision_evidence.jsonl', 'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload)},
        'sources': SOURCE_INFO,
        'scope': 'Versioned source-native aggregate reference. No embeddings, private identities, causal claims or merchant forecast calibration.',
        'metric_policy': 'Decimal strings preserve source precision; null means unavailable. Counts are exact integers. Recompute new arithmetic in code.',
        'lineage_policy': 'row_id is the physical CSV line number including the header as line 1; file SHA256 pins the exact row source.',
        'reproduction': 'python3 scripts/evidence/build.py --source /path/to/market-maker-dataset',
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'decision_evidence.jsonl').write_bytes(payload)
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'record_count': len(cards), 'bytes': len(payload), 'sha256': manifest['index']['sha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'data/evidence')
    args = parser.parse_args()
    build(args.source, args.output)
