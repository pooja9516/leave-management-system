import { Link } from 'react-router-dom';
import { Users, UserCheck, Briefcase, Hourglass, UserPlus, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listUsers } from '../../api/users';
import { listAllLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { ROLE_BADGE_TONE } from '../../constants';
import { greeting } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import UpcomingHolidays from './UpcomingHolidays';

const STATS = [
  { key: 'total', label: 'Total users', icon: Users, load: listUsers, params: {}, to: '/admin/users' },
  { key: 'employees', label: 'Active employees', icon: UserCheck, load: listUsers, params: { role: 'employee', isActive: 'true' }, to: '/admin/users?role=employee&active=true' },
  { key: 'managers', label: 'Active managers', icon: Briefcase, load: listUsers, params: { role: 'manager', isActive: 'true' }, to: '/admin/users?role=manager&active=true' },
  { key: 'pending', label: 'Pending leave requests', icon: Hourglass, load: listAllLeaves, params: { status: 'pending' }, to: '/admin/leaves?status=pending' },
];

const loadStats = async (signal) => {
  const totals = await Promise.all(
    STATS.map(({ load, params }) => load({ ...params, limit: 1 }, { signal }).then((r) => r.pagination.total))
  );
  return Object.fromEntries(STATS.map(({ key }, i) => [key, totals[i]]));
};

function StatTiles() {
  const { data, error, loading, reload } = useFetch(loadStats);

  if (error) {
    return (
      <div className="card">
        <ErrorState title="Couldn't load user statistics" error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="grid grid--stats grid--compact">
      {STATS.map(({ key, label, icon: Icon, to }) => (
        <Link key={key} to={to} className="card stat-card stat-card--link">
          <div className="stat-card__head">
            <span className="icon-chip">
              <Icon aria-hidden="true" />
            </span>
            <h3>{label}</h3>
          </div>
          <p className="stat-card__value">
            {loading && !data ? <Skeleton width={48} height={32} /> : <strong>{data[key]}</strong>}
          </p>
        </Link>
      ))}
    </div>
  );
}

function RecentUsers() {
  const { data, error, loading, reload } = useFetch((signal) => listUsers({ limit: 5 }, { signal }));
  const users = data?.data || [];

  return (
    <section className="card" aria-labelledby="recent-users-title">
      <header className="card__header">
        <div>
          <h2 id="recent-users-title" className="card__title">
            Recently added users
          </h2>
          <p className="card__subtitle">The 5 newest accounts</p>
        </div>
        <Link to="/admin/users" className="btn btn--ghost btn--sm">
          Manage users
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <div className="card__body card__body--flush">
        {error && <ErrorState title="Couldn't load users" error={error} onRetry={reload} />}

        {!error && !loading && users.length === 0 && (
          <EmptyState icon={UserPlus} title="No users yet">
            Users you create will appear here.
          </EmptyState>
        )}

        {!error && (loading || users.length > 0) && (
          <div className="table-wrap">
            <table className="data-table data-table--stack">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i}>
                        <td data-primary>
                          <Skeleton width="70%" />
                        </td>
                        <td data-label="Role"><Skeleton width={60} /></td>
                        <td data-label="Manager"><Skeleton width={90} /></td>
                        <td data-label="Status"><Skeleton width={60} /></td>
                      </tr>
                    ))
                  : users.map((u) => (
                      <tr key={u._id}>
                        <td data-primary>
                          <div className="cell-user">
                            <Avatar name={u.name} />
                            <div className="cell-user__text">
                              <p className="cell-user__name">{u.name}</p>
                              <p className="cell-user__email">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td data-label="Role">
                          <Badge tone={ROLE_BADGE_TONE[u.role]}>{u.role}</Badge>
                        </td>
                        <td data-label="Manager">{u.manager?.name || <span className="text-muted">—</span>}</td>
                        <td data-label="Status">
                          <Badge tone={u.isActive ? 'success' : 'neutral'} dot>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="page-header__subtitle">Here's what's happening across your organisation.</p>
        </div>
      </header>

      <StatTiles />

      <div className="section grid grid--split">
        <RecentUsers />
        <UpcomingHolidays />
      </div>
    </div>
  );
}
