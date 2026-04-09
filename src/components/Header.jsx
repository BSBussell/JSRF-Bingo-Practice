export function Header({
  activeMode,
  hasActiveSession,
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
      </nav>
    </header>
  );
}
