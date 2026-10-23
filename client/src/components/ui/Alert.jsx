import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info, warning: AlertTriangle };

export default function Alert({ variant = 'info', children }) {
  const Icon = ICONS[variant];
  return (
    <div className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
