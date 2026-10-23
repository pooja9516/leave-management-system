import { CalendarRange, Loader2 } from 'lucide-react';
import Alert from '../../components/ui/Alert';
import { formatDays, formatDate } from '../../utils/format';

const describeExcluded = ({ weekendDates, holidays }) => {
  const parts = [];
  const weekends = weekendDates.length;
  if (weekends) parts.push(`${weekends} weekend ${weekends === 1 ? 'day' : 'days'}`);
  holidays.forEach((h) => parts.push(`${h.name} (${formatDate(h.date)})`));
  return parts.length ? `Not counted: ${parts.join(', ')}.` : '';
};

/** Shows how many days the request uses and the balance left afterwards. */
export default function LeaveSummary({ preview, typeLabel, available }) {
  if (preview.status === 'idle') {
    return (
      <div className="leave-summary leave-summary--muted">
        <CalendarRange aria-hidden="true" />
        <p>Pick your dates to see how many days this request will use.</p>
      </div>
    );
  }

  if (preview.status === 'loading' && !preview.data) {
    return (
      <div className="leave-summary leave-summary--muted" role="status">
        <Loader2 className="spinner" aria-hidden="true" />
        <p>Calculating working days…</p>
      </div>
    );
  }

  if (preview.status === 'error') {
    return <Alert variant="error">{preview.error.message}</Alert>;
  }

  const { days } = preview.data;
  const remaining = available === undefined ? undefined : available - days;
  const excluded = describeExcluded(preview.data);

  return (
    <div className="leave-summary" aria-live="polite">
      <div className="leave-summary__main">
        <p className="leave-summary__label">This request uses</p>
        <p className="leave-summary__value">
          {formatDays(days)} <span>of {typeLabel.toLowerCase()}</span>
        </p>
        {excluded && <p className="leave-summary__note">{excluded}</p>}
      </div>

      {available !== undefined && (
        <dl className="leave-summary__stats">
          <div>
            <dt>Available now</dt>
            <dd>{formatDays(available)}</dd>
          </div>
          <div>
            <dt>Left after approval</dt>
            <dd className={remaining < 0 ? 'is-negative' : ''}>{formatDays(Math.max(0, remaining))}</dd>
          </div>
        </dl>
      )}

      {preview.data.overlap && (
        <Alert variant="error">
          {preview.data.overlap.message}. Pending and approved leaves can't overlap, so please choose different dates.
        </Alert>
      )}
      {days === 0 && (
        <Alert variant="warning">These dates are all weekends or holidays. Please choose at least one working day.</Alert>
      )}
      {days > 0 && remaining < 0 && (
        <Alert variant="error">
          You only have {formatDays(available)} of {typeLabel.toLowerCase()} available. Shorten the dates or choose
          another leave type.
        </Alert>
      )}
    </div>
  );
}
