import styles from './TryoutPage.module.css';

/** The open tryout pages' contact line (Stage 4b-2b): "Questions? Email the club at", the address on its own line that
 *  never splits at a hyphen. Absent without an address. (A status page's contact, with Copy, is ClubContactCard.) */
export default function ClubContactLine({ email }: { email: string | null }) {
  if (!email) return null;
  return <p className={styles.ctline}>Questions? Email the club at<b>{email}</b></p>;
}
