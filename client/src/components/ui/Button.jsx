import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * variant: primary | secondary | ghost | danger
 * size: md | sm
 * loading: shows a spinner and disables the button (prevents double submits)
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', block = false, icon = false, loading = false, disabled, className = '', children, type = 'button', ...props },
  ref
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    icon && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
