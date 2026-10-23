import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { listTeamLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { leaveTypeLabel } from '../../constants';
import { formatDateRange, formatDays } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

// Manager dashboard: the next team requests awaiting a decision.
export default function TeamPendingCard() {
  const { data, error, loading, reload } = useFetch((signal) => listTeamLeaves({ status: 'pending', limit: 5 }, { signal }));
  const leaves = data?.data || [];
  const total = data?.pagination.total ?? 0;

  return (
    <section className="card card--accent" aria-labelledby="team-pending-title">
      <header className="card__header">
        <div>
          <h2 id="team-pending-title" className="card__title">
            Waiting for your approval
            {total > 0 && <span className="count-pill">{total}</span>}
          </h2>
          <p className="card__subtitle">Leave requests from your team, soonest first</p>
        </div>
        {total > 0 && (
          <Link to="/team" className="btn btn--primary btn--sm">
            Review
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="card__body card__body--flush">
        {error && <ErrorState title="Couldn't load team requests" error={error} onRetry={reload} />}
        {!error && !loading && leaves.length === 0 && (
          <EmptyState icon={CheckCircle2} title="All caught up">
            No team requests are waiting for you.
          </EmptyState>
        )}
        {!error && (leaves.length > 0 || loading) && (
          <ul className="list">
            {loading && !data
              ? Array.from({ length: 2 }, (_, i) => (
                  <li key={i} className="list__item">
                    <div className="list__text">
                      <Skeleton width="45%" />
                      <Skeleton width="30%" height={12} />
                    </div>
                  </li>
                ))
              : leaves.map((l) => (
                  <li key={l._id} className="list__item">
                    <div className="cell-user">
                      <Avatar name={l.employee?.name} />
                      <div className="list__text">
                        <p className="list__title">{l.employee?.name}</p>
                        <p className="list__sub">
                          {leaveTypeLabel(l.leaveType)} · {formatDays(l.days)} · {formatDateRange(l.startDate, l.endDate)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
          </ul>
        )}
      </div>
    </section>
  );
}
