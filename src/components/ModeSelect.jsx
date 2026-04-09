export function ModeSelect({
  onSelectPractice,
  onSelectSettings,
  hasActiveSession
}) {
  return (
    <section className="panel hero-panel">
      <div className="panel-copy">
        <p className="eyebrow">Practice Mode Select</p>
        <h1>JSRF Bingus Trainer</h1>
        <p className="hero-copy">
          This is a WIP tool for practicing chasing after bingo objectives in Jet Set Radio Future.
          It will give you an objective to chase after, and times how long it takes you to complete it.
          Then tracks the world state and gives you a new objective to chase after, 
          with various options for how objectives are selected.
        </p>
      </div>

      <div className="mode-grid">
        <article className="mode-card">
          <div>
            <p className="mode-label">Minimal Gaming</p>
            <h2>Practice</h2>
            <p>
              Start from a chosen level and be assigned random objectives to complete.
              Track your found objects, personal bests, and overall progress.
              Route guide videos can be shown or hidden at any time during a run.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectPractice}>
            {hasActiveSession ? "Resume Session" : "Start Practice"}
          </button>
        </article>
        <article className="mode-card">
          <div>
            <p className="mode-label">Control room</p>
            <h2>Settings</h2>
            <p>
              Configure in-app hotkeys, learn video playback defaults, and
              reset all saved data
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectSettings}>
            Open Settings
          </button>
        </article>
      </div>
    </section>
  );
}
