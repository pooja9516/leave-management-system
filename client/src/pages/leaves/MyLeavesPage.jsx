import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarPlus, FilterX, Inbox, MessageSquare, SearchX, XCircle } from 'lucide-react';
import { listMyLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { LEAVE_STATUSES, LEAVE_TYPES, leaveTypeLabel } from '../../constants';
import { formatDate, formatDateRange, formatDays } from '../../utils/format';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import SelectField from '../../components/ui/SelectField';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import StatusBadge from './StatusBadge';
import CancelLeaveDialog from './CancelLeaveDialog';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...LEAVE_STATUSES.map((s) => ({ value: s.key, label: s.label }))];
const TYPE_OPTIONS = [{ value: '', label: 'All types' }, ...LEAVE_TYPES.map((t) => ({ value: t.key, label: t.label }))];

export default function MyLeavesPage() {
  // Filters live in the URL so they survive refresh and the back button.
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const leaveType = params.get('type') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(status || leaveType);

  const [toCancel, setToCancel] = useState(null);
  const { data, error, loading, reload } = useFetch(
    (signal) => listMyLeaves({ status, leaveType, page, limit: PAGE_SIZE }, { signal }),
    [status, leaveType, page]
  );
  const leaves = data?.data || [];

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // If the current page became empty (e.g. after cancelling with a filter), step back.
  useEffect(() => {
    if (data && leaves.length === 0 && page > 1) updateParams({ page: String(data.pagination.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">My leaves</h1>
          <p className="page-header__subtitle">Track your leave requests and their approval status.</p>
        </div>
        <Link to="/leaves/apply" className="btn btn--primary">
          <CalendarPlus aria-hidden="true" />
          Apply for leave
        </Link>
      </header>

      <section className="card" aria-label="Leave requests">
        <div className="toolbar">
          <SelectField
            label="Status"
            className="toolbar__field"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(e) => updateParams({ status: e.target.value, page: '' })}
          />
          <SelectField
            label="Leave type"
            className="toolbar__field"
            value={leaveType}
            options={TYPE_OPTIONS}
            onChange={(e) => updateParams({ type: e.target.value, page: '' })}
          />
          {hasFilters && (
            <Button variant="ghost" className="toolbar__clear" onClick={() => updateParams({ status: '', type: '', page: '' })}>
              <FilterX aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>

        {error && <ErrorState title="Couldn't load your leaves" error={error} onRetry={reload} />}

        {!error && !loading && leaves.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No leaves match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={() => updateParams({ status: '', type: '', page: '' })}>
                  Clear filters
                </Button>
              }
            >
              Try a different status or leave type.
            </EmptyState>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No leave requests yet"
              action={
                <Link to="/leaves/apply" className="btn btn--primary btn--sm">
                  Apply for leave
                </Link>
              }
            >
              When you apply for leave, your requests and their status will appear here.
            </EmptyState>
          )
        )}

        {!error && (leaves.length > 0 || (loading && !data)) && (
          <div className="table-wrap" aria-busy={loading}>
            <table className="data-table data-table--stack">
              <thead>
                <tr>
                  <th scope="col">Leave</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Applied</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i}>
                        <td data-primary><Skeleton width={120} /></td>
                        <td data-label="Dates"><Skeleton width={110} /></td>
                        <td data-label="Status"><Skeleton width={70} /></td>
                        <td data-label="Reason"><Skeleton width={160} /></td>
                        <td data-label="Applied"><Skeleton width={80} /></td>
                        <td />
                      </tr>
                    ))
                  : leaves.map((leave) => (
                      <tr key={leave._id}>
                        <td data-primary>
                          <p className="cell-title">{leaveTypeLabel(leave.leaveType)}</p>
                          <p className="cell-sub">
                            {formatDays(leave.days)}
                            {leave.halfDay && ' · Half day'}
                          </p>
                        </td>
                        <td data-label="Dates">{formatDateRange(leave.startDate, leave.endDate)}</td>
                        <td data-label="Status">
                          <StatusBadge status={leave.status} />
                        </td>
                        <td data-label="Reason" className="cell-reason">
                          <p className="cell-clamp" title={leave.reason}>
                            {leave.reason}
                          </p>
                          {leave.managerComment && (
                            <p className="cell-comment" title={leave.managerComment}>
                              <MessageSquare aria-hidden="true" />
                              <span>
                                <span className="sr-only">Manager comment: </span>
                                {leave.reviewedBy?.name ? `${leave.reviewedBy.name}: ` : ''}
                                {leave.managerComment}
                              </span>
                            </p>
                          )}
                        </td>
                        <td data-label="Applied">{formatDate(leave.createdAt)}</td>
                        <td className="cell-actions">
                          {leave.canCancel && (
                            <Button variant="secondary" size="sm" onClick={() => setToCancel(leave)}>
                              <XCircle aria-hidden="true" />
                              {leave.status === 'approved' ? 'Cancel' : 'Withdraw'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && leaves.length > 0 && (
          <div className="card__footer">
            <Pagination
              pagination={data.pagination}
              disabled={loading}
              onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })}
            />
          </div>
        )}
      </section>

      <CancelLeaveDialog
        leave={toCancel}
        onClose={() => setToCancel(null)}
        onCancelled={() => {
          setToCancel(null);
          reload();
        }}
      />
    </div>
  );
}
