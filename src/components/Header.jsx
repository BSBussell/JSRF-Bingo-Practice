import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../lib/session/sessionTypes.js";

export function Header({
  activeMode,
  hasActiveSession,
  currentSessionType,
  releaseAction,
  releaseActionLoading,
  onOpenHome,
  onSelectPractice,
  onSelectRoute,
  onSelectStats,
  onSelectSettings
}) {
  const showReleaseSlot = Boolean(releaseAction) || releaseActionLoading;

  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onOpenHome}>
        <span className="brand-kicker">The Bee's</span>
        <strong>JSRF Bingus Trainer</strong>
      </button>

      <nav className="main-nav" aria-label="Practice modes">
        <button
          className={`nav-link ${activeMode === PRACTICE_SESSION_TYPE ? "is-active" : ""}`}
          type="button"
          onClick={onSelectPractice}
        >
          Practice
          {hasActiveSession && currentSessionType === PRACTICE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
        </button>
        <button
          className={`nav-link ${activeMode === ROUTE_SESSION_TYPE ? "is-active" : ""}`}
          type="button"
          onClick={onSelectRoute}
        >
          Route
          {hasActiveSession && currentSessionType === ROUTE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
        </button>
        <button
          className={`nav-link ${activeMode === "stats" ? "is-active" : ""}`}
          type="button"
          onClick={onSelectStats}
        >
          Stats
        </button>
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
