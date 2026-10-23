import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="field__error">
      <AlertCircle aria-hidden="true" />
      {children}
    </p>
  );
}

/** Labelled input with hint and error message wired up for screen readers. */
const TextField = forwardRef(function TextField({ label, error, hint, id, className = '', children, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  const input = (
    <input
      ref={ref}
      id={inputId}
      className="field__control"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );

  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      {children ? children(input) : input}
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

export default TextField;
