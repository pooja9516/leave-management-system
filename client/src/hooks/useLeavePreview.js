import { useEffect, useState } from 'react';
import { calculateLeaveDays } from '../api/leaves';

const DEBOUNCE_MS = 250;

/** Live working-day count for a date range, from the server (excludes weekends + holidays). */
export function useLeavePreview(startDate, endDate, halfDay) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    const timer = setTimeout(() => {
      calculateLeaveDays({ startDate, endDate, halfDay }, { signal: controller.signal })
        .then((data) => setState({ status: 'ready', data, error: null }))
        .catch((error) => {
          if (error.name !== 'AbortError') setState({ status: 'error', data: null, error });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [startDate, endDate, halfDay]);

  return state;
}
