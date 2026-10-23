import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, FilterX, Inbox, SearchX, X } from 'lucide-react';
import { listTeamLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { LEAVE_STATUSES, LEAVE_TYPES } from '../../constants';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import SearchField from '../../components/ui/SearchField';
import SegmentedControl from '../../components/ui/SegmentedControl';
import SelectField from '../../components/ui/SelectField';
import { EmptyState, ErrorState } from '../../components/ui/States';
import ReviewDialog from './ReviewDialog';
import LeaveRequestsTable from './LeaveRequestsTable';

const PAGE_SIZE = 10;
const STATUS_TABS = [...LEAVE_STATUSES.map((s) => ({ value: s.key, label: s.label })), { value: 'all', label: 'All' }];
const TYPE_OPTIONS = [{ value: '', label: 'All types' }, ...LEAVE_TYPES.map((t) => ({ value: t.key, label: t.label }))];

export default function TeamRequestsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'pending';
  const leaveType = params.get('type') || '';
  const search = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(leaveType || search);
  const isPending = status === 'pending';

  const [review, setReview] = useState(null); // { leave, decision }
  const { data, error, loading, reload } = useFetch(
    (signal) =>
      listTeamLeaves(
        { status: status === 'all' ? '' : status, leaveType, search, page, limit: PAGE_SIZE },
        { signal }
      ),
    [status, leaveType, search, page]
  );
  const leaves = data?.data || [];

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (data && leaves.length === 0 && page > 1) updateParams({ page: String(data.pagination.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const emptyTitle = isPending ? 'All caught up' : 'No requests here';
  const emptyText = isPending
    ? 'There are no leave requests waiting for your approval.'
    : 'Leave requests from your team with this status will appear here.';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Team requests</h1>
          <p className="page-header__subtitle">Review and respond to leave requests from your team.</p>
        </div>
      </header>

      <div className="tabs-row">
        <SegmentedControl
          label="Filter by status"
          options={STATUS_TABS}
          value={status}
          onChange={(v) => updateParams({ status: v === 'pending' ? '' : v, page: '' })}
        />
      </div>

      <section className="card" aria-label="Team leave requests">
        <div className="toolbar">
          <SearchField
            label="Employee"
            className="toolbar__search"
            placeholder="Search by name or email"
            value={search}
            onChange={(v) => updateParams({ q: v.trim(), page: '' })}
          />
          <SelectField
            label="Leave type"
            className="toolbar__field"
            value={leaveType}
            options={TYPE_OPTIONS}
            onChange={(e) => updateParams({ type: e.target.value, page: '' })}
          />
          {hasFilters && (
            <Button variant="ghost" className="toolbar__clear" onClick={() => updateParams({ q: '', type: '', page: '' })}>
              <FilterX aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>

        {error && <ErrorState title="Couldn't load team requests" error={error} onRetry={reload} />}

        {!error && !loading && leaves.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No requests match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={() => updateParams({ q: '', type: '', page: '' })}>
                  Clear filters
                </Button>
              }
            >
              Try a different name or leave type.
            </EmptyState>
          ) : (
            <EmptyState icon={Inbox} title={emptyTitle}>
              {emptyText}
            </EmptyState>
          )
        )}

        {!error && (leaves.length > 0 || (loading && !data)) && (
          <LeaveRequestsTable
            leaves={leaves}
            loading={loading}
            showStatus={!isPending}
            commentLabel="Your comment"
            renderActions={
              isPending
                ? (leave) =>
                    leave.status === 'pending' && (
                      <div className="action-group">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="btn--reject"
                          onClick={() => setReview({ leave, decision: 'reject' })}
                          aria-label={`Reject leave for ${leave.employee?.name}`}
                        >
                          <X aria-hidden="true" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setReview({ leave, decision: 'approve' })}
                          aria-label={`Approve leave for ${leave.employee?.name}`}
                        >
                          <Check aria-hidden="true" />
                          Approve
                        </Button>
                      </div>
                    )
                : undefined
            }
          />
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

      <ReviewDialog
        leave={review?.leave}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          reload();
        }}
      />
    </div>
  );
}
