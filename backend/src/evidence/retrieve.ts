import type { EvaluationInput, RecommendationContext } from '@market-maker/contracts';
import {
  parseRetrievalResult,
  type EvidenceCard,
  type RetrievalResult,
} from '../../../contracts/evidence.ts';
import { loadEvidenceIndex, type EvidenceIndex } from './store.ts';

export const RETRIEVAL_VERSION = 'evidence-lexical.v2';
const MAX_CARDS = 5;
const MAX_ITEMS_CHARACTERS = 15000;

type Source = EvidenceCard['source_dataset'];
type QueryContext = RecommendationContext & { reference_query?: string };
export interface RetrievalOptions {
  loadIndex?: () => Promise<EvidenceIndex>;
  limit?: number;
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const words = (value: string) => new Set(normalize(value).split(/\s+/).filter(Boolean));
const hasPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

// These aliases identify reference categories only; they never map a merchant SKU to a foreign SKU.
const concepts = [
  { terms: ['cat litter', 'cat ve sinh', 'cat cho meo'], categories: ['cat litter'] },
  { terms: ['cat food', 'thuc an meo', 'thuc an cho meo'], categories: ['cat food'] },
  {
    terms: ['milk', 'fluid milk', 'fresh milk', 'sua', 'sua tuoi'],
    categories: ['fluid milk products'],
  },
  { terms: ['canned milk', 'sua dong hop'], categories: ['canned milk'] },
  { terms: ['milk by products', 'milk byproducts'], categories: ['milk by products'] },
  {
    terms: ['bread', 'fresh bread', 'baked bread', 'banh mi'],
    categories: ['bread', 'baked bread buns rolls'],
  },
  {
    terms: ['frozen bread', 'frozen dough', 'banh mi dong lanh'],
    categories: ['frozen bread dough'],
  },
  { terms: ['yogurt', 'yoghurt', 'sua chua'], categories: ['yogurt'] },
  { terms: ['coffee', 'ca phe'], categories: ['coffee'] },
  { terms: ['coffee filters', 'coffee filter', 'giay loc ca phe'], categories: ['coffee filters'] },
  { terms: ['diapers', 'diaper', 'ta em be'], categories: ['diapers disposables'] },
];
function matchConcepts(text: string) {
  let remaining = text;
  const matches = new Set<(typeof concepts)[number]>();
  const aliases = concepts
    .flatMap((concept) => concept.terms.map((term) => ({ concept, term })))
    .sort((left, right) => right.term.length - left.term.length);
  // Consume longer aliases first: 'sữa chua' means yogurt, not yogurt AND milk.
  for (const { concept, term } of aliases) {
    if (!hasPhrase(remaining, term)) continue;
    matches.add(concept);
    remaining = ` ${remaining} `.replaceAll(` ${term} `, ' ').trim();
  }
  return { concepts: [...matches], remaining };
}
const stopWords = new Set(
  'please me about information details describe categories thong tin hay xem vui long toi find reference references historical evidence data show compare product category profile profiles ho so san pham nganh hang strategy strategies recommendation recommend suggest voucher vouchers purchase purchases bundle bundling pair pairing copurchase co purchase buying together mua kem ket hop de xuat tham khao du lieu lich su tim cho ve cua va voi the a an for and or of in on to with'.split(
    ' ',
  ),
);

function queryPlan(query: string) {
  const sourceNames: Record<string, Source> = {
    uci: 'uci_online_retail_ii',
    uci_online_retail_ii: 'uci_online_retail_ii',
    cj: 'completejourney',
    completejourney: 'completejourney',
  };
  const requestedSources = new Set<Source>();
  let invalidFilter = false;
  const text = normalize(
    query.replace(/\bsource\s*:\s*([a-z_]+)/gi, (_match, key: string) => {
      const name = key.toLowerCase();
      const source = Object.hasOwn(sourceNames, name) ? sourceNames[name] : undefined;
      if (source) requestedSources.add(source);
      else invalidFilter = true;
      return ' ';
    }),
  );
  const requestedSource = requestedSources.size === 1 ? [...requestedSources][0] : undefined;
  const geometrySignals = [
    query.includes('%') || /(^| )(percent|percentage|rate|phan tram)( |$)/.test(text),
    /(^| )(cap|ceiling|tran)( |$)/.test(text),
    /(^| )(minimum|min spend|threshold|toi thieu)( |$)/.test(text),
  ];
  const geometry =
    hasPhrase(text, 'voucher geometry') || geometrySignals.filter(Boolean).length >= 2;
  const basket = hasPhrase(text, 'basket distribution') || hasPhrase(text, 'phan phoi gio hang');
  const matched = matchConcepts(text);
  const matchedConcepts = matched.concepts;
  const profile = ['profile', 'profiles', 'ho so'].some((term) => hasPhrase(text, term));
  const association = [
    'bundle',
    'bundling',
    'co purchase',
    'copurchase',
    'mua kem',
    'ket hop',
    'pair',
    'pairing',
    'together',
  ].some((term) => hasPhrase(text, term));
  const tokens = [...words(text)].filter(
    (word) => !stopWords.has(word) && !/^\d+$/.test(word) && word.length > 1,
  );
  return {
    text,
    requestedSource,
    invalid: invalidFilter || requestedSources.size > 1,
    geometry,
    basket,
    matchedConcepts,
    association,
    profile,
    residualTokens: [...words(matched.remaining)].filter(
      (word) => !stopWords.has(word) && !/^\d+$/.test(word) && word.length > 1,
    ),
    tokens,
  };
}

function scoreCard(card: EvidenceCard, plan: ReturnType<typeof queryPlan>): number {
  if (plan.invalid || (plan.requestedSource && card.source_dataset !== plan.requestedSource))
    return 0;
  if (plan.geometry) {
    if (card.kind !== 'voucher_geometry' || card.source_dataset !== 'uci_online_retail_ii')
      return 0;
    return (
      10 +
      (card.metrics.cap_binding_at_minimum === 'true' ? 2 : 0) +
      (card.metrics.same_exact_payout_as_lower_rate === 'true' ? 1 : 0)
    );
  }
  if (plan.basket) return card.kind === 'basket' ? 10 : 0;
  if (card.kind !== 'profile' && card.kind !== 'association') return 0;
  if (plan.association && card.kind !== 'association') return 0;
  if (plan.profile && card.kind !== 'profile') return 0;
  const label = normalize(`${card.label} ${card.entity_ids.join(' ')}`);
  if (plan.matchedConcepts.length) {
    // Grocery aliases refer to the CJ category scope; gift descriptions containing milk/bread are not equivalent.
    if (card.source_dataset !== 'completejourney') return 0;
    // Canonical category identity avoids matching milk by-products, frozen dough,
    // or coffee equipment merely because their names contain a beverage/food token.
    const entities = card.entity_ids.map(normalize);
    const matches = plan.matchedConcepts.filter((concept) =>
      concept.categories.some((category) => entities.includes(category)),
    ).length;
    // Recognizing one known term must not discard an unknown qualifier silently.
    const labelWords = words(label);
    if (plan.residualTokens.some((token) => !labelWords.has(token))) return 0;
    if (matches !== plan.matchedConcepts.length) return 0;
    return 20 + matches * 10 + (plan.association ? 5 : card.kind === 'profile' ? 3 : 0);
  }
  if (!plan.tokens.length) return 0;
  const labelWords = words(label);
  const matched = plan.tokens.filter((token) => labelWords.has(token)).length;
  // Require all meaningful query tokens. Unknown categories never fall back to a popular unrelated card.
  if (matched !== plan.tokens.length) return 0;
  return matched * 10 + (card.kind === 'profile' ? 3 : 0);
}

/** Explicit opt-in retrieval. This returns reference context and never changes input economics or demand. */
export async function retrieveEvidence(
  _input: EvaluationInput,
  context?: QueryContext,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const query = (context?.reference_query ?? '').trim().slice(0, 500);
  const envelope = {
    enabled: Boolean(query),
    dataset_version: null as string | null,
    index_sha256: null as string | null,
    retrieval_version: RETRIEVAL_VERSION,
    query,
    items: [] as EvidenceCard[],
  };
  if (!query) return parseRetrievalResult({ ...envelope, status: 'disabled' });
  let index: EvidenceIndex;
  try {
    index = await (options.loadIndex ?? loadEvidenceIndex)();
  } catch {
    return parseRetrievalResult({ ...envelope, status: 'unavailable' });
  }
  const plan = queryPlan(query);
  const ranked = index.cards
    .map((card) => ({ card, score: scoreCard(card, plan) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.card.evidence_id.localeCompare(right.card.evidence_id),
    );
  // Every returned batch is source-specific, so monetary bases cannot be pooled accidentally.
  const selectedSource = plan.requestedSource ?? ranked[0]?.card.source_dataset;
  const limit = Number.isInteger(options.limit)
    ? Math.max(0, Math.min(MAX_CARDS, options.limit!))
    : MAX_CARDS;
  const items: EvidenceCard[] = [];
  const signatures = new Set<string>();
  for (const { card } of ranked) {
    if (items.length >= limit) break;
    if (card.source_dataset !== selectedSource) continue;
    const signature =
      card.kind === 'voucher_geometry'
        ? String(card.metrics.payout_equivalence_group ?? card.evidence_id)
        : card.evidence_id;
    if (signatures.has(signature)) continue;
    if (JSON.stringify([...items, card]).length > MAX_ITEMS_CHARACTERS) continue;
    signatures.add(signature);
    items.push(structuredClone(card));
  }
  return parseRetrievalResult({
    ...envelope,
    dataset_version: index.datasetVersion,
    index_sha256: index.indexSha256,
    status: items.length ? 'matched' : 'no_match',
    items,
  });
}
