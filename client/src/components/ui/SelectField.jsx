import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

/** Styled native <select>: accessible and mobile-friendly by default. */
export default function SelectField({ label, id, options, className = '', ...props }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="select-wrap">
        <select id={selectId} className="field__control field__control--select" {...props}>
          {options.map(({ value, label: text }) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <ChevronDown className="select-wrap__icon" aria-hidden="true" />
      </div>
    </div>
  );
}
