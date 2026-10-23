import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { getMyBalance } from '../../api/leaves';
import { greeting } from '../../utils/format';
import BalanceCards from './BalanceCards';
import UpcomingHolidays from './UpcomingHolidays';
import RecentLeaves from './RecentLeaves';
import TeamPendingCard from './TeamPendingCard';
import { ROLES } from '../../constants';

// Used by employees and managers (managers have their own leave balance too).
export default function EmployeeDashboard() {
  const { user, refreshUser } = useAuth();
  const balance = useFetch((signal) => getMyBalance({ signal }));

  // Manager assignment can change, so refresh the user when the dashboard opens.
  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const firstName = user.name.split(' ')[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">
            {greeting()}, {firstName}
          </h1>
          <p className="page-header__subtitle">Here's an overview of your leave for this year.</p>
          <p className="meta-line">
            <UserRound size={16} aria-hidden="true" />
            {user.manager ? (
              <span>
                Reports to <strong>{user.manager.name}</strong>
              </span>
            ) : (
              <span>No manager assigned. Your leave requests are reviewed by an admin.</span>
            )}
          </p>
        </div>
        <Link to="/leaves/apply" className="btn btn--primary">
          <CalendarPlus aria-hidden="true" />
          Apply for leave
        </Link>
      </header>

      {user.role === ROLES.MANAGER && (
        <div className="section-gap-lg">
          <TeamPendingCard />
        </div>
      )}

      <section aria-labelledby="balance-title">
        <h2 id="balance-title" className="section__title">
          Leave balance
        </h2>
        <BalanceCards
          items={balance.data?.balance}
          loading={balance.loading}
          error={balance.error}
          onRetry={balance.reload}
        />
      </section>

      <div className="section grid grid--split">
        <RecentLeaves />
        <UpcomingHolidays />
      </div>
    </div>
  );
}
