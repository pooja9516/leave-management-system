import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import Modal, { useModalIds } from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Avatar from '../../components/ui/Avatar';
import TextAreaField from '../../components/ui/TextAreaField';
import { useToast } from '../../components/ui/Toast';
import { approveLeave, rejectLeave, TEAM_LEAVES_CHANGED } from '../../api/leaves';
import { leaveTypeLabel } from '../../constants';
import { formatDateRange, formatDays } from '../../utils/format';

const COMMENT_MIN = 3;
const COMMENT_MAX = 500;

/** Approve or reject (`decision`) a pending leave with a manager comment. */
export default function ReviewDialog({ leave, decision, onClose, onDone }) {
  const toast = useToast();
  const commentRef = useRef(null);
  const { titleId, descId } = useModalIds();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setComment('');
    setError('');
    setServerError('');
  }, [leave, decision]);

  if (!leave) return null;

  const approving = decision === 'approve';
  const type = leaveTypeLabel(leave.leaveType);
  const balance = leave.employee?.leaveBalance?.[leave.leaveType];
  const after = balance === undefined ? undefined : balance - leave.days;
  const firstName = leave.employee?.name?.split(' ')[0] ?? 'The employee';

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const text = comment.trim();
    if (!approving && text.length < COMMENT_MIN) {
      setError(`Tell ${firstName} why (at least ${COMMENT_MIN} characters)`);
      commentRef.current?.focus();
      return;
    }
    if (text.length > COMMENT_MAX) {
      setError(`Keep the comment under ${COMMENT_MAX} characters`);
      return;
    }

    setLoading(true);
    setServerError('');
    try {
      await (approving ? approveLeave : rejectLeave)(leave._id, text);
      toast.success(
        approving ? 'Leave approved' : 'Leave rejected',
        `${leave.employee.name} · ${formatDays(leave.days)} of ${type.toLowerCase()}`
      );
      window.dispatchEvent(new Event(TEAM_LEAVES_CHANGED));
      onDone();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={loading} initialFocusRef={commentRef} labelledBy={titleId} describedBy={descId} size="md">
      <form onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {approving ? 'Approve leave request' : 'Reject leave request'}
          </h2>
        </div>

        <div className="dialog__stack">
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <div id={descId} className="review-summary">
            <div className="cell-user">
              <Avatar name={leave.employee?.name} />
              <div className="cell-user__text">
                <p className="cell-user__name">{leave.employee?.name}</p>
                <p className="cell-user__email">{leave.employee?.email}</p>
              </div>
            </div>
            <dl className="review-summary__grid">
              <div>
                <dt>Leave</dt>
                <dd>
                  {type} · {formatDays(leave.days)}
                  {leave.halfDay && ' (half day)'}
                </dd>
              </div>
              <div>
                <dt>Dates</dt>
                <dd>{formatDateRange(leave.startDate, leave.endDate)}</dd>
              </div>
              <div className="review-summary__wide">
                <dt>Reason</dt>
                <dd className="review-summary__reason">{leave.reason}</dd>
              </div>
              {approving && balance !== undefined && (
                <div className="review-summary__wide">
                  <dt>{type} balance</dt>
                  <dd>
                    {formatDays(balance)} → <strong className={after < 0 ? 'text-danger' : ''}>{formatDays(after)}</strong>{' '}
                    after approval
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {approving && after < 0 && (
            <Alert variant="warning">
              {firstName} doesn't have enough {type.toLowerCase()} left. Approval will be refused.
            </Alert>
          )}

          <TextAreaField
            ref={commentRef}
            label={approving ? 'Comment (optional)' : 'Reason for rejection'}
            rows={3}
            maxLength={COMMENT_MAX}
            placeholder={approving ? 'e.g. Enjoy your time off' : 'e.g. We have a release that week. Could you pick other dates?'}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setError('');
            }}
            error={error}
            hint={approving ? `${firstName} will see this comment.` : `${firstName} will see this reason.`}
            disabled={loading}
          />
        </div>

        <div className="dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant={approving ? 'primary' : 'danger'} loading={loading}>
            {!loading && (approving ? <Check aria-hidden="true" /> : <X aria-hidden="true" />)}
            {approving ? 'Approve leave' : 'Reject leave'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
