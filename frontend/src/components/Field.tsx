import { useId, useState } from 'react';

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000_000,
  step = 1,
  hint,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const invalid =
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (step === 1 && !Number.isInteger(value));
  const showError = touched && invalid;
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        required
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? NaN : event.target.valueAsNumber)}
        onBlur={() => setTouched(true)}
        aria-invalid={showError || undefined}
        aria-describedby={showError || hint ? `${id}-hint` : undefined}
      />
      {(showError || hint) && (
        <span id={`${id}-hint`} className={showError ? 'field-error' : 'hint'}>
          {showError
            ? `Nhập ${step === 1 ? 'số nguyên ' : 'số '}từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}.`
            : hint}
        </span>
      )}
    </label>
  );
}
export function PercentField(props: {
  label: string;
  value: number;
  onChange: (bps: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <NumberField
      {...props}
      value={props.value / 100}
      max={100}
      step={0.01}
      onChange={(value) => props.onChange(Math.round(value * 100))}
    />
  );
}
