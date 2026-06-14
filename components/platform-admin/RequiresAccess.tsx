import styles from './RequiresAccess.module.css';

/**
 * Inline "you can't act here" note for platform-admin surfaces, shown next to (or in
 * place of) a control a role can view but not use. Single source of truth for the
 * least-privilege message so it reads identically everywhere — matches the existing
 * observability StatusControls "View-only for your role" note.
 *
 *   <RequiresAccess permission="billing access" role="billing" />
 *   → "Requires billing access — contact the billing team"
 */
export default function RequiresAccess({ permission, role }: { permission: string; role?: string }) {
  return (
    <span className={styles.note}>
      Requires {permission}{role ? ` — contact the ${role} team` : ''}
    </span>
  );
}
