import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../lib/session/sessionTypes.js";

export function ModeSelect({
  onSelectPractice,
  onSelectRoute,
  onSelectStats,
  onSelectSettings,
  hasActiveSession,
  currentSessionType
}) {
  return (
    <section className="panel hero-panel">
      <div className="panel-copy">
        <p className="eyebrow">Mode Select</p>
        <h1>JSRF Bingus Trainer</h1>
        <p className="hero-copy">
          A WIP tool for practicing Jet Set Radio Future bingo squares. 
          It includes multiple modes, 
          and a route generator that allows you to favor nearby squares so your runs 
          flow through the game instead of jumping between distant areas.
        </p>
      </div>

      <div className="mode-grid">
        <article className="mode-card">
          <div>
            <p className="mode-label">Minimal Gaming</p>
            <h2>Practice</h2>
            <p>
              Start from a chosen level and be assigned random squares to complete.
              Track your found tapes, personal bests, and overall progress.
              Route guide videos can be shown or hidden at any time during a run.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectPractice}>
            {hasActiveSession && currentSessionType === PRACTICE_SESSION_TYPE
              ? "Resume Practice"
              : "Start Practice"}
          </button>
        </article>
        <article className="mode-card">
          <div>
            <p className="mode-label">Pathing Grid</p>
            <h2>Route</h2>
            <p>
              Load a set of squares into a live grid. Where you can choose between multiple presented
              squares to choose from with 2-10 squares shown at a time! This mode is made to help
              practice routing between multiple squares!
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectRoute}>
            {hasActiveSession && currentSessionType === ROUTE_SESSION_TYPE ? "Resume Route" : "Start Route"}
          </button>
        </article>
        <article className="mode-card">
          <div>
            <p className="mode-label">Progress Lab</p>
            <h2>Stats</h2>
            <p>
              Review seed PBs, route runbacks, area split tables, and grouped run history.
              Clean up old runs without resetting the rest of your progress.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onSelectStats}>
            Open Stats
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
