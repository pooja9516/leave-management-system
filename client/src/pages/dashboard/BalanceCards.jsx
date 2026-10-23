import { LEAVE_TYPES } from '../../constants';
import { formatDays } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/States';

/** items: [{ type, total, balance, pending, available }] from GET /api/leaves/balance */
export default function BalanceCards({ items, loading, error, onRetry }) {
  if (error) {
    return (
      <div className="card">
        <ErrorState title="Couldn't load your leave balance" error={error} onRetry={onRetry} />
      </div>
    );
  }

  const byType = Object.fromEntries((items || []).map((b) => [b.type, b]));

  return (
    <div className="grid grid--stats">
      {LEAVE_TYPES.map(({ key, label, icon: Icon }) => {
        const b = byType[key];
        const pct = b ? Math.min(100, Math.round((b.available / b.total) * 100)) : 0;
        const tone = b && b.available === 0 ? ' progress__bar--empty' : pct <= 25 ? ' progress__bar--low' : '';

        return (
          <article key={key} className="card stat-card">
            <div className="stat-card__head">
              <span className="icon-chip">
                <Icon aria-hidden="true" />
              </span>
              <h3>{label}</h3>
            </div>

            {loading && !b ? (
              <>
                <Skeleton width={96} height={32} />
                <Skeleton height={6} />
                <Skeleton width="70%" height={12} />
              </>
            ) : (
              <>
                <p className="stat-card__value">
                  <strong>{b.available}</strong>
                  <span>{b.available === 1 ? 'day available' : 'days available'}</span>
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={`${label} available`}
                  aria-valuemin={0}
                  aria-valuemax={b.total}
                  aria-valuenow={b.available}
                >
                  <div className={`progress__bar${tone}`} style={{ '--value': `${pct}%` }} />
                </div>
                <p className="stat-card__meta">
                  {formatDays(b.total - b.balance)} used of {b.total}
                  {b.pending > 0 && <span className="stat-card__pending"> · {b.pending} pending approval</span>}
                </p>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
