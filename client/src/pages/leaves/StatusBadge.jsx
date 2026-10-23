import Badge from '../../components/ui/Badge';
import { LEAVE_STATUSES } from '../../constants';

export default function StatusBadge({ status }) {
  const s = LEAVE_STATUSES.find((x) => x.key === status);
  return (
    <Badge tone={s?.tone ?? 'neutral'} dot>
      {s?.label ?? status}
    </Badge>
  );
}
