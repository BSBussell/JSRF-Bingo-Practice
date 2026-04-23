export function TimerDisplay({
  label,
  formattedElapsed,
  isRunning,
  isPaused,
  emphasis,
  children
}) {
  return (
    <div className={`timer-pill ${isRunning ? "is-running" : ""} ${emphasis ?? ""}`}>
      <span className="timer-label">{label}</span>
      <strong>{formattedElapsed}</strong>
      {children}
    </div>
  );
}
