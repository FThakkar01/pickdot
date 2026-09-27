export function MethodView() {
  return (
    <div className="method-grid">
      <section className="card">
        <h3>What it honestly claims</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          When an AI predicts which variant wins, it gets the direction right about 70% of the time and overstates the size
          of the difference. So Pickdot states measurements as facts and verdicts as hedges — and never blurs the two.
        </p>
        <table className="claims">
          <thead>
            <tr>
              <th>Pickdot may say</th>
              <th>Pickdot may not say</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>"A is more likely to perform better"</td><td>"A will perform better"</td></tr>
            <tr><td>"Moderate confidence"</td><td>"92% confident"</td></tr>
            <tr><td>"The focal point lands faster in A"</td><td>"A will get 23% more engagement"</td></tr>
            <tr><td>"These two are too close to call"</td><td>A forced winner every time</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>How it measures</h3>
        <div className="layers">
          <div className="layer">
            <span className="ln">1</span>
            <div>
              Canvas maths · zero download
              <p>WCAG contrast, luminance histogram and clipping, Sobel edge density, 4-bit palette count, edge-weighted centroid vs thirds, dominant colour.</p>
            </div>
          </div>
          <div className="layer">
            <span className="ln">2</span>
            <div>
              Attention, text, faces · in a Web Worker
              <p>
                Spectral-residual saliency on opponent colour channels with centre and face priors. Text-line detection by
                morphological gradient and stroke rhythm. MediaPipe Face Landmarker for size, pose and expression.
              </p>
            </div>
          </div>
          <div className="layer">
            <span className="ln">3</span>
            <div>
              Verdict · a readable rule set
              <p>
                Text under 14px at feed size and contrast under 3:1 are hard fails. Focused attention beats split attention.
                Faces under 8% of frame and busy images are soft signals, weighted by your profile. A-then-B and B-then-A must agree.
              </p>
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Nothing leaves your browser. The face model downloads once and is cached.
        </p>
      </section>
    </div>
  );
}
