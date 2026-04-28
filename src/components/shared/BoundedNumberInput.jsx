import { useEffect, useState } from "react";

import { resolveBoundedNumberCommit } from "../../lib/boundedNumberInput.js";

function defaultFormatValue(value) {
  return String(value ?? "");
}

export function BoundedNumberInput({
  value,
  min,
  max,
  step,
  disabled = false,
  className,
  name,
  id,
  required = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  normalizeValue = (nextValue) => nextValue,
  parseValue,
  formatValue = defaultFormatValue,
  onCommit
}) {
  const [draftValue, setDraftValue] = useState(() => formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(formatValue(value));
    }
  }, [formatValue, isFocused, value]);

  function commitValue() {
    const nextValue = resolveBoundedNumberCommit({
      draftValue,
      committedValue: value,
      min,
      max,
      parseValue,
      normalizeValue
    });

    onCommit(nextValue);
    setDraftValue(formatValue(nextValue));
    return nextValue;
  }

  function revertValue() {
    setDraftValue(formatValue(value));
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draftValue}
      disabled={disabled}
      className={className}
      name={name}
      id={id}
      required={required}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commitValue();
      }}
      onChange={(event) => setDraftValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitValue();
          event.currentTarget.blur();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          revertValue();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
