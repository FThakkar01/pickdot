import { useMemo, useState } from 'react';
import { readText } from '../lib/analyze';
import { buildDiffs } from '../lib/diffs';
import { PLATFORM_LIST, PLATFORMS } from '../lib/platforms';
import type { ImageAnalysis, Platform, Slot, Verdict } from '../lib/types';
import { FeedPreview } from './Feed';
import { Lens, type LensMode } from './Lens';

type Pair = Record<Slot, ImageAnalysis>;
const regionWord = (n: number) => (n === 1 ? 'region' : 'regions');

function Hero({ pair, platform }: { pair: Pair; platform: Platform }) {
  const [mode, setMode] = useState<LensMode>('dots');
  return (
    <section className="card card-pink" aria-labelledby="hero-t">
      <div className="card-top">
        <span className="half-tag">Measured</span>
        <span className="card-label" id="hero-t">
          Where the eye lands first
        </span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Map style">
          {(
            [
              ['dots', 'Dots'],
              ['heat', 'Heat'],
              ['overlay', 'Overlay'],
            ] as [LensMode, string][]
          ).map(([m, l]) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="lens-pair">
        {(['A', 'B'] as Slot[]).map((s) => {
          const a = pair[s];
          return (
            <div key={s}>
              <div className="lens-head">
                <span className="l">{s}</span>
                <span className="stat">
                  {a.saliency.regionCount}
                  <small>
                    {regionWord(a.saliency.regionCount)} · {Math.round(a.saliency.topShare * 100)}% in the lead
                  </small>
                </span>
              </div>
              <Lens a={a} mode={mode} headlinePx={readText(a, platform).headlinePx} />
            </div>
          );
        })}
      </div>
      <div className="lens-legend">
        {mode === 'dots' && (
          <>
            <span>
              <i />
              above-threshold attention
            </span>
            <span>
              <i className="faded" />
              background
            </span>
          </>
        )}
        {mode === 'overlay' && (
          <>
            <span>◌ attention regions</span>
            <span style={{ color: '#7a3b72' }}>▭ text lines</span>
            <span style={{ color: '#35507f' }}>⌜⌟ faces</span>
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>Spectral-residual saliency + centre and face priors · computed on this device</span>
      </div>
    </section>
  );
}

function Diffs({ pair, platform }: { pair: Pair; platform: Platform }) {
  const diffs = useMemo(() => buildDiffs(pair, platform), [pair, platform]);
  return (
    <section className="card">
      <div className="card-top">
        <span className="half-tag">Measured</span>
        <span className="card-label">What differs — only what differs</span>
      </div>
      {diffs.length ? (
        <div className="diffs">
          {diffs.slice(0, 5).map((d) => (
            <div className="diff" key={d.key}>
              <div>
                <div className="lbl">{d.label}</div>
                <div className="sent">{d.sentence}</div>
              </div>
              <div className="bars" aria-hidden>
                {(['A', 'B'] as Slot[]).map((s) => (
                  <div key={s} className={`bar ${s}`}>
                    <span>{s}</span>
                    <span className="track">
                      <span className="fill" style={{ display: 'block', width: `${Math.max(2, (s === 'A' ? d.barA : d.barB) * 100)}%` }} />
                    </span>
                    <span className={`v ${d.flag === s ? 'flag' : ''}`}>{s === 'A' ? d.a : d.b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">No measurement separates these two meaningfully. They are, by the numbers, very alike.</p>
      )}
    </section>
  );
}

function TrueSize({ pair, platform }: { pair: Pair; platform: Platform }) {
  const [p, setP] = useState<Platform>(platform);
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <div className="card-top">
        <span className="card-label">At true size, in a feed</span>
        <span className="spacer" />
        <button className="chip" aria-pressed={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show at thumbnail scale'}
        </button>
      </div>
      {open && (
        <>
          <div className="chips" style={{ marginBottom: 14 }}>
            {PLATFORM_LIST.map((s) => (
              <button key={s.id} className="chip" aria-pressed={p === s.id} onClick={() => setP(s.id)}>
                {s.short}
              </button>
            ))}
          </div>
          <div className="feed-scroll">
            <FeedPreview pair={pair} platform={p} />
          </div>
          <div className="feed-note">
            Rendered at real CSS pixels — {PLATFORMS[p].displayNote}. Hold your phone at arm's length from the screen for the
            honest version.
          </div>
        </>
      )}
    </section>
  );
}

function Audit({ pair, platform }: { pair: Pair; platform: Platform }) {
  const t = { A: readText(pair.A, platform), B: readText(pair.B, platform) };
  const f = (v: number | null, fn: (x: number) => string) => (v === null ? '—' : fn(v));
  const rows: [string, (s: Slot) => React.ReactNode][] = [
    ['Size', (s) => `${pair[s].metrics.width}×${pair[s].metrics.height}`],
    ['Largest text at feed size', (s) => f(t[s].headlinePx, (v) => `${Math.round(v)}px`)],
    ['Smallest text at feed size', (s) => f(t[s].smallestPx, (v) => `${Math.round(v)}px`)],
    ['Headline contrast', (s) => f(t[s].headlineContrast, (v) => `${v.toFixed(2)}:1`)],
    ['Lowest text contrast', (s) => f(t[s].minContrast, (v) => `${v.toFixed(2)}:1`)],
    ['Text lines found', (s) => pair[s].textBoxes.length],
    [
      'Faces',
      (s) =>
        pair[s].faces.status !== 'ok'
          ? 'model unavailable'
          : pair[s].faces.list.length
            ? pair[s].faces.list.map((x) => `${Math.round(x.areaPct)}% ${x.expression}, ${x.facing === 'camera' ? 'to camera' : 'turned'}`).join('; ')
            : 'none',
    ],
    ['Attention regions', (s) => pair[s].saliency.regionCount],
    ['Share in lead region', (s) => `${Math.round(pair[s].saliency.topShare * 100)}%`],
    ['Edge density', (s) => `${(pair[s].metrics.edgeDensity * 100).toFixed(1)}%`],
    ['Distinct colours (4-bit)', (s) => pair[s].metrics.paletteCount],
    ['Mean brightness', (s) => `${Math.round(pair[s].metrics.meanLuma * 100)}%`],
    ['RMS contrast', (s) => (pair[s].metrics.rmsContrast * 100).toFixed(1)],
    ['Clipped black / white', (s) => `${(pair[s].metrics.clipLow * 100).toFixed(1)}% / ${(pair[s].metrics.clipHigh * 100).toFixed(1)}%`],
    ['Mean saturation', (s) => `${Math.round(pair[s].metrics.saturation * 100)}%`],
    ['Weight → nearest thirds point', (s) => `${(pair[s].metrics.thirdsDistance * 100).toFixed(1)}% of diagonal`],
    [
      'Dominant colour',
      (s) => (
        <>
          <span className="swatch" style={{ background: pair[s].metrics.dominant }} />
          {pair[s].metrics.dominant}
        </>
      ),
    ],
    [
      'Luminance histogram',
      (s) => (
        <span className="hist">
          {Array.from({ length: 32 }, (_, i) => {
            const h = pair[s].metrics.histogram;
            const v = Math.max(...h.slice(i * 8, i * 8 + 8));
            return <span key={i} style={{ height: `${Math.max(3, v * 100)}%` }} />;
          })}
        </span>
      ),
    ],
  ];
  return (
    <details className="card audit">
      <summary>
        <span className="half-tag">Measured</span>
        <span className="card-label">Audit — every number the verdict could use</span>
        <span className="caret">›</span>
      </summary>
      <div className="audit-scroll">
        <table className="audit-table">
          <thead>
            <tr>
              <th />
              <th style={{ color: 'var(--pink)' }}>A</th>
              <th style={{ color: 'var(--ice)' }}>B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label}>
                <th>{label}</th>
                <td className="A">{fn('A')}</td>
                <td className="B">{fn('B')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function VerdictPanel({ verdict, onOutcome, logged }: { verdict: Verdict; onOutcome: () => void; logged: boolean }) {
  const [tab, setTab] = useState<'verdict' | 'rules'>('verdict');
  const v = verdict;
  const close = v.winner === 'close';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <aside className="panel" aria-label="Verdict">
      <div className="panel-tabs">
        <div className="seg dark" role="tablist">
          <button role="tab" aria-pressed={tab === 'verdict'} aria-selected={tab === 'verdict'} onClick={() => setTab('verdict')}>
            Verdict
          </button>
          <button role="tab" aria-pressed={tab === 'rules'} aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>
            Rules
          </button>
        </div>
        <span className="half-tag judged" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          Judged
        </span>
      </div>

      {tab === 'verdict' ? (
        <div className="panel-body">
          <div className="verdict-hero">
            <div className={`orb ${close ? 'close' : v.winner}`}>{close ? 'A≈B' : v.winner}</div>
            <div>
              <h2>{close ? 'Too close to call' : `${v.winner} is more likely to perform better`}</h2>
              <div className="conf">
                {close ? (
                  <span className="chip">the measurements still stand</span>
                ) : (
                  <span className="chip">
                    <span className="dot" style={{ color: v.confidence === 'moderate' ? 'var(--pink)' : 'var(--muted)' }} />
                    {v.confidence} confidence
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bubble">
            {close ? v.closeWhy : v.profileLine}
            <span className="t">{time}</span>
          </div>

          {!close && (
            <div className="reasons">
              {v.reasons.map((r, i) => (
                <div key={i} className="bubble">
                  <span className="n">0{i + 1}</span>
                  {r}
                </div>
              ))}
            </div>
          )}

          <p className="hedge">A directional nudge, not a test result. Roughly one pick in three is wrong.</p>
          {logged && <div className="bubble me">Outcome logged. Thanks — this is how the picks get better.</div>}
        </div>
      ) : (
        <div className="panel-body">
          <div className="score">
            <div>
              <div className="card-label">Rules for A</div>
              <div className="v mono" style={{ color: 'var(--pink)' }}>
                {v.scoreA.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="card-label">Rules for B</div>
              <div className="v mono" style={{ color: 'var(--ice)' }}>
                {v.scoreB.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="rules">
            {v.rules.map((r) => (
              <div key={r.id} className={`rule ${r.winner ? '' : 'off'}`}>
                <div className="rule-top">
                  <span className={`who ${r.winner ?? ''}`}>{r.winner ?? '·'}</span>
                  <span className="name">{r.label}</span>
                  <span className="w">{r.winner ? `+${r.weight}` : '—'}</span>
                </div>
                <div className="kind" style={{ marginTop: 4 }}>
                  {r.kind} · base {r.baseWeight}
                </div>
                {r.weightNote && r.winner && <div className="note">{r.weightNote}</div>}
              </div>
            ))}
          </div>
          <p className="hedge" style={{ fontStyle: 'normal' }}>
            Swap check: A-then-B picks <b className="mono">{v.run1}</b>, B-then-A picks <b className="mono">{v.run2}</b>.
            {v.run1 === v.run2 ? ' Stable.' : ' Unstable — shown as too close to call.'} A gap of 1 point or less, or conflicting
            hard rules, is always "too close to call".
          </p>
        </div>
      )}

      <div className="panel-foot">
        <button className="ask" onClick={onOutcome}>
          <span>{logged ? 'Update what happened' : 'Posted one? Tell us what happened'}</span>
          <span className="go" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>
    </aside>
  );
}

export function ResultView(props: {
  pair: Pair;
  verdict: Verdict;
  platform: Platform;
  onOutcome: () => void;
  logged: boolean;
}) {
  return (
    <div className="result-grid">
      <div className="col">
        <Hero pair={props.pair} platform={props.platform} />
        <Diffs pair={props.pair} platform={props.platform} />
        <TrueSize pair={props.pair} platform={props.platform} />
        <Audit pair={props.pair} platform={props.platform} />
      </div>
      <VerdictPanel verdict={props.verdict} onOutcome={props.onOutcome} logged={props.logged} />
    </div>
  );
}
