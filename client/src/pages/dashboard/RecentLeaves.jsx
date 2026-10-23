import { Link } from 'react-router-dom';
import { ArrowRight, Inbox } from 'lucide-react';
import { listMyLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { leaveTypeLabel } from '../../constants';
import { formatDateRange, formatDays } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import StatusBadge from '../leaves/StatusBadge';

export default function RecentLeaves() {
  const { data, error, loading, reload } = useFetch((signal) => listMyLeaves({ limit: 5 }, { signal }));
  const leaves = data?.data || [];

  return (
    <section className="card" aria-labelledby="recent-leaves-title">
      <header className="card__header">
        <div>
          <h2 id="recent-leaves-title" className="card__title">
            Recent requests
          </h2>
          <p className="card__subtitle">Your latest leave requests</p>
        </div>
        {leaves.length > 0 && (
          <Link to="/leaves" className="btn btn--ghost btn--sm">
            View all
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </header>

      <div className="card__body card__body--flush">
        {error && <ErrorState title="Couldn't load your requests" error={error} onRetry={reload} />}

        {!error && !loading && leaves.length === 0 && (
          <EmptyState icon={Inbox} title="No requests yet">
            Leave you apply for will show up here.
          </EmptyState>
        )}

        {!error && (leaves.length > 0 || loading) && (
          <ul className="list">
            {loading && !data
              ? Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="list__item">
                    <div className="list__text">
                      <Skeleton width="50%" />
                      <Skeleton width="35%" height={12} />
                    </div>
                  </li>
                ))
              : leaves.map((l) => (
                  <li key={l._id} className="list__item">
                    <div className="list__text">
                      <p className="list__title">
                        {leaveTypeLabel(l.leaveType)} · {formatDays(l.days)}
                      </p>
                      <p className="list__sub">{formatDateRange(l.startDate, l.endDate)}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
          </ul>
        )}
      </div>
    </section>
  );
}
