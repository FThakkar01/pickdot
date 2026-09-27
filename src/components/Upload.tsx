import { useEffect, useRef, useState } from 'react';
import { STAGES, type Stage } from '../lib/analyze';
import { PLATFORMS } from '../lib/platforms';
import { hitRate } from '../lib/storage';
import type { ComparisonRecord, Profile, Slot } from '../lib/types';
import { DotDecor } from './Lens';

function DropSlot({ slot, file, onFile }: { slot: Slot; file: File | null; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<string>('');

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    const i = new Image();
    i.onload = () => setDims(`${i.naturalWidth}×${i.naturalHeight}`);
    i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const take = (files: FileList | null) => {
    const f = files && Array.from(files).find((x) => x.type.startsWith('image/'));
    if (f) onFile(f);
  };

  return (
    <div
      className={`slot ${slot} ${file ? 'filled' : 'empty'} ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        take(e.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files)} />
      {preview ? (
        <>
          <img className="slot-img" src={preview} alt={`Option ${slot}`} />
          <span className="slot-badge">{slot}</span>
          <div className="slot-meta">
            <span className="name">{file!.name}</span>
            <span className="mono faint">{dims}</span>
            <button className="chip" onClick={() => input.current?.click()}>
              Replace
            </button>
          </div>
        </>
      ) : (
        <button className="slot-pick" onClick={() => input.current?.click()} aria-label={`Choose image ${slot}`}>
          <span className="slot-letter">{slot}</span>
          <span className="slot-dots" style={{ color: slot === 'A' ? 'var(--ink)' : 'var(--text)' }}>
            <DotDecor seed={slot === 'A' ? 1 : 2} />
          </span>
          <span className="slot-hint">
            <strong>Drop option {slot}</strong>
            <span>or click to choose · PNG, JPG, WebP</span>
          </span>
        </button>
      )}
    </div>
  );
}

export function UploadView(props: {
  profile: Profile | null;
  files: Partial<Record<Slot, File>>;
  setFile: (s: Slot, f: File) => void;
  onRun: () => void;
  onEditProfile: () => void;
  pending: ComparisonRecord | null;
  onPending: () => void;
  onDismissPending: () => void;
  error: string | null;
}) {
  const { profile, files } = props;
  const ready = !!(files.A && files.B);
  const hr = hitRate();
  const spec = profile ? PLATFORMS[profile.platform] : null;

  return (
    <>
      {props.pending && (
        <div className="banner" role="status">
          <img src={props.pending.thumbA} alt="" />
          <img src={props.pending.thumbB} alt="" />
          <div className="txt">
            <b>{Math.round((Date.now() - props.pending.createdAt) / 86400000)} days ago</b> you compared these two. Which one
            did you post, and how did it do?
          </div>
          <button className="btn btn-pink" onClick={props.onPending}>
            Tell us what happened
          </button>
          <button className="btn btn-ghost" onClick={props.onDismissPending}>
            Not posted
          </button>
        </div>
      )}
      <div className="compare-grid">
        <div>
          <div className="slots">
            <DropSlot slot="A" file={files.A ?? null} onFile={(f) => props.setFile('A', f)} />
            <DropSlot slot="B" file={files.B ?? null} onFile={(f) => props.setFile('B', f)} />
          </div>
          <div className="run-row">
            <button className="btn btn-pink btn-lg" disabled={!ready} onClick={props.onRun}>
              Compare A and B
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            <span className="note">
              {ready ? 'Both images stay on this device. Nothing is uploaded.' : 'Add two images to compare.'}
            </span>
            {props.error && <span className="err">{props.error}</span>}
          </div>
        </div>

        <aside className="side">
          <div className="card aud-card">
            <div className="card-top">
              <span className="card-label">Judging for</span>
              <span className="spacer" />
              <button className="chip" onClick={props.onEditProfile}>
                Edit
              </button>
            </div>
            {profile ? (
              <>
                <div className="big-stat">{spec!.short}</div>
                <p className="muted" style={{ marginTop: 10 }}>
                  {profile.audience || 'No audience described yet.'}
                </p>
                <div className="aud-row">
                  {profile.tones.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  <span className="chip mono">{spec!.displayNote}</span>
                </div>
                {!profile.worked.trim() && (
                  <div className="thin">Your profile is thin — predictions will be generic until you add what's worked before.</div>
                )}
              </>
            ) : (
              <p className="muted">No profile yet.</p>
            )}
          </div>

          <div className="card">
            <div className="card-label">What you get</div>
            <div className="honest" style={{ marginTop: 10 }}>
              <p style={{ marginTop: 0 }}>
                <strong>Measured:</strong> two attention maps, and only the numbers that differ — text size at feed scale,
                contrast, face size, clutter.
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong>Judged:</strong> a hedged pick with up to three reasons, or "too close to call". Roughly one pick in
                three is wrong.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-label">Your hit rate</div>
            {hr.logged > 0 ? (
              <div className="big-stat" style={{ marginTop: 10 }}>
                {hr.right}
                <small>/ {hr.logged} picks held up</small>
              </div>
            ) : (
              <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
                Log what happened after you post, and your own hit rate shows up here.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export function AnalyzingView({ files, stage }: { files: Record<Slot, File>; stage: Stage }) {
  const [urls, setUrls] = useState<Record<Slot, string> | null>(null);
  useEffect(() => {
    const u = { A: URL.createObjectURL(files.A), B: URL.createObjectURL(files.B) };
    setUrls(u);
    return () => Object.values(u).forEach(URL.revokeObjectURL);
  }, [files.A, files.B]);
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="scan-wrap">
      <div className="scan-pair">
        {(['A', 'B'] as Slot[]).map((s) => (
          <div key={s} className={`scan-frame ${s}`}>
            {urls && <img src={urls[s]} alt="" />}
            <span className="slot-badge">{s}</span>
          </div>
        ))}
      </div>
      <div className="card" aria-live="polite">
        <div className="card-label">Measuring, on this device</div>
        <ul className="stages">
          {STAGES.map((s, i) => (
            <li key={s.id} className={i < idx || stage === 'done' ? 'done' : i === idx ? 'active' : ''}>
              <span className="stage-dot" />
              <span>
                {s.label}
                <span className="detail">{s.detail}</span>
              </span>
              <span className="mono faint" style={{ fontSize: 11 }}>
                {i < idx || stage === 'done' ? 'done' : i === idx ? '···' : ''}
              </span>
            </li>
          ))}
        </ul>
        {stage === 'faces' && (
          <p className="muted" style={{ fontSize: 12, margin: '10px 10px 0' }}>
            First visit downloads the face model once; the browser caches it after that.
          </p>
        )}
      </div>
    </div>
  );
}
