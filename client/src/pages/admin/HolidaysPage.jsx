import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarOff, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { deleteHoliday, listHolidays } from '../../api/holidays';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SegmentedControl from '../../components/ui/SegmentedControl';
import Skeleton from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { dateKey, dayOfMonth, formatDate, formatMonth, formatWeekday, todayKey } from '../../utils/format';
import HolidayFormDialog from './HolidayFormDialog';

const isWeekend = (value) => [0, 6].includes(new Date(value).getUTCDay());

export default function HolidaysPage() {
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || thisYear;
  const yearOptions = [thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }));

  const [editing, setEditing] = useState(null); // null closed, {} new, holiday = edit
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const { data, error, loading, reload } = useFetch((signal) => listHolidays({ year, limit: 100 }, { signal }), [year]);
  const holidays = data?.data || [];
  const today = todayKey();

  const remove = async () => {
    setDeletingBusy(true);
    try {
      await deleteHoliday(deleting._id);
      toast.success('Holiday deleted', `${deleting.name} · ${formatDate(deleting.date)}`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Couldn't delete holiday", err.message);
      setDeleting(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Holidays</h1>
          <p className="page-header__subtitle">Company holidays are skipped when counting leave days.</p>
        </div>
        <Button onClick={() => setEditing({})}>
          <CalendarPlus aria-hidden="true" />
          Add holiday
        </Button>
      </header>

      <div className="tabs-row">
        <SegmentedControl
          label="Year"
          options={yearOptions}
          value={String(year)}
          onChange={(v) => setParams(v === String(thisYear) ? {} : { year: v }, { replace: true })}
        />
      </div>

      <section className="card" aria-label={`Holidays in ${year}`}>
        <header className="card__header">
          <div>
            <h2 className="card__title">{year}</h2>
            <p className="card__subtitle">
              {loading && !data ? 'Loading…' : `${holidays.length} ${holidays.length === 1 ? 'holiday' : 'holidays'}`}
            </p>
          </div>
        </header>

        {error && <ErrorState title="Couldn't load holidays" error={error} onRetry={reload} />}

        {!error && !loading && holidays.length === 0 && (
          <EmptyState
            icon={CalendarOff}
            title={`No holidays in ${year}`}
            action={
              <Button size="sm" onClick={() => setEditing({})}>
                Add holiday
              </Button>
            }
          >
            Add public or company holidays so they aren't counted as leave.
          </EmptyState>
        )}

        {!error && (holidays.length > 0 || (loading && !data)) && (
          <ul className="holiday-list" aria-busy={loading}>
            {loading && !data
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="holiday-item">
                    <Skeleton width={44} height={44} />
                    <div className="holiday-item__text">
                      <Skeleton width="50%" />
                      <Skeleton width="30%" height={12} />
                    </div>
                  </li>
                ))
              : holidays.map((h) => {
                  const past = dateKey(h.date) < today;
                  return (
                    <li key={h._id} className={`holiday-item${past ? ' is-past' : ''}`}>
                      <span className="date-chip" aria-hidden="true">
                        <span className="date-chip__month">{formatMonth(h.date)}</span>
                        <span className="date-chip__day">{dayOfMonth(h.date)}</span>
                      </span>
                      <div className="holiday-item__text">
                        <p className="holiday-item__name" title={h.name}>
                          {h.name}
                        </p>
                        <p className="holiday-item__date">
                          {formatWeekday(h.date)}, {formatDate(h.date)}
                        </p>
                      </div>
                      <div className="holiday-item__tags">
                        {past && <Badge>Past</Badge>}
                        {isWeekend(h.date) && <Badge tone="warning">Weekend</Badge>}
                      </div>
                      <div className="action-group action-group--compact">
                        <Button variant="ghost" size="sm" icon onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`} title="Edit">
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="sm" icon className="btn--reject" onClick={() => setDeleting(h)} aria-label={`Delete ${h.name}`} title="Delete">
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
          </ul>
        )}
      </section>

      <HolidayFormDialog
        open={editing !== null}
        holiday={editing?._id ? editing : null}
        defaultYear={year}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          const savedYear = new Date(saved.date).getUTCFullYear();
          if (savedYear !== year) setParams(savedYear === thisYear ? {} : { year: String(savedYear) }, { replace: true });
          else reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        confirmLabel="Delete holiday"
        cancelLabel="Keep it"
        loading={deletingBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        <p>
          {deleting && formatDate(deleting.date)} will count as a working day for new leave requests. Leaves already applied for are not
          changed.
        </p>
      </ConfirmDialog>
    </div>
  );
}
