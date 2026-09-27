/**
 * Both images at true CSS size inside a mock feed. No measurement, no
 * judgement — just what a phone actually shows.
 */
import { PLATFORMS } from '../lib/platforms';
import type { ImageAnalysis, Platform, Slot } from '../lib/types';

const sk = (w: number | string, h = 8, o = 0.12): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: 99,
  background: `rgba(255,255,255,${o})`,
});

function Tag({ s }: { s: Slot }) {
  return (
    <span
      className="mono"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        width: 22,
        height: 22,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 11,
        background: s === 'A' ? 'var(--pink)' : 'var(--ice)',
        color: 'var(--ink)',
        zIndex: 2,
      }}
    >
      {s}
    </span>
  );
}

function Img({ a, w, aspect }: { a: ImageAnalysis; w: number; aspect: number }) {
  return (
    <div style={{ position: 'relative', width: w, height: Math.round(w / aspect), overflow: 'hidden', background: '#000' }}>
      <img src={a.url} alt={`Option ${a.slot}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <Tag s={a.slot} />
    </div>
  );
}

export function FeedPreview({ pair, platform }: { pair: Record<Slot, ImageAnalysis>; platform: Platform }) {
  const spec = PLATFORMS[platform];
  const items = [pair.A, pair.B];
  const w = spec.displayWidth;

  if (platform === 'youtube') {
    return (
      <div style={{ display: 'flex', gap: 16, background: '#0f0f0f', padding: 16, borderRadius: 14, width: 'max-content' }}>
        {items.map((a) => (
          <div key={a.slot} style={{ width: w }}>
            <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <Img a={a} w={w} aspect={spec.aspect} />
              <span className="mono" style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.8)', fontSize: 11, padding: '1px 4px', borderRadius: 4 }}>
                12:04
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.12)', flex: 'none' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 3 }}>
                <div style={sk('92%', 10, 0.22)} />
                <div style={sk('60%', 10, 0.22)} />
                <div style={sk('45%', 8)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (platform === 'ig_post' || platform === 'ig_story') {
    const story = platform === 'ig_story';
    return (
      <div style={{ display: 'flex', gap: 16, width: 'max-content' }}>
        {items.map((a) => (
          <div key={a.slot} style={{ width: w, background: '#000', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)' }}>
            {story ? (
              <div style={{ position: 'relative' }}>
                <Img a={a} w={w} aspect={spec.aspect} />
                <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 4, zIndex: 3 }}>
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,.9)' }} />
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,.35)' }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }} />
                  <div style={sk(90, 9, 0.3)} />
                </div>
                <Img a={a} w={w} aspect={spec.aspect} />
                <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 22, height: 22, borderRadius: 6, border: '1.6px solid rgba(255,255,255,.7)' }} />
                    ))}
                  </div>
                  <div style={sk('70%', 9, 0.22)} />
                  <div style={sk('40%')} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (platform === 'linkedin') {
    return (
      <div style={{ display: 'flex', gap: 16, width: 'max-content' }}>
        {items.map((a) => (
          <div key={a.slot} style={{ width: w, background: '#1b1f23', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, padding: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                <div style={sk(120, 9, 0.28)} />
                <div style={sk(80)} />
              </div>
            </div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={sk('95%')} />
              <div style={sk('70%')} />
            </div>
            <Img a={a} w={w} aspect={spec.aspect} />
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={sk(40, 8, 0.18)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ad: 300×250 inside a mock article
  return (
    <div style={{ display: 'flex', gap: 16, width: 'max-content' }}>
      {items.map((a) => (
        <div key={a.slot} style={{ width: 360, background: '#f4f3ef', borderRadius: 12, padding: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[92, 100, 84].map((p, i) => (
            <div key={i} style={{ ...sk(`${p}%`, 8), background: 'rgba(0,0,0,.12)' }} />
          ))}
          <div style={{ margin: '8px 0', alignSelf: 'center' }}>
            <div className="mono" style={{ fontSize: 9, color: '#999', marginBottom: 2 }}>
              Advertisement
            </div>
            <Img a={a} w={300} aspect={300 / 250} />
          </div>
          {[100, 76].map((p, i) => (
            <div key={i} style={{ ...sk(`${p}%`, 8), background: 'rgba(0,0,0,.12)' }} />
          ))}
        </div>
      ))}
    </div>
  );
}
