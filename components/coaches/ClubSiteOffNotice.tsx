import styles from './SaveOverQuestion.module.css';

/**
 * Told where they share from (Club Tier Stage 4a, S4-08). Since 4a a club's site switch closes every public club page,
 * the team page included, so a coach who chose Public link would otherwise find out from a parent. Shown only while the
 * club's site is off (the team settings API reads the switch on the server); there is nothing to set here — the owner
 * turns the site on and off in Settings. Stage 4c moves it into the "Your team's public page" door. It wears the portal's
 * one warning callout (`.warn`, the white callout with the warning edge) rather than a copy of it.
 */
export default function ClubSiteOffNotice() {
  return (
    <p className={styles.warn} role="status">
      {'Your club’s public site is turned off, so your team’s public page doesn’t open for anyone right now. The club’s owner turns it back on.'}
    </p>
  );
}
