import { useId } from 'react';

export default function Checkbox({ label, hint, id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="checkbox">
      <input id={inputId} type="checkbox" className="checkbox__input" aria-describedby={hint ? `${inputId}-hint` : undefined} {...props} />
      <div>
        <label htmlFor={inputId} className="checkbox__label">
          {label}
        </label>
        {hint && (
          <p id={`${inputId}-hint`} className="field__hint">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
