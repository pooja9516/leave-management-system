import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useFetch } from '../../hooks/useFetch';
import { useLeavePreview } from '../../hooks/useLeavePreview';
import { applyLeave, getMyBalance } from '../../api/leaves';
import { LEAVE_TYPES } from '../../constants';
import { todayKey, formatDays, formatDate } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Checkbox from '../../components/ui/Checkbox';
import TextField, { FieldError } from '../../components/ui/TextField';
import TextAreaField from '../../components/ui/TextAreaField';
import Skeleton from '../../components/ui/Skeleton';
import LeaveSummary from './LeaveSummary';

const REASON_MIN = 3;
const REASON_MAX = 500;

const INITIAL = { leaveType: 'casual', startDate: '', endDate: '', halfDay: false, reason: '' };

const validate = (v, today) => {
  const errors = {};
  if (!v.leaveType) errors.leaveType = 'Choose a leave type';
  if (!v.startDate) errors.startDate = 'Choose a start date';
  else if (v.startDate < today) errors.startDate = "Start date can't be in the past";
  if (!v.endDate) errors.endDate = 'Choose an end date';
  else if (v.startDate && v.endDate < v.startDate) errors.endDate = 'End date must be on or after the start date';
  const reason = v.reason.trim();
  if (reason.length < REASON_MIN) errors.reason = `Briefly tell your manager why (at least ${REASON_MIN} characters)`;
  else if (reason.length > REASON_MAX) errors.reason = `Keep the reason under ${REASON_MAX} characters`;
  return errors;
};

const FIELD_ORDER = ['leaveType', 'startDate', 'endDate', 'reason'];

export default function ApplyLeavePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayKey();

  const balanceQuery = useFetch((signal) => getMyBalance({ signal }));
  const balances = Object.fromEntries((balanceQuery.data?.balance || []).map((b) => [b.type, b]));

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const refs = { leaveType: useRef(null), startDate: useRef(null), endDate: useRef(null), reason: useRef(null) };
  const serverErrorRef = useRef(null);

  const preview = useLeavePreview(values.startDate, values.endDate, values.halfDay);
  const selectedType = LEAVE_TYPES.find((t) => t.key === values.leaveType);
  const available = balances[values.leaveType]?.available;
  const singleDay = values.startDate && values.startDate === values.endDate;

  const days = preview.status === 'ready' ? preview.data.days : null;
  const overlap = preview.status === 'ready' ? preview.data.overlap : null;
  const blocked = Boolean(overlap) || days === 0 || (days !== null && available !== undefined && days > available);

  const setField = (field, value) => {
    const next = { ...values, [field]: value };
    // Keep the range valid: moving the start past the end pulls the end along.
    if (field === 'startDate' && value && (!values.endDate || values.endDate < value)) next.endDate = value;
    // Half day only makes sense for a single date.
    if (next.startDate !== next.endDate) next.halfDay = false;
    setValues(next);
    // Re-validate live only after the first submit attempt.
    if (submitted) setErrors(validate(next, today));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitted(true);

    const found = validate(values, today);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((f) => found[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }
    if (blocked) return;

    setSubmitting(true);
    setServerError('');
    try {
      const { leave } = await applyLeave({ ...values, reason: values.reason.trim() });
      toast.success(
        'Leave request submitted',
        `${formatDays(leave.days)} of ${selectedType.label.toLowerCase()} from ${formatDate(leave.startDate)} is awaiting approval.`
      );
      navigate('/leaves', { replace: true });
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
      requestAnimationFrame(() => serverErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  };

  return (
    <div className="page page--narrow">
      <Link to="/" className="back-link">
        <ArrowLeft aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="page-header">
        <div>
          <h1 className="page-header__title">Apply for leave</h1>
          <p className="page-header__subtitle">
            {user.manager ? (
              <>
                Your request goes to <strong>{user.manager.name}</strong> for approval.
              </>
            ) : (
              'Your request goes to an admin for approval.'
            )}
          </p>
        </div>
      </header>


      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <fieldset className="form-card__fieldset" disabled={submitting}>
          {serverError && (
            <div ref={serverErrorRef}>
              <Alert variant="error">{serverError}</Alert>
            </div>
          )}

          {/* Leave type */}
          <fieldset className="form-section" aria-describedby={errors.leaveType ? 'leaveType-error' : undefined}>
            <legend className="form-section__title">Leave type</legend>
            <div className="radio-cards">
              {LEAVE_TYPES.map(({ key, label, icon: Icon }, i) => {
                const b = balances[key];
                return (
                  <label key={key} className={`radio-card${values.leaveType === key ? ' is-checked' : ''}`}>
                    <input
                      ref={i === 0 ? refs.leaveType : undefined}
                      type="radio"
                      name="leaveType"
                      value={key}
                      checked={values.leaveType === key}
                      onChange={() => setField('leaveType', key)}
                      className="radio-card__input"
                    />
                    <span className="icon-chip">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="radio-card__text">
                      <span className="radio-card__title">{label}</span>
                      <span className="radio-card__meta">
                        {balanceQuery.loading && !b ? (
                          <Skeleton width={80} height={12} />
                        ) : b ? (
                          <>
                            {formatDays(b.available)} available
                            {b.pending > 0 && ` · ${b.pending} pending`}
                          </>
                        ) : (
                          'Balance unavailable'
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldError id="leaveType-error">{errors.leaveType}</FieldError>
            {balanceQuery.error && (
              <p className="field__hint">
                Couldn't load your balance.{' '}
                <button type="button" className="link-button" onClick={balanceQuery.reload}>
                  Try again
                </button>
              </p>
            )}
          </fieldset>

          {/* Dates */}
          <fieldset className="form-section">
            <legend className="form-section__title">Dates</legend>
            <div className="form-row">
              <TextField
                ref={refs.startDate}
                label="Start date"
                type="date"
                min={today}
                value={values.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
                error={errors.startDate}
              />
              <TextField
                ref={refs.endDate}
                label="End date"
                type="date"
                min={values.startDate || today}
                value={values.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
                error={errors.endDate}
              />
            </div>
            <Checkbox
              label="Half day"
              hint={singleDay ? 'Uses 0.5 day of your balance.' : 'Available when start and end date are the same.'}
              checked={values.halfDay}
              disabled={!singleDay}
              onChange={(e) => setField('halfDay', e.target.checked)}
            />
          </fieldset>

          {/* Reason */}
          <div className="form-section">
            <TextAreaField
              ref={refs.reason}
              label="Reason"
              rows={4}
              maxLength={REASON_MAX}
              placeholder="e.g. Attending a family function"
              value={values.reason}
              onChange={(e) => setField('reason', e.target.value)}
              error={errors.reason}
            />
          </div>

          <LeaveSummary preview={preview} typeLabel={selectedType.label} available={available} />
        </fieldset>

        <div className="form-card__actions">
          <Link to="/" className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={submitting} disabled={blocked}>
            {!submitting && <Send aria-hidden="true" />}
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
