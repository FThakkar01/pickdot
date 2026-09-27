import { useEffect, useState } from 'react';
import type { ComparisonRecord, Outcome } from '../lib/types';

export function OutcomeModal({
  record,
  onSave,
  onClose,
}: {
  record: ComparisonRecord;
  onSave: (o: Outcome) => void;
  onClose: () => void;
}) {
  const [posted, setPosted] = useState<Outcome['posted'] | null>(record.outcome?.posted ?? null);
  const [perf, setPerf] = useState<Outcome['performance']>(record.outcome?.performance ?? null);
  const [note, setNote] = useState(record.outcome?.note ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSave = posted === 'neither' || (posted && perf);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="oc-t" onClick={(e) => e.stopPropagation()}>
        <h3 id="oc-t">What happened?</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Three taps. This is the only way the picks can learn whether they were right.
        </p>

        <div className="q">Which one did you post?</div>
        <div className="taps">
          <button className="tap" aria-pressed={posted === 'A'} onClick={() => setPosted('A')}>
            <img src={record.thumbA} alt="" />A
          </button>
          <button className="tap" aria-pressed={posted === 'B'} onClick={() => setPosted('B')}>
            <img src={record.thumbB} alt="" />B
          </button>
          <button className="tap" aria-pressed={posted === 'neither'} onClick={() => setPosted('neither')}>
            Neither yet
          </button>
        </div>

        {posted && posted !== 'neither' && (
          <>
            <div className="q">Compared to your usual, it did…</div>
            <div className="taps">
              {(['better', 'same', 'worse'] as const).map((p) => (
                <button key={p} className="tap" aria-pressed={perf === p} onClick={() => setPerf(p)}>
                  {p === 'same' ? 'About the same' : p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="q">Anything else? (optional)</div>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2× my usual views in 48h" />
          </>
        )}

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            Later
          </button>
          <button
            className="btn btn-pink"
            disabled={!canSave}
            onClick={() => onSave({ posted: posted!, performance: posted === 'neither' ? null : perf, note, loggedAt: Date.now() })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
