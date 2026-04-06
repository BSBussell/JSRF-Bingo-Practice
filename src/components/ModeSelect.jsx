export function ModeSelect({
  onSelectDrills,
  onSelectLearn,
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
            <h2>Drills</h2>
            <p>
              Start from a chosen level and be assigned random objectives to complete,
              Tracks your found objects, personal bests, and overall progress.
              Will assume starting from a fresh bingo save.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectDrills}>
            {hasActiveSession ? "Resume Drills" : "Enter Drills"}
          </button>
        </article>
        <article className="mode-card">
          <div>
            <p className="mode-label">Bingopedia-backed</p>
            <h2>Learn</h2>
            <p>
              The same as Drill mode, but each objective will also present the relevant
              Bingopedia entry for the objective, good for bee's who don't know anything yet.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectLearn}>
            {hasActiveSession ? "Resume Learn" : "Enter Learn"}
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
