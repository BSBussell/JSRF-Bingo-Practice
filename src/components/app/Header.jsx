import { useEffect, useState } from "react";
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

function MenuGlyphIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7L7 7M20 7L11 7" />
      <path d="M20 17H17M4 17L13 17" />
      <path d="M4 12H7L20 12" />
    </svg>
  );
}

function BackChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.5 5.5L8 12l6.5 6.5" />
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const showReleaseSlot = Boolean(releaseAction) || releaseActionLoading;
  const isPlayActive =
    activeMode === PRACTICE_SESSION_TYPE || activeMode === ROUTE_SESSION_TYPE;
  const isDataActive =
    activeMode === "bingopedia" || activeMode === "stats" || activeMode === SEED_BUILDER_MODE;

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.body.classList.toggle("mobile-menu-open", isMobileMenuOpen);

    return () => {
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mobileBreakpointQuery = window.matchMedia("(max-width: 720px)");
    const handleViewportChange = (event) => {
      if (!event.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    if (typeof mobileBreakpointQuery.addEventListener === "function") {
      mobileBreakpointQuery.addEventListener("change", handleViewportChange);
      return () => {
        mobileBreakpointQuery.removeEventListener("change", handleViewportChange);
      };
    }

    mobileBreakpointQuery.addListener(handleViewportChange);
    return () => {
      mobileBreakpointQuery.removeListener(handleViewportChange);
    };
  }, []);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function handleMobileNavigate(action) {
    action();
    closeMobileMenu();
  }

  return (
    <>
      <header className="app-header">
        <button className="brand-button" type="button" onClick={onOpenHome}>
          <span className="brand-kicker">The Bee's</span>
          <strong>JSRF Bingus Trainer</strong>
        </button>
        {!isMobileMenuOpen ? (
          <button
            className="mobile-menu-trigger nav-link"
            type="button"
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-main-menu"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span className="mobile-menu-trigger-icon">
              <MenuGlyphIcon />
            </span>
          </button>
        ) : null}

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
              Square
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

      <div
        className={`mobile-nav-overlay ${isMobileMenuOpen ? "is-open" : ""}`}
        id="mobile-main-menu"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="mobile-nav-header">
          <button
            className="mobile-nav-back-button"
            type="button"
            onClick={closeMobileMenu}
          >
            <span className="mobile-nav-back-icon" aria-hidden="true">
              <BackChevronIcon />
            </span>
            <span className="visually-hidden">Back</span>
          </button>
        </div>
        <nav className="mobile-nav-menu" aria-label="Mobile menu">
          <section className="mobile-nav-group" aria-label="Play">
            <h2>Play</h2>
            <button
              className={`mobile-nav-item ${activeMode === PRACTICE_SESSION_TYPE ? "is-active" : ""}`}
              type="button"
              onClick={() => handleMobileNavigate(onSelectPractice)}
            >
              <span className="mobile-nav-item-prefix" aria-hidden="true">|</span>
              <span>Square</span>
              {hasActiveSession && currentSessionType === PRACTICE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
            </button>
            <button
              className={`mobile-nav-item ${activeMode === ROUTE_SESSION_TYPE ? "is-active" : ""}`}
              type="button"
              onClick={() => handleMobileNavigate(onSelectRoute)}
            >
              <span className="mobile-nav-item-prefix" aria-hidden="true">|</span>
              <span>Route</span>
              {hasActiveSession && currentSessionType === ROUTE_SESSION_TYPE ? <span className="nav-badge">Live</span> : null}
            </button>
          </section>

          <section className="mobile-nav-group" aria-label="Data">
            <h2>Data</h2>
            <button
              className={`mobile-nav-item ${activeMode === "bingopedia" ? "is-active" : ""}`}
              type="button"
              onClick={() => handleMobileNavigate(onSelectBingopedia)}
            >
              <span className="mobile-nav-item-prefix" aria-hidden="true">|</span>
              <span>Bingopedia</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMode === "stats" ? "is-active" : ""}`}
              type="button"
              onClick={() => handleMobileNavigate(onSelectStats)}
            >
              <span className="mobile-nav-item-prefix" aria-hidden="true">|</span>
              <span>Stats</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMode === SEED_BUILDER_MODE ? "is-active" : ""}`}
              type="button"
              onClick={() => handleMobileNavigate(onSelectSeedBuilder)}
            >
              <span className="mobile-nav-item-prefix" aria-hidden="true">|</span>
              <span>Seed Builder</span>
            </button>
          </section>

          <button
            className={`mobile-nav-item mobile-nav-top-item ${activeMode === "settings" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleMobileNavigate(onSelectSettings)}
          >
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </>
  );
}
