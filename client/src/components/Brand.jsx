import { Link } from 'react-router-dom';
import { CalendarCheck2 } from 'lucide-react';

export default function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="Leave Management home">
      <span className="brand__mark">
        <CalendarCheck2 aria-hidden="true" />
      </span>
      <span>Leave Management</span>
    </Link>
  );
}
