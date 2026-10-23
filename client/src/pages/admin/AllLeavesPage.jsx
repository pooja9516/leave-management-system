import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, FilterX, Inbox, SearchX, X } from 'lucide-react';
import { listAllLeaves } from '../../api/leaves';
import { useFetch } from '../../hooks/useFetch';
import { LEAVE_STATUSES, LEAVE_TYPES } from '../../constants';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import SearchField from '../../components/ui/SearchField';
import SegmentedControl from '../../components/ui/SegmentedControl';
import SelectField from '../../components/ui/SelectField';
import { EmptyState, ErrorState } from '../../components/ui/States';
import LeaveRequestsTable from '../team/LeaveRequestsTable';
import ReviewDialog from '../team/ReviewDialog';

const PAGE_SIZE = 10;
const STATUS_TABS = [{ value: 'all', label: 'All' }, ...LEAVE_STATUSES.map((s) => ({ value: s.key, label: s.label }))];
const TYPE_OPTIONS = [{ value: '', label: 'All types' }, ...LEAVE_TYPES.map((t) => ({ value: t.key, label: t.label }))];

// Admin: every leave request; admins can also approve/reject any pending request.
export default function AllLeavesPage() {
  const [review, setReview] = useState(null); // { leave, decision }
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const leaveType = params.get('type') || '';
  const search = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(leaveType || search || status !== 'all');

  const { data, error, loading, reload } = useFetch(
    (signal) =>
      listAllLeaves({ status: status === 'all' ? '' : status, leaveType, search, page, limit: PAGE_SIZE }, { signal }),
    [status, leaveType, search, page]
  );
  const leaves = data?.data || [];

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const clearFilters = () => updateParams({ status: '', q: '', type: '', page: '' });

  useEffect(() => {
    if (data && leaves.length === 0 && page > 1) updateParams({ page: String(data.pagination.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">All leaves</h1>
          <p className="page-header__subtitle">
            Every leave request across the organisation. Managers review their own team; you can review any pending request.
          </p>
        </div>
      </header>

      <div className="tabs-row">
        <SegmentedControl
          label="Filter by status"
          options={STATUS_TABS}
          value={status}
          onChange={(v) => updateParams({ status: v === 'all' ? '' : v, page: '' })}
        />
      </div>

      <section className="card" aria-label="All leave requests">
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
            <Button variant="ghost" className="toolbar__clear" onClick={clearFilters}>
              <FilterX aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>

        {error && <ErrorState title="Couldn't load leave requests" error={error} onRetry={reload} />}

        {!error && !loading && leaves.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No requests match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            >
              Try a different status, name or leave type.
            </EmptyState>
          ) : (
            <EmptyState icon={Inbox} title="No leave requests yet">
              Requests appear here as soon as employees apply.
            </EmptyState>
          )
        )}

        {!error && (leaves.length > 0 || (loading && !data)) && (
          <LeaveRequestsTable
            leaves={leaves}
            loading={loading}
            renderActions={(leave) =>
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
                  <Button size="sm" onClick={() => setReview({ leave, decision: 'approve' })} aria-label={`Approve leave for ${leave.employee?.name}`}>
                    <Check aria-hidden="true" />
                    Approve
                  </Button>
                </div>
              )
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
