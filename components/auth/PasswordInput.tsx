'use client';
/**
 * components/auth/PasswordInput.tsx — a password box with the show/hide eye, for the public forms that dress their
 * own fields (tournament registration, the follow prompt). The start doors and their kin use PasswordField in
 * AccountForm, which also carries the label and the rule's hint; this is the bare input, so the caller keeps its
 * own label and look. The eye is the same one, with the same name for a screen reader and a 44px tap target.
 */
import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordInput.module.css';

export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.wrap}>
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className={styles.eye} onClick={() => setShow(s => !s)} aria-label="Show password" aria-pressed={show} aria-controls={props.id}>
        {show ? <EyeOff size={20} strokeWidth={1.8} aria-hidden /> : <Eye size={20} strokeWidth={1.8} aria-hidden />}
      </button>
    </div>
  );
}
