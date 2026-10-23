import { useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import Brand from '../components/Brand';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import TextField from '../components/ui/TextField';
import PasswordField from '../components/ui/PasswordField';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@example.com' },
  { label: 'Manager', email: 'manager1@example.com' },
  { label: 'Employee', email: 'employee1@example.com' },
];
const DEMO_PASSWORD = 'Password@123';

const validate = ({ email, password }) => {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email, like name@company.com';
  if (!password) errors.password = 'Enter your password';
  return errors;
};

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const update = (field) => (e) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    // Re-validate live only after the first submit attempt, so users aren't nagged while typing.
    if (submitted) setErrors(validate(next));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);

    const found = validate(values);
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setLoading(true);
    setServerError('');
    try {
      await login(values.email.trim(), values.password);
      // GuestOnly route redirects once the user is authenticated.
    } catch (err) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  const fillDemo = (email) => {
    setValues({ email, password: DEMO_PASSWORD });
    setErrors({});
    setServerError('');
  };

  return (
    <div className="auth-page">
      <main className="auth-card">
        <Brand to="/login" />

        <div className="auth-card__panel">
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__subtitle">Welcome back. Enter your work email and password.</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {notice && !serverError && <Alert variant="info">{notice}</Alert>}
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <TextField
              ref={emailRef}
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={values.email}
              onChange={update('email')}
              error={errors.email}
              autoFocus
            />

            <PasswordField
              ref={passwordRef}
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={values.password}
              onChange={update('password')}
              error={errors.password}
            />

            <Button type="submit" block loading={loading}>
              {!loading && <LogIn aria-hidden="true" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        {import.meta.env.DEV && (
          <section className="demo-accounts" aria-label="Demo accounts">
            <p className="demo-accounts__title">Demo accounts</p>
            <p className="text-muted">
              Password for all: <code>{DEMO_PASSWORD}</code>. Click to fill the form.
            </p>
            <div className="demo-accounts__list">
              {DEMO_ACCOUNTS.map(({ label, email }) => (
                <Button key={email} variant="secondary" size="sm" onClick={() => fillDemo(email)} disabled={loading}>
                  {label}
                </Button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
