import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TextField from './TextField';

const PasswordField = forwardRef(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField ref={ref} type={visible ? 'text' : 'password'} {...props}>
      {(input) => (
        <div className="input-wrap">
          {input}
          <button
            type="button"
            className="input-wrap__action"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      )}
    </TextField>
  );
});

export default PasswordField;
