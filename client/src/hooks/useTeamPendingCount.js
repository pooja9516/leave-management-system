import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { listTeamLeaves, TEAM_LEAVES_CHANGED } from '../api/leaves';

/** Number of team leave requests awaiting the manager; refreshes on navigation and after reviews. */
export function useTeamPendingCount(enabled) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return undefined;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(TEAM_LEAVES_CHANGED, bump);
    return () => window.removeEventListener(TEAM_LEAVES_CHANGED, bump);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    listTeamLeaves({ status: 'pending', limit: 1 }, { signal: controller.signal })
      .then((res) => setCount(res.pagination.total))
      .catch(() => {});
    return () => controller.abort();
  }, [enabled, pathname, tick]);

  return count;
}
