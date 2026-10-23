import { forwardRef, useId } from 'react';
import { FieldError } from './TextField';

/** Labelled textarea with an optional character counter. */
const TextAreaField = forwardRef(function TextAreaField(
  { label, error, hint, maxLength, value = '', id, className = '', ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${className}`}>
      <div className="field__label-row">
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
        {maxLength && (
          <span className={`field__counter${value.length > maxLength ? ' field__counter--over' : ''}`} aria-hidden="true">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        id={inputId}
        className="field__control field__control--textarea"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        value={value}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

export default TextAreaField;
