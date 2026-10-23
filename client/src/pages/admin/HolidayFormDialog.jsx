import { useEffect, useRef, useState } from 'react';
import Modal, { useModalIds } from '../../components/ui/Modal';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { createHoliday, updateHoliday } from '../../api/holidays';
import { dateKey, formatDate } from '../../utils/format';

/** Add (holiday = null) or edit a holiday. */
export default function HolidayFormDialog({ open, holiday, defaultYear, onClose, onSaved }) {
  const isEdit = Boolean(holiday);
  const toast = useToast();
  const nameRef = useRef(null);
  const { titleId } = useModalIds();
  const [values, setValues] = useState({ name: '', date: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({ name: holiday?.name ?? '', date: holiday ? dateKey(holiday.date) : '' });
    setErrors({});
    setServerError('');
  }, [open, holiday]);

  if (!open) return null;

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setServerError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = {};
    if (!values.name.trim()) found.name = 'Enter a holiday name';
    else if (values.name.trim().length > 100) found.name = 'Keep the name under 100 characters';
    if (!values.date) found.date = 'Choose a date';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const body = { name: values.name.trim(), date: values.date };
      const { holiday: saved } = isEdit ? await updateHoliday(holiday._id, body) : await createHoliday(body);
      toast.success(isEdit ? 'Holiday updated' : 'Holiday added', `${saved.name} · ${formatDate(saved.date)}`);
      onSaved(saved);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={saving} initialFocusRef={nameRef} labelledBy={titleId}>
      <form onSubmit={submit} noValidate>
        <div className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {isEdit ? 'Edit holiday' : 'Add holiday'}
          </h2>
          <p className="dialog__subtitle">Holidays are not counted as leave days. Leaves already applied for keep their day count.</p>
        </div>
        <fieldset className="dialog__stack dialog__fieldset" disabled={saving}>
          {serverError && <Alert variant="error">{serverError}</Alert>}
          <TextField ref={nameRef} label="Name" placeholder="e.g. Diwali" value={values.name} onChange={set('name')} error={errors.name} maxLength={100} />
          <TextField
            label="Date"
            type="date"
            value={values.date}
            onChange={set('date')}
            error={errors.date}
            min={`${defaultYear - 1}-01-01`}
          />
        </fieldset>
        <div className="dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add holiday'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
