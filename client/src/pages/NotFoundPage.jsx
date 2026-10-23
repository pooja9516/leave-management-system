import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/States';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="card">
        <EmptyState
          icon={Compass}
          title="Page not found"
          action={
            <Link to="/" className="btn btn--primary btn--sm">
              Go to dashboard
            </Link>
          }
        >
          The page you are looking for doesn't exist or may have been moved.
        </EmptyState>
      </div>
    </div>
  );
}
