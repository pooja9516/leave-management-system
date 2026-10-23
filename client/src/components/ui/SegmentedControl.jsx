/** Row of mutually exclusive buttons (e.g. status tabs). Scrolls sideways on small screens. */
export default function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`segmented__item${value === opt.value ? ' is-active' : ''}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="segmented__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
