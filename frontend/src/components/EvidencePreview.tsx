import { useEffect, useRef, useState } from 'react';
import type { EvaluationInput, RecommendationContext } from '@market-maker/contracts';
import type { RetrievalResult } from '@market-maker/contracts/evidence';
import { retrieveEvidence } from '../api';
import { EvidenceReferences } from './EvidenceReferences';

export function EvidencePreview({
  input,
  context,
  disabled,
}: {
  input: EvaluationInput;
  context: RecommendationContext;
  disabled: boolean;
}) {
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current?.abort();
    setResult(null);
    setBusy(false);
    setError('');
    return () => active.current?.abort();
  }, [input, context]);
  async function preview() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await retrieveEvidence({ input, context }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Không đọc được reference.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={disabled || busy || !context.reference_query?.trim()}
        onClick={() => {
          void preview();
        }}
      >
        {busy ? 'Đang tìm reference…' : 'Xem reference · không gọi AI'}
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {result && <EvidenceReferences result={result} />}
    </>
  );
}
