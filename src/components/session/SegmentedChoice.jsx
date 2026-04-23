export function SegmentedChoice({
  label,
  value,
  disabled,
  options,
  hint,
  onChange
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`segmented-control ${disabled ? "is-disabled" : ""}`}
        role="radiogroup"
        aria-label={label}
        style={{ "--segmented-selected-index": selectedIndex }}
      >
        <span className="segmented-control-indicator" aria-hidden="true" />
        {options.map((option) => {
          const checked = option.value === value;

          return (
            <button
              key={option.value}
              className={`segmented-control-option ${checked ? "is-selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
