'use client';
/** The kit's settings switch row (a switch, its name, what it does) — the shape QuestionWindow's switch draws. */
import ck from '../ClubKit.module.css';

export default function SwitchRow({ id, name, hint, on, disabled = false, onChange }: {
  id: string; name: string; hint?: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={`${ck.switchRow}${on ? '' : ` ${ck.switchRowOff}`}`}>
      <div className={ck.switchText}>
        <span className={ck.switchName} id={id}>{name}</span>
        {hint && <p className={ck.hint} id={`${id}-hint`}>{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} aria-describedby={hint ? `${id}-hint` : undefined}
        className={ck.switch} disabled={disabled} onClick={() => onChange(!on)} />
    </div>
  );
}
