import { useEffect, useRef, useState } from 'react';
import Modal, { useModalIds } from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import PasswordField from '../../components/ui/PasswordField';
import SelectField from '../../components/ui/SelectField';
import { useToast } from '../../components/ui/Toast';
import { createUser, listUsers, updateUser } from '../../api/users';
import { useFetch } from '../../hooks/useFetch';
import { ROLES } from '../../constants';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ROLE_OPTIONS = [
  { value: ROLES.EMPLOYEE, label: 'Employee' },
  { value: ROLES.MANAGER, label: 'Manager' },
  { value: ROLES.ADMIN, label: 'Admin' },
];

const validate = (v, isEdit) => {
  const errors = {};
  if (!v.name.trim()) errors.name = 'Enter a name';
  if (!v.email.trim()) errors.email = 'Enter an email address';
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Enter a valid email, like name@company.com';
  if (!isEdit && v.password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (isEdit && v.password && v.password.length < 6) errors.password = 'New password must be at least 6 characters';
  return errors;
};

/** Create (user = null) or edit a user. Calls onSaved(user) after success. */
export default function UserFormDialog({ open, user, currentUserId, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const isSelf = isEdit && user._id === currentUserId;
  const toast = useToast();
  const nameRef = useRef(null);
  const { titleId } = useModalIds();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // Active managers for the "Reports to" dropdown.
  const managers = useFetch(
    (signal) => (open ? listUsers({ role: ROLES.MANAGER, isActive: 'true', limit: 100 }, { signal }) : Promise.resolve(null)),
    [open]
  );

  useEffect(() => {
    if (!open) return;
    setValues({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? ROLES.EMPLOYEE,
      manager: user?.manager?._id ?? '',
      password: '',
    });
    setErrors({});
    setServerError('');
  }, [open, user]);

  if (!open || !values.role) return null;

  const managerOptions = [
    { value: '', label: 'No manager' },
    ...(managers.data?.data || [])
      .filter((m) => m._id !== user?._id)
      .map((m) => ({ value: m._id, label: `${m.name} (${m.email})` })),
  ];
  // Keep the current manager selectable even if they are no longer an active manager.
  if (user?.manager && !managerOptions.some((o) => o.value === user.manager._id)) {
    managerOptions.push({ value: user.manager._id, label: `${user.manager.name} (current)` });
  }

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setServerError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = validate(values, isEdit);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role,
      manager: values.manager || null,
    };
    if (values.password) body.password = values.password;
    if (isSelf) delete body.role;

    setSaving(true);
    try {
      const { user: saved } = isEdit ? await updateUser(user._id, body) : await createUser(body);
      toast.success(isEdit ? 'User updated' : 'User created', `${saved.name} · ${saved.role}`);
      onSaved(saved);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={saving} initialFocusRef={nameRef} labelledBy={titleId} size="md">
      <form onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {isEdit ? 'Edit user' : 'Add user'}
          </h2>
          <p className="dialog__subtitle">
            {isEdit ? 'Update details, role or reporting manager.' : 'New users get 12 casual, 8 sick and 15 paid leave days.'}
          </p>
        </div>

        <fieldset className="dialog__stack dialog__fieldset" disabled={saving}>
          {serverError && <Alert variant="error">{serverError}</Alert>}
          <TextField ref={nameRef} label="Full name" value={values.name} onChange={set('name')} error={errors.name} autoComplete="off" />
          <TextField label="Email" type="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="off" />
          <div className="form-row">
            <div className="field">
              <SelectField label="Role" value={values.role} options={ROLE_OPTIONS} onChange={set('role')} disabled={isSelf} />
              {isSelf && <p className="field__hint">You can't change your own role.</p>}
            </div>
            <SelectField label="Reports to" value={values.manager} options={managerOptions} onChange={set('manager')} />
          </div>
          <PasswordField
            label={isEdit ? 'New password' : 'Password'}
            value={values.password}
            onChange={set('password')}
            error={errors.password}
            autoComplete="new-password"
            hint={isEdit ? 'Leave blank to keep the current password.' : 'At least 6 characters. Share it with the user securely.'}
          />
        </fieldset>

        <div className="dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
