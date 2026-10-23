import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';

/** Search input that reports changes after the user pauses typing. */
export default function SearchField({ label, value, onChange, placeholder, delay = 300, className = '' }) {
  const id = useId();
  const [text, setText] = useState(value);

  // Keep in sync when the value changes from outside (e.g. "Clear filters").
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return undefined;
    const timer = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap input-wrap--search">
        <Search className="input-wrap__icon" aria-hidden="true" />
        <input
          id={id}
          type="search"
          className="field__control"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        {text && (
          <button
            type="button"
            className="input-wrap__action"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              onChange('');
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
