import { MessageSquare } from 'lucide-react';
import { leaveTypeLabel } from '../../constants';
import { formatDate, formatDateRange, formatDays } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';
import Skeleton from '../../components/ui/Skeleton';
import StatusBadge from '../leaves/StatusBadge';

/**
 * Leave requests with the employee shown (used by managers and admins).
 * `renderActions(leave)` adds an actions column when provided.
 */
export default function LeaveRequestsTable({ leaves, loading, showStatus = true, renderActions, commentLabel = 'Manager comment' }) {
  const skeleton = loading && leaves.length === 0;

  return (
    <div className="table-wrap" aria-busy={loading}>
      <table className="data-table data-table--stack">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            <th scope="col">Leave</th>
            <th scope="col">Dates</th>
            <th scope="col">Reason</th>
            {showStatus && <th scope="col">Status</th>}
            {renderActions && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {skeleton
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  <td data-primary><Skeleton width={160} /></td>
                  <td data-label="Leave"><Skeleton width={90} /></td>
                  <td data-label="Dates"><Skeleton width={110} /></td>
                  <td data-label="Reason"><Skeleton width={160} /></td>
                  {showStatus && <td data-label="Status"><Skeleton width={70} /></td>}
                  {renderActions && <td />}
                </tr>
              ))
            : leaves.map((leave) => (
                <tr key={leave._id}>
                  <td data-primary>
                    <div className="cell-user">
                      <Avatar name={leave.employee?.name} />
                      <div className="cell-user__text">
                        <p className="cell-user__name">{leave.employee?.name ?? 'Unknown user'}</p>
                        <p className="cell-user__email">{leave.employee?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Leave">
                    <div className="cell-stack">
                      <p className="cell-title">{leaveTypeLabel(leave.leaveType)}</p>
                      <p className="cell-sub">
                        {formatDays(leave.days)}
                        {leave.halfDay && ' · Half day'}
                      </p>
                    </div>
                  </td>
                  <td data-label="Dates">
                    <div className="cell-stack">
                      <p>{formatDateRange(leave.startDate, leave.endDate)}</p>
                      <p className="cell-sub">Applied {formatDate(leave.createdAt)}</p>
                    </div>
                  </td>
                  <td data-label="Reason" className="cell-reason">
                    <p className="cell-clamp" title={leave.reason}>
                      {leave.reason}
                    </p>
                    {leave.managerComment && (
                      <p className="cell-comment" title={leave.managerComment}>
                        <MessageSquare aria-hidden="true" />
                        <span>
                          <span className="sr-only">{commentLabel}: </span>
                          {leave.reviewedBy?.name ? `${leave.reviewedBy.name}: ` : ''}
                          {leave.managerComment}
                        </span>
                      </p>
                    )}
                  </td>
                  {showStatus && (
                    <td data-label="Status">
                      <StatusBadge status={leave.status} />
                    </td>
                  )}
                  {renderActions && <td className="cell-actions">{renderActions(leave)}</td>}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
