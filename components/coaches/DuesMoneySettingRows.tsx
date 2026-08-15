'use client';
import {
  CREDIT_APPLICATION_MODES, CREDIT_MODE_LABELS, CREDIT_MODE_HINTS,
  type CreditApplicationMode,
} from '@/lib/dues-credits';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The two team-wide dues settings, as rows — Automatic Dues Reminders and Credits reduce.
 *
 * Their HOME is Team settings → Money. They also appear inline on Player Dues while no dues
 * schedule exists anywhere on the roster, because that is the one moment a coach is deciding how
 * dues will work and nothing they change can surprise a family yet.
 *
 * ⚠ Two screens, ONE set of rows. The wording of these two settings is the product's answer to
 * "what will this do to my families", and the same sentence rendered from two copies is a sentence
 * that will eventually say two things. Presentational only: each caller keeps its own state and
 * decides what a save MEANS to it (the dues page reloads its table, because the credit mode
 * changes every "to send" figure on screen; the settings page has nothing to reload).
 */
export default function DuesMoneySettingRows({
  autoReminders,
  creditMode,
  canWrite,
  remindersSaving,
  creditModeSaving,
  onToggleReminders,
  onChangeCreditMode,
  onPreviewReminder,
  creditNote,
}: {
  autoReminders: boolean;
  creditMode: CreditApplicationMode;
  /** Money = write. A view-only money coach reads the answers and is offered no controls. */
  canWrite: boolean;
  remindersSaving: boolean;
  creditModeSaving: boolean;
  onToggleReminders: (enabled: boolean) => void;
  onChangeCreditMode: (mode: CreditApplicationMode) => void;
  onPreviewReminder: () => void;
  /** Appended to the credits description where the consequence needs spelling out (the settings
   *  page, which is further from the table those figures live on). */
  creditNote?: string;
}) {
  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingRowMain}>
          <span className={styles.settingRowLabel}>Automatic dues reminders</span>
          <span className={styles.settingRowDesc}>
            {autoReminders
              ? 'Emails families 30 days and 7 days before each due date.'
              : 'Off — no automatic emails go to families.'}
          </span>
        </div>
        <div className={styles.settingRowCtl}>
          <button
            type="button"
            className={styles.btnGhost}
            /* Quiet by type size, NOT by tap size — 44px is the portal's floor and the
               mouse-only exception was already rejected once (money-rail pass). */
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', minHeight: 44 }}
            onClick={onPreviewReminder}
          >
            See an example
          </button>
          {canWrite ? (
            <button
              type="button"
              className={autoReminders ? styles.btnPrimary : styles.btnGhost}
              disabled={remindersSaving}
              style={{ fontSize: '0.8rem', minHeight: 44 }}
              onClick={() => onToggleReminders(!autoReminders)}
            >
              {remindersSaving ? '…' : autoReminders ? 'Enabled' : 'Disabled'}
            </button>
          ) : (
            <span className={styles.settingRowDesc}>{autoReminders ? 'Enabled' : 'Disabled'}</span>
          )}
        </div>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingRowMain}>
          <span className={styles.settingRowLabel}>Credits reduce</span>
          <span className={styles.settingRowDesc}>
            {CREDIT_MODE_HINTS[creditMode]}.{creditNote ? ` ${creditNote}` : ''}
          </span>
        </div>
        <div className={styles.settingRowCtl}>
          {canWrite ? (
            <select
              className={styles.input}
              aria-label="How credits reduce dues"
              value={creditMode}
              disabled={creditModeSaving}
              style={{ width: 'auto', fontSize: '0.8rem', minHeight: 44 }}
              onChange={e => onChangeCreditMode(e.target.value as CreditApplicationMode)}
            >
              {/* One source for the three sentences — the picker, the settings page and the
                  dues page's policy line can never drift (lib/dues-credits). */}
              {CREDIT_APPLICATION_MODES.map(m => (
                <option key={m} value={m}>{CREDIT_MODE_LABELS[m]}</option>
              ))}
            </select>
          ) : (
            <span className={styles.settingRowDesc}>{CREDIT_MODE_LABELS[creditMode]}</span>
          )}
        </div>
      </div>
    </>
  );
}
