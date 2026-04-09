export function Header({
  activeMode,
  hasActiveSession,
  releaseAction,
  releaseActionLoading,
  onOpenHome,
  onSelectPractice,
  onSelectSettings
}) {
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onOpenHome}>
        <span className="brand-kicker">The Bee's</span>
        <strong>JSRF Bingus Trainer</strong>
      </button>

      <nav className="main-nav" aria-label="Practice modes">
        <button
          className={`nav-link ${activeMode === "practice" ? "is-active" : ""}`}
          type="button"
          onClick={onSelectPractice}
        >
          Practice
          {hasActiveSession && activeMode === "practice" ? <span className="nav-badge">Live</span> : null}
        </button>
        <button
          className={`nav-link ${activeMode === "settings" ? "is-active" : ""}`}
          type="button"
          onClick={onSelectSettings}
        >
          Settings
        </button>
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
          ) : releaseActionLoading ? (
            <span className="nav-link release-nav-link is-placeholder" aria-hidden="true">
              Download
            </span>
          ) : null}
        </span>
      </nav>
    </header>
  );
}
