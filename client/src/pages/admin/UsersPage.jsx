import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterX, Pencil, SearchX, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { listUsers, updateUser } from '../../api/users';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { ROLE_BADGE_TONE, ROLES } from '../../constants';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import SearchField from '../../components/ui/SearchField';
import SelectField from '../../components/ui/SelectField';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import UserFormDialog from './UserFormDialog';

const PAGE_SIZE = 10;
const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: ROLES.EMPLOYEE, label: 'Employees' },
  { value: ROLES.MANAGER, label: 'Managers' },
  { value: ROLES.ADMIN, label: 'Admins' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Deactivated' },
];

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const role = params.get('role') || '';
  const isActive = params.get('active') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(search || role || isActive);

  const [editing, setEditing] = useState(null); // null = closed, {} = create, user = edit
  const [toggling, setToggling] = useState(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const { data, error, loading, reload } = useFetch(
    (signal) => listUsers({ search, role, isActive, page, limit: PAGE_SIZE }, { signal }),
    [search, role, isActive, page]
  );
  const users = data?.data || [];

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const clearFilters = () => updateParams({ q: '', role: '', active: '', page: '' });

  useEffect(() => {
    if (data && users.length === 0 && page > 1) updateParams({ page: String(data.pagination.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const setActive = async (u, active) => {
    setTogglingBusy(true);
    try {
      await updateUser(u._id, { isActive: active });
      toast.success(active ? 'User reactivated' : 'User deactivated', active ? `${u.name} can sign in again.` : `${u.name} can no longer sign in.`);
      setToggling(null);
      reload();
    } catch (err) {
      toast.error(active ? "Couldn't reactivate user" : "Couldn't deactivate user", err.message);
      setToggling(null);
    } finally {
      setTogglingBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Users</h1>
          <p className="page-header__subtitle">Manage accounts, roles and who reports to whom.</p>
        </div>
        <Button onClick={() => setEditing({})}>
          <UserPlus aria-hidden="true" />
          Add user
        </Button>
      </header>

      <section className="card" aria-label="Users">
        <div className="toolbar">
          <SearchField
            label="Search"
            className="toolbar__search"
            placeholder="Name or email"
            value={search}
            onChange={(v) => updateParams({ q: v.trim(), page: '' })}
          />
          <SelectField label="Role" className="toolbar__field" value={role} options={ROLE_OPTIONS} onChange={(e) => updateParams({ role: e.target.value, page: '' })} />
          <SelectField label="Status" className="toolbar__field" value={isActive} options={STATUS_OPTIONS} onChange={(e) => updateParams({ active: e.target.value, page: '' })} />
          {hasFilters && (
            <Button variant="ghost" className="toolbar__clear" onClick={clearFilters}>
              <FilterX aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>

        {error && <ErrorState title="Couldn't load users" error={error} onRetry={reload} />}

        {!error && !loading && users.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No users match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Users} title="No users yet" />
          )
        )}

        {!error && (users.length > 0 || (loading && !data)) && (
          <div className="table-wrap" aria-busy={loading}>
            <table className="data-table data-table--stack">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Reports to</th>
                  <th scope="col" title="Casual · Sick · Paid">Balance (C · S · P)</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td data-primary><Skeleton width={180} /></td>
                        <td data-label="Role"><Skeleton width={70} /></td>
                        <td data-label="Reports to"><Skeleton width={100} /></td>
                        <td data-label="Balance"><Skeleton width={80} /></td>
                        <td data-label="Status"><Skeleton width={60} /></td>
                        <td />
                      </tr>
                    ))
                  : users.map((u) => {
                      const isMe = u._id === me._id;
                      return (
                        <tr key={u._id}>
                          <td data-primary>
                            <div className="cell-user">
                              <Avatar name={u.name} />
                              <div className="cell-user__text">
                                <p className="cell-user__name">
                                  {u.name}
                                  {isMe && <span className="cell-you"> (you)</span>}
                                </p>
                                <p className="cell-user__email">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td data-label="Role">
                            <Badge tone={ROLE_BADGE_TONE[u.role]}>{u.role}</Badge>
                          </td>
                          <td data-label="Reports to">{u.manager?.name || <span className="text-muted">—</span>}</td>
                          <td data-label="Balance (C · S · P)" className="cell-numeric">
                            {u.leaveBalance.casual} · {u.leaveBalance.sick} · {u.leaveBalance.paid}
                          </td>
                          <td data-label="Status">
                            <Badge tone={u.isActive ? 'success' : 'neutral'} dot>
                              {u.isActive ? 'Active' : 'Deactivated'}
                            </Badge>
                          </td>
                          <td className="cell-actions">
                            <div className="action-group action-group--compact">
                              <Button variant="ghost" size="sm" className="btn--row" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`} title="Edit user">
                                <Pencil aria-hidden="true" />
                                <span className="btn--row__label">Edit</span>
                              </Button>
                              {u.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="btn--row btn--reject"
                                  onClick={() => setToggling(u)}
                                  disabled={isMe}
                                  title={isMe ? "You can't deactivate your own account" : 'Deactivate user'}
                                  aria-label={`Deactivate ${u.name}`}
                                >
                                  <UserX aria-hidden="true" />
                                  <span className="btn--row__label">Deactivate</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="btn--row"
                                  onClick={() => setActive(u, true)}
                                  title="Reactivate user"
                                  aria-label={`Reactivate ${u.name}`}
                                >
                                  <UserCheck aria-hidden="true" />
                                  <span className="btn--row__label">Reactivate</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}

        {!error && users.length > 0 && (
          <div className="card__footer">
            <Pagination pagination={data.pagination} disabled={loading} onPageChange={(p) => updateParams({ page: p > 1 ? String(p) : '' })} />
          </div>
        )}
      </section>

      <UserFormDialog
        open={editing !== null}
        user={editing?._id ? editing : null}
        currentUserId={me._id}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(toggling)}
        title={`Deactivate ${toggling?.name}?`}
        confirmLabel="Deactivate"
        cancelLabel="Keep active"
        loading={togglingBusy}
        onConfirm={() => setActive(toggling, false)}
        onClose={() => setToggling(null)}
      >
        <p>They will be signed out and can no longer sign in. Their leave history is kept, and you can reactivate them later.</p>
      </ConfirmDialog>
    </div>
  );
}
