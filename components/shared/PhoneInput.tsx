'use client';
/**
 * The product's one phone box: a phone-keyboard input that lays the number out as "(416) 904-0390"
 * while it is typed or pasted. `onChange` is handed the VALUE, like the date and time fields.
 * A number saved before this existed shows laid out too, without being rewritten until it is edited.
 */
import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';
import { caretAfterDigits, formatPhone } from '@/lib/phone-format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

export default function PhoneInput({ value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const shown = formatPhone(value);

  // Reshaping the text moves the caret to the end; put it back after the same digit, so fixing a
  // digit in the middle of a number does not jump to the end.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="tel"
      inputMode="tel"
      value={shown}
      onChange={e => {
        const typed = e.target.value;
        const next = formatPhone(typed);
        const at = e.target.selectionStart ?? typed.length;
        // Only when the text was actually reshaped; text left as typed keeps the browser's own caret.
        if (next !== typed && at < typed.length) caret.current = caretAfterDigits(next, typed.slice(0, at).replace(/\D/g, '').replace(/^1(?=\d)/, '').length);
        onChange(next);
      }}
    />
  );
}
