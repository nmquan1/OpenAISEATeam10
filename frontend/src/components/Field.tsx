import { useId, useLayoutEffect, useRef, useState } from 'react';

const groupDigits = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const digitsBefore = (text: string, caret: number) =>
  text.slice(0, caret).replace(/\D/g, '').length;

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000_000,
  step = 1,
  hint,
  disabled = false,
  money = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  money?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const invalid =
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (step === 1 && !Number.isInteger(value));
  const showError = touched && invalid;
  // Money is shown grouped (299.000) in a text field; keep the caret after the same digit.
  const input = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = input.current;
    if (!money || !element || caretDigits.current === null) return;
    let position = 0;
    for (let seen = 0; position < element.value.length && seen < caretDigits.current; position++)
      if (/\d/.test(element.value[position]!)) seen++;
    element.setSelectionRange(position, position);
    caretDigits.current = null;
  });
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        ref={input}
        {...(money
          ? { type: 'text', inputMode: 'numeric' as const, autoComplete: 'off' }
          : { type: 'number', min, max, step })}
        value={Number.isFinite(value) ? (money ? groupDigits(value) : value) : ''}
        required
        disabled={disabled}
        onKeyDown={(event) => {
          if (!money || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const increment = (event.shiftKey ? 10000 : 1000) * (event.key === 'ArrowUp' ? 1 : -1);
          const current = Number.isFinite(value) ? value : min;
          onChange(Math.max(min, Math.min(max, current + increment)));
        }}
        onChange={(event) => {
          if (!money) return onChange(event.target.value === '' ? NaN : event.target.valueAsNumber);
          const text = event.target.value;
          const digits = text.replace(/\D/g, '');
          caretDigits.current = digitsBefore(text, event.target.selectionStart ?? text.length);
          onChange(digits === '' ? NaN : Number(digits));
        }}
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
