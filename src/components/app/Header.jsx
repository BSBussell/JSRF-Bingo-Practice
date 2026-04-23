import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../../lib/session/sessionTypes.js";
import { SEED_BUILDER_MODE } from "../../lib/seedBuilder.js";

function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M19.43 12.98a7.76 7.76 0 0 0 .05-.98 7.76 7.76 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.32 7.32 0 0 0-1.7-.98l-.38-2.65a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42L9.11 5.07a7.32 7.32 0 0 0-1.7.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.76 7.76 0 0 0-.05.98 7.76 7.76 0 0 0 .05.98L2.44 14.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1a7.32 7.32 0 0 0 1.7.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65a7.32 7.32 0 0 0 1.7-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

export function Header({
  activeMode,
  hasActiveSession,
  currentSessionType,
  releaseAction,
  releaseActionLoading,
  onOpenHome,
  onSelectPractice,
  onSelectRoute,
  onSelectSeedBuilder,
  onSelectBingopedia,
  onSelectStats,
  onSelectSettings
}) {
  const showReleaseSlot = Boolean(releaseAction) || releaseActionLoading;
  const isPlayActive =
    activeMode === PRACTICE_SESSION_TYPE || activeMode === ROUTE_SESSION_TYPE;
  const isDataActive =
    activeMode === "bingopedia" || activeMode === "stats" || activeMode === SEED_BUILDER_MODE;

  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onOpenHome}>
        <span className="brand-kicker">The Bee's</span>
        <strong>JSRF Bingus Trainer</strong>
      </button>

      <nav className="main-nav" aria-label="Practice modes">
        <div className="nav-group">
          <button
            className={`nav-link nav-group-trigger ${isPlayActive ? "is-active" : ""}`}
            type="button"
            aria-haspopup="menu"
          >
            <span className="nav-group-trigger-label">Play</span>
            <span className="nav-group-trigger-icon" aria-hidden="true">▾</span>
          </button>
          <div className="nav-group-menu" role="menu" aria-label="Play modes">
            <button
              className={`nav-group-item ${activeMode === PRACTICE_SESSION_TYPE ? "is-active" : ""}`}
              type="button"
              role="menuitem"
              onClick={onSelectPractice}
            >
              Drill
              {hasActiveSession && currentSessionType === PRACTICE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
            </button>
            <button
              className={`nav-group-item ${activeMode === ROUTE_SESSION_TYPE ? "is-active" : ""}`}
              type="button"
              role="menuitem"
              onClick={onSelectRoute}
            >
              Routing
              {hasActiveSession && currentSessionType === ROUTE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
            </button>
          </div>
        </div>

        <div className="nav-group">
          <button
            className={`nav-link nav-group-trigger ${isDataActive ? "is-active" : ""}`}
            type="button"
            aria-haspopup="menu"
          >
            <span className="nav-group-trigger-label">Data</span>
            <span className="nav-group-trigger-icon" aria-hidden="true">▾</span>
          </button>
          <div className="nav-group-menu" role="menu" aria-label="Data views">
            <button
              className={`nav-group-item ${activeMode === "bingopedia" ? "is-active" : ""}`}
              type="button"
              role="menuitem"
              onClick={onSelectBingopedia}
            >
              Bingopedia
            </button>
            <button
              className={`nav-group-item ${activeMode === "stats" ? "is-active" : ""}`}
              type="button"
              role="menuitem"
              onClick={onSelectStats}
            >
              Stats
            </button>
            <button
              className={`nav-group-item ${activeMode === SEED_BUILDER_MODE ? "is-active" : ""}`}
              type="button"
              role="menuitem"
              onClick={onSelectSeedBuilder}
            >
              Seed Builder
            </button>
          </div>
        </div>

        <button
          className={`nav-link nav-link-icon ${activeMode === "settings" ? "is-active" : ""}`}
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={onSelectSettings}
        >
          <span className="nav-link-icon-glyph">
            <SettingsGearIcon />
          </span>
        </button>
        {showReleaseSlot ? (
          <span className="header-release-slot">
            {releaseAction ? (
              <button
                className={`nav-link release-nav-link ${
                  releaseAction.tone === "highlight" ? "is-highlight" : ""
                }`}
                type="button"
                title={releaseAction.title}
                onClick={releaseAction.onClick}
              >
                {releaseAction.label}
              </button>
            ) : (
              <span className="nav-link release-nav-link is-placeholder" aria-hidden="true">
                Download
              </span>
            )}
          </span>
        ) : null}
      </nav>
    </header>
  );
}
