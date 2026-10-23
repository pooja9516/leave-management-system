import { AlertCircle, Inbox, RefreshCw, Loader2 } from 'lucide-react';
import Button from './Button';

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="state">
      <span className="state__icon">
        <Icon aria-hidden="true" />
      </span>
      <p className="state__title">{title}</p>
      {children && <p className="state__text">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', error, onRetry, children }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon">
        <AlertCircle aria-hidden="true" />
      </span>
      <p className="state__title">{title}</p>
      <p className="state__text">{error?.message || 'Please try again.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
      {children}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader" role="status">
      <div>
        <Loader2 className="spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
