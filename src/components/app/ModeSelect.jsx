import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../../lib/session/sessionTypes.js";

function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M19.43 12.98a7.76 7.76 0 0 0 .05-.98 7.76 7.76 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.32 7.32 0 0 0-1.7-.98l-.38-2.65a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42L9.11 5.07a7.32 7.32 0 0 0-1.7.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.76 7.76 0 0 0-.05.98 7.76 7.76 0 0 0 .05.98L2.44 14.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1a7.32 7.32 0 0 0 1.7.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65a7.32 7.32 0 0 0 1.7-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

function ModeTile({
  label,
  title,
  description,
  actionLabel,
  onAction,
  variant = "data",
  featured = false
}) {
  return (
    <article className={`mode-tile mode-tile-${variant} ${featured ? "is-featured" : ""}`}>
      <div className="mode-tile-copy">
        <p className="mode-label">{label}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button
        className={`${featured ? "primary-button" : "secondary-button"} mode-tile-action`}
        type="button"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </article>
  );
}

export function ModeSelect({
  onSelectPractice,
  onSelectRoute,
  onSelectSeedBuilder,
  onSelectBingopedia,
  onSelectStats,
  onSelectSettings,
  hasActiveSession,
  currentSessionType
}) {
  return (
    <section className="panel hero-panel mode-select-panel">
      <div className="mode-select-atmo" aria-hidden="true" />

      <div className="panel-copy mode-select-copy mode-select-copy-centered">
        <p className="eyebrow">The Bee's</p>
        <h1>JSRF Bingus Tool!</h1>
        <p className="hero-copy">
          A tool with a bunch of practice modes, stat tracking, and way too much theme customization to help you prepare for Bingo!
        </p>
      </div>

      <div className="mode-feature-grid">
        <ModeTile
          label="gaming"
          title="Square Practice"
          description="Practice one square at a time and track splits, PBs, and square stats!"
          actionLabel={
            hasActiveSession && currentSessionType === PRACTICE_SESSION_TYPE
              ? "Resume Practice"
              : "Start Practice"
          }
          onAction={onSelectPractice}
          variant="play"
          featured
        />
        <ModeTile
          label="gaming"
          title="Routing Practice"
          description="Train pathing with a visible grid and test your ability to route between squares."
          actionLabel={
            hasActiveSession && currentSessionType === ROUTE_SESSION_TYPE
              ? "Resume Route"
              : "Start Route"
          }
          onAction={onSelectRoute}
          variant="route"
          featured
        />
      </div>

      <div className="mode-secondary-grid">
        <ModeTile
          label="Data"
          title="Seed Builder"
          description="Build exact drills and export as replayable seeds."
          actionLabel="Open Seed Builder"
          onAction={onSelectSeedBuilder}
          variant="data"
        />
        <ModeTile
          label="Data"
          title="Bingopedia"
          description="Browse square references, video guides, and square specific stats!"
          actionLabel="Open Bingopedia"
          onAction={onSelectBingopedia}
          variant="data"
        />
        <ModeTile
          label="Data"
          title="Stats"
          description="Review seed PBs, averages, and run history."
          actionLabel="Open Stats"
          onAction={onSelectStats}
          variant="data"
        />
      </div>

      <div className="mode-settings-footer">
        <button
          className="ghost-button mode-settings-gear-button"
          type="button"
          aria-label="Open Settings"
          onClick={onSelectSettings}
        >
          <span className="mode-gear-icon" aria-hidden="true">
            <SettingsGearIcon />
          </span>
        </button>
      </div>
    </section>
  );
}
