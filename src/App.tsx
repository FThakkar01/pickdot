import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { analyzePair, type Stage } from './lib/analyze';
import { tag } from './lib/clarity';
import { ping } from './lib/notify';
import { PLATFORMS } from './lib/platforms';
import { judge } from './lib/rules';
import {
  browserId,
  loadComparisons,
  loadProfile,
  logOutcome,
  patchComparison,
  pendingOutcome,
  saveComparison,
  saveProfile,
} from './lib/storage';
import type { ComparisonRecord, ImageAnalysis, Outcome, Profile, Slot } from './lib/types';
import { LogoMark } from './components/Logo';
import { MethodView } from './components/Method';
import { OutcomeModal } from './components/Outcome';
import { ProfileView, profileStrength } from './components/Profile';
import { ResultView } from './components/Result';
import { AnalyzingView, UploadView } from './components/Upload';

type View = 'compare' | 'profile' | 'method';
type Phase = 'upload' | 'analyzing' | 'result';

function blankProfile(): Profile {
  const now = Date.now();
  return { browserId: browserId(), platform: 'youtube', audience: '', topics: '', tones: [], worked: '', createdAt: now, updatedAt: now };
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [view, setView] = useState<View>(() => (loadProfile() ? 'compare' : 'profile'));
  const [phase, setPhase] = useState<Phase>('upload');
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [stage, setStage] = useState<Stage>('read');
  const [pair, setPair] = useState<Record<Slot, ImageAnalysis> | null>(null);
  const [record, setRecord] = useState<ComparisonRecord | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<ComparisonRecord | null>(null);
  const [pending, setPending] = useState<ComparisonRecord | null>(() => pendingOutcome());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const platform = profile?.platform ?? 'youtube';
  const verdict = useMemo(() => (pair ? judge(pair, platform, profile) : null), [pair, platform, profile]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (profile) {
      tag('profile_complete', String(profileStrength(profile) === 5));
      tag('platform', profile.platform);
    }
  }, [profile]);

  const run = useCallback(async () => {
    if (!files.A || !files.B) return;
    setError(null);
    setPhase('analyzing');
    try {
      const result = await analyzePair({ A: files.A, B: files.B }, setStage);
      const v = judge(result, platform, profile);
      const rec: ComparisonRecord = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        platform,
        nameA: result.A.name,
        nameB: result.B.name,
        thumbA: result.A.thumb,
        thumbB: result.B.thumb,
        run1: v.run1,
        run2: v.run2,
        verdict: v.winner,
        confidence: v.confidence,
        reasons: v.reasons,
        profileLine: v.profileLine,
      };
      saveComparison(rec);
      tag('verdict', v.winner === 'close' ? 'too_close' : v.winner);
      ping('test', v.winner === 'close' ? 'test run, too close to call' : `test run, picked ${v.winner} (${v.confidence})`, PLATFORMS[platform].label);
      setPair((old) => {
        if (old) Object.values(old).forEach((a) => URL.revokeObjectURL(a.url));
        return result;
      });
      setRecord(rec);
      setPhase('result');
    } catch (e) {
      console.error(e);
      setError(`Couldn't read one of those images. ${e instanceof Error ? e.message : ''}`);
      setPhase('upload');
    }
  }, [files, platform, profile]);

  const reset = () => {
    setFiles({});
    setPhase('upload');
    setView('compare');
    setPending(pendingOutcome());
  };

  const saveOutcome = (o: Outcome) => {
    if (!outcomeFor) return;
    logOutcome(outcomeFor.id, o);
    tag('logged_outcome', 'true');
    ping('outcome', 'outcome logged', o.posted === 'neither' ? 'not posted yet' : `posted ${o.posted}, did ${o.performance === 'same' ? 'about the same as' : `${o.performance} than`} usual`);
    if (record?.id === outcomeFor.id) setRecord({ ...record, outcome: o });
    setOutcomeFor(null);
    setPending(pendingOutcome());
    setToast('Logged. That makes the next pick better.');
  };

  const title =
    view === 'profile' ? (profile ? 'Your audience' : 'Who are you posting for?') : view === 'method' ? 'Method' : phase === 'result' ? 'Result' : 'Compare';
  const sub =
    view === 'profile'
      ? 'Asked once. Every comparison is judged against this, not generic design rules.'
      : view === 'method'
        ? 'Measurements are facts. The verdict is a hedge.'
        : phase === 'result'
          ? `Judged for ${PLATFORMS[platform].label} · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
          : 'Two images in. A hedged pick out.';

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <button className="logo" onClick={() => setView('compare')} aria-label="Pickdot home">
          <LogoMark />
          <span className="logo-word">pickdot</span>
        </button>
        <div className="nav-links">
          {(
            [
              ['compare', 'Compare'],
              ['profile', 'Audience'],
              ['method', 'Method'],
            ] as [View, string][]
          ).map(([v, l]) => (
            <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)} disabled={!profile && v === 'compare'}>
              {l}
            </button>
          ))}
        </div>
        <div className="nav-right">
          {profile &&
            (profileStrength(profile) === 5 ? (
              <span className="chip ok">
                <span className="dot" />
                Profile complete
              </span>
            ) : (
              <button className="chip warn" onClick={() => setView('profile')}>
                <span className="dot" />
                Profile thin
              </button>
            ))}
        </div>
      </nav>

      <header className="head">
        <h1>{title}</h1>
        <span className="sub">{sub}</span>
        {view === 'compare' && phase === 'result' && (
          <div className="actions">
            <button className="btn" onClick={() => setPhase('upload')}>
              Swap an image
            </button>
            <button className="btn btn-pink" onClick={reset}>
              New comparison
            </button>
          </div>
        )}
      </header>

      <main>
        {view === 'profile' && (
          <ProfileView
            initial={profile ?? blankProfile()}
            firstRun={!profile}
            onSave={(p) => {
              saveProfile(p);
              setProfile(p);
              setView('compare');
              setToast('Profile saved on this device.');
            }}
          />
        )}
        {view === 'method' && <MethodView />}
        {view === 'compare' && phase === 'upload' && (
          <UploadView
            profile={profile}
            files={files}
            setFile={(s, f) => setFiles((x) => ({ ...x, [s]: f }))}
            onRun={run}
            onEditProfile={() => setView('profile')}
            pending={pending}
            onPending={() => pending && setOutcomeFor(pending)}
            onDismissPending={() => {
              if (pending) patchComparison(pending.id, { outcomeDismissed: true });
              setPending(pendingOutcome());
            }}
            error={error}
          />
        )}
        {view === 'compare' && phase === 'analyzing' && files.A && files.B && (
          <AnalyzingView files={{ A: files.A, B: files.B }} stage={stage} />
        )}
        {view === 'compare' && phase === 'result' && pair && verdict && record && (
          <ResultView
            pair={pair}
            verdict={verdict}
            platform={platform}
            logged={!!record.outcome}
            onOutcome={() => setOutcomeFor(loadComparisons().find((c) => c.id === record.id) ?? record)}
          />
        )}
      </main>

      {/* Portalled: the shell's backdrop-filter would trap position: fixed. */}
      {createPortal(
        <>
          {outcomeFor && <OutcomeModal record={outcomeFor} onSave={saveOutcome} onClose={() => setOutcomeFor(null)} />}
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </>,
        document.body,
      )}
    </div>
  );
}
