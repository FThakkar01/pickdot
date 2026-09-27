import { useState } from 'react';
import { PLATFORM_LIST, TONES } from '../lib/platforms';
import { profileSignals } from '../lib/rules';
import type { Profile } from '../lib/types';

export function profileStrength(p: Pick<Profile, 'audience' | 'topics' | 'tones' | 'worked'>): number {
  return [
    true, // platform always set
    p.audience.trim().length >= 15,
    p.topics.trim().length >= 3,
    p.tones.length > 0,
    p.worked.trim().length >= 10,
  ].filter(Boolean).length;
}

export function ProfileView({
  initial,
  onSave,
  firstRun,
}: {
  initial: Profile;
  onSave: (p: Profile) => void;
  firstRun: boolean;
}) {
  const [p, setP] = useState<Profile>(initial);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const strength = profileStrength(p);
  const sig = profileSignals(p);
  const heard: string[] = [];
  if (sig.phoneFirst) heard.push('Phone-first → text legibility weighted ×1.5');
  if (sig.faces === 'up') heard.push('Faces work → face size counts double');
  if (sig.faces === 'down') heard.push('Faces flop → face rule inverted');
  if (sig.saturation === 'up') heard.push('Vivid colour works → saturation counts');
  if (sig.saturation === 'down') heard.push('Muted palette works → lower saturation counts');
  if (sig.clutterAverse) heard.push('Clean / minimal → clutter weighted ×1.5');

  return (
    <div className="profile-grid">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...p, updatedAt: Date.now() });
        }}
      >
        <div className="field">
          <div className="field-lbl">
            <span className="num">01</span>Where you post
            <small>Sets the size everything is judged at.</small>
          </div>
          <div className="chips" role="radiogroup" aria-label="Platform">
            {PLATFORM_LIST.map((s) => (
              <button
                type="button"
                key={s.id}
                role="radio"
                aria-checked={p.platform === s.id}
                aria-pressed={p.platform === s.id}
                className="chip"
                onClick={() => set('platform', s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-lbl" htmlFor="aud">
            <span className="num">02</span>Who your audience is
            <small>One or two sentences.</small>
          </label>
          <textarea
            id="aud"
            className="input"
            rows={2}
            value={p.audience}
            onChange={(e) => set('audience', e.target.value)}
            placeholder="Indian design students, 19–25, mostly on phones, follow me for Figma tips"
          />
        </div>

        <div className="field">
          <label className="field-lbl" htmlFor="top">
            <span className="num">03</span>What you post about
          </label>
          <input
            id="top"
            className="input"
            value={p.topics}
            onChange={(e) => set('topics', e.target.value)}
            placeholder="UI teardowns and portfolio advice"
          />
        </div>

        <div className="field">
          <div className="field-lbl">
            <span className="num">04</span>Tone you aim for
            <small>Pick any.</small>
          </div>
          <div className="chips">
            {TONES.map((t) => (
              <button
                type="button"
                key={t}
                className="chip"
                aria-pressed={p.tones.includes(t)}
                onClick={() => set('tones', p.tones.includes(t) ? p.tones.filter((x) => x !== t) : [...p.tones, t])}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-lbl" htmlFor="wk">
            <span className="num">05</span>What's worked before
            <span className="opt">optional</span>
            <small>The field that does the heaviest lifting.</small>
          </label>
          <div>
            <textarea
              id="wk"
              className="input"
              rows={3}
              value={p.worked}
              onChange={(e) => set('worked', e.target.value)}
              placeholder="Close-up faces and big numbers do well. Muted palettes flop."
            />
            {!p.worked.trim() && (
              <div className="thin">Your profile is thin — predictions will be generic until this is filled.</div>
            )}
          </div>
        </div>

        <div className="run-row" style={{ justifyContent: 'flex-end' }}>
          <span className="note">Saved on this device only. No login.</span>
          <button type="submit" className="btn btn-pink btn-lg">
            {firstRun ? 'Save and start comparing' : 'Save profile'}
          </button>
        </div>
      </form>

      <aside className="side">
        <div className="card card-pink">
          <div className="card-label">Profile strength</div>
          <div className="big-stat" style={{ marginTop: 8 }}>
            {strength}
            <small style={{ color: 'var(--ink-soft)' }}>/ 5 fields</small>
          </div>
          <div className="strength" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i < strength ? 'on' : ''} />
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {strength >= 5 ? 'Complete. Picks are judged against your audience.' : 'Each field sharpens the rules. Two people with the same images should get different answers.'}
          </div>
        </div>
        <div className="card">
          <div className="card-label">What the rules heard</div>
          {heard.length ? (
            <div className="rules" style={{ marginTop: 10 }}>
              {heard.map((h) => (
                <div key={h} className="rule">
                  {h}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>
              Nothing yet. Mention phones, faces, colour, or clutter and you'll see the weighting change here.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
