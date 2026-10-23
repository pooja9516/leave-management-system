import { useState } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { cancelLeave } from '../../api/leaves';
import { leaveTypeLabel } from '../../constants';
import { formatDateRange, formatDays } from '../../utils/format';

/** Confirms and performs cancellation of `leave`; calls onCancelled after success. */
export default function CancelLeaveDialog({ leave, onClose, onCancelled }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  if (!leave) return null;

  const type = leaveTypeLabel(leave.leaveType).toLowerCase();
  const approved = leave.status === 'approved';

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await cancelLeave(leave._id);
      toast.success(
        'Leave cancelled',
        approved ? `${formatDays(leave.days)} returned to your ${type} balance.` : 'Your request has been withdrawn.'
      );
      onCancelled();
    } catch (err) {
      toast.error("Couldn't cancel leave", err.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={approved ? 'Cancel approved leave?' : 'Withdraw leave request?'}
      confirmLabel={approved ? 'Cancel leave' : 'Withdraw request'}
      cancelLabel="Keep it"
      loading={loading}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <p>
        <strong>{formatDays(leave.days)}</strong> of {type} · {formatDateRange(leave.startDate, leave.endDate)}
      </p>
      <p>
        {approved
          ? `This leave is already approved. Cancelling returns ${formatDays(leave.days)} to your ${type} balance.`
          : 'Your manager will no longer see this request.'}{' '}
        This can't be undone.
      </p>
    </ConfirmDialog>
  );
}
