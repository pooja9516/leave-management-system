import { CalendarOff } from 'lucide-react';
import { listHolidays } from '../../api/holidays';
import { useFetch } from '../../hooks/useFetch';
import { EmptyState, ErrorState } from '../../components/ui/States';
import Skeleton from '../../components/ui/Skeleton';
import { dateKey, dayOfMonth, formatMonth, formatWeekday, formatDate, relativeDays, todayKey } from '../../utils/format';

const SHOW = 5;

export default function UpcomingHolidays() {
  const { data, error, loading, reload } = useFetch((signal) => listHolidays({ limit: 100 }, { signal }));
  const today = todayKey();
  const upcoming = (data?.data || []).filter((h) => dateKey(h.date) >= today).slice(0, SHOW);

  return (
    <section className="card" aria-labelledby="holidays-title">
      <header className="card__header">
        <div>
          <h2 id="holidays-title" className="card__title">
            Upcoming holidays
          </h2>
          <p className="card__subtitle">Not counted as leave days</p>
        </div>
      </header>

      <div className="card__body card__body--flush">
        {loading && !data && (
          <ul className="holiday-list" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="holiday-item">
                <Skeleton width={44} height={44} />
                <div className="holiday-item__text">
                  <Skeleton width="60%" />
                  <Skeleton width="40%" height={12} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <ErrorState title="Couldn't load holidays" error={error} onRetry={reload} />}

        {!loading && !error && upcoming.length === 0 && (
          <EmptyState icon={CalendarOff} title="No upcoming holidays">
            Holidays added by your admin will show up here.
          </EmptyState>
        )}

        {!error && upcoming.length > 0 && (
          <ul className="holiday-list">
            {upcoming.map((h) => (
              <li key={h._id} className="holiday-item">
                <span className="date-chip" aria-hidden="true">
                  <span className="date-chip__month">{formatMonth(h.date)}</span>
                  <span className="date-chip__day">{dayOfMonth(h.date)}</span>
                </span>
                <div className="holiday-item__text">
                  <p className="holiday-item__name" title={h.name}>
                    {h.name}
                  </p>
                  <p className="holiday-item__date">
                    <span className="sr-only">{formatDate(h.date)}, </span>
                    {formatWeekday(h.date)} · {relativeDays(h.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
