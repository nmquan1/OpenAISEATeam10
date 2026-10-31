/** Graded ranking metrics over a fixed, independently supplied relevance map.
 * Missing IDs have grade 0; zero relevant documents makes relevance metrics undefined.
 * Repeated IDs are an invalid ranking rather than repeated credit for one document.
 */
export function rankAtK(ids: string[], qrels: Record<string, number>, k = 5) {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error('k must be a positive safe integer');
  if (ids.some((id) => typeof id !== 'string' || !id.length))
    throw new Error('Ranking IDs must be nonempty strings');
  if (new Set(ids).size !== ids.length) throw new Error('Ranking contains duplicate IDs');
  const gain = (grade: number) => Math.expm1(grade * Math.LN2);
  const grades = Object.values(qrels);
  if (
    grades.some(
      (grade) =>
        !Number.isFinite(grade) ||
        grade < 0 ||
        !Number.isFinite(2 ** grade - 1) ||
        !Number.isFinite(gain(grade)),
    )
  )
    throw new Error('Relevance grades must be finite, nonnegative and have finite gain');
  const relevant = grades.filter((grade) => grade > 0);
  const selected = ids.slice(0, k);
  const relevance = selected.map((id) => (Object.hasOwn(qrels, id) ? qrels[id]! : 0));
  const hits = relevance.filter((grade) => grade > 0).length;
  const first = relevance.findIndex((grade) => grade > 0);
  // Scale both DCGs equally to prevent finite gains overflowing when summed.
  const maxGain = relevant.reduce((largest, grade) => Math.max(largest, gain(grade)), 0) || 1;
  const dcg = (values: number[]) =>
    values.reduce((sum, grade, index) => sum + gain(grade) / maxGain / Math.log2(index + 2), 0);
  const ideal = dcg([...relevant].sort((left, right) => right - left).slice(0, k));
  const reciprocalRank = relevant.length ? (first < 0 ? 0 : 1 / (first + 1)) : null;
  return {
    k,
    precision_at_k: relevant.length ? hits / k : null,
    precision_at_returned: relevant.length ? (selected.length ? hits / selected.length : 0) : null,
    recall_at_k: relevant.length ? hits / relevant.length : null,
    ndcg_at_k: relevant.length ? dcg(relevance) / ideal : null,
    reciprocal_rank: reciprocalRank,
    // At query level this aliases reciprocal rank; MRR requires averaging across queries.
    mrr: reciprocalRank,
    hit_at_k: relevant.length ? Number(hits > 0) : null,
    relevant_count: relevant.length,
    retrieved: selected.length,
    retrieved_count: selected.length,
    relevant_retrieved: hits,
    recall_ceiling_at_k: relevant.length ? Math.min(k, relevant.length) / relevant.length : null,
  };
}
