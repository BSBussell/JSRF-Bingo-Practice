import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../../lib/session/sessionTypes.js";
import { SEED_BUILDER_MODE } from "../../lib/seedBuilder.js";

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
          className={`nav-link ${activeMode === "settings" ? "is-active" : ""}`}
          type="button"
          onClick={onSelectSettings}
        >
          Settings
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
