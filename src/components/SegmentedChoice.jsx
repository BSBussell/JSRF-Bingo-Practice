export function SegmentedChoice({
  label,
  value,
  disabled,
  options,
  hint,
  onChange
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`segmented-control ${disabled ? "is-disabled" : ""}`}
        role="radiogroup"
        aria-label={label}
      >
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
