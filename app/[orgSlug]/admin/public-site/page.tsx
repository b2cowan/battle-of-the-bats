'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './public-site.module.css';

interface SiteForm {
  tagline: string;
  description: string;
  contactEmail: string;
  socialInstagram: string;
  socialFacebook: string;
  socialX: string;
  socialWebsite: string;
  showUpcomingTournaments: boolean;
  showArchivesLink: boolean;
}

const EMPTY: SiteForm = {
  tagline: '',
  description: '',
  contactEmail: '',
  socialInstagram: '',
  socialFacebook: '',
  socialX: '',
  socialWebsite: '',
  showUpcomingTournaments: true,
  showArchivesLink: true,
};

export default function PublicSitePage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const [saved, setSaved]     = useState<SiteForm>(EMPTY);
  const [form, setForm]       = useState<SiteForm>(EMPTY);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res  = await fetch('/api/admin/public-site');
      const data = await res.json();
      const populated: SiteForm = {
        tagline:                 data.tagline             ?? '',
        description:             data.description         ?? '',
        contactEmail:            data.contactEmail        ?? '',
        socialInstagram:         data.socialInstagram     ?? '',
        socialFacebook:          data.socialFacebook      ?? '',
        socialX:                 data.socialX             ?? '',
        socialWebsite:           data.socialWebsite       ?? '',
        showUpcomingTournaments: data.showUpcomingTournaments ?? true,
        showArchivesLink:        data.showArchivesLink        ?? true,
      };
      setSaved(populated);
      setForm(populated);
    } catch {
      setErrorMsg('Failed to load public site settings.');
      setErrorOpen(true);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (currentOrg) load();
  }, [currentOrg, load]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/public-site', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(form);
      setSuccessOpen(true);
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Something went wrong');
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof SiteForm>(key: K, val: SiteForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_public_site')) {
    return (
      <div className={styles.accessDenied}>
        <Globe size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Public Site module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><Globe size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Public Site</h1>
          <p className={styles.pageSub}>Edit your org&apos;s public-facing home page</p>
        </div>
      </div>

      {currentOrg && (
        <Link href={`/${currentOrg.slug}`} target="_blank" rel="noopener noreferrer" className={styles.settingsLink}>
          <ExternalLink size={13} />
          Preview your public page
        </Link>
      )}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* Page Content */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Page Content</h2>
            <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>
              Your logo, hero image, and colour theme are managed in{' '}
              <Link href={currentOrg ? `/${currentOrg.slug}/admin/org/settings` : '#'} className={styles.settingsLink} style={{ display: 'inline-flex' }}>
                Org Settings
              </Link>.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ps-tagline">Tagline</label>
              <input
                id="ps-tagline"
                type="text"
                className={styles.input}
                value={form.tagline}
                onChange={e => set('tagline', e.target.value.slice(0, 100))}
                placeholder="e.g. Milton's Premier Youth Softball Tournament"
                maxLength={100}
              />
              <div className={styles.charRow}>
                <p className={styles.hint}>Short headline shown below your org name.</p>
                <span className={`${styles.charCount} ${form.tagline.length > 85 ? styles.charCountWarn : ''}`}>
                  {form.tagline.length} / 100
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ps-description">About</label>
              <textarea
                id="ps-description"
                className={styles.textarea}
                value={form.description}
                onChange={e => set('description', e.target.value.slice(0, 1000))}
                placeholder="A paragraph describing your organization, its history, and what makes it special."
                rows={4}
                maxLength={1000}
              />
              <div className={styles.charRow}>
                <p className={styles.hint}>Shown in the hero section of your public page.</p>
                <span className={`${styles.charCount} ${form.description.length > 900 ? styles.charCountWarn : ''}`}>
                  {form.description.length} / 1000
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ps-contact-email">Contact Email</label>
              <input
                id="ps-contact-email"
                type="email"
                className={styles.input}
                value={form.contactEmail}
                onChange={e => set('contactEmail', e.target.value)}
                placeholder="info@yourorg.ca"
                maxLength={254}
              />
              <p className={styles.hint}>Displayed publicly so visitors can reach you.</p>
            </div>
          </div>

          {/* Social Links */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Social Links</h2>

            {(
              [
                { id: 'ps-instagram', key: 'socialInstagram', label: 'Instagram',        placeholder: 'https://instagram.com/yourorg' },
                { id: 'ps-facebook',  key: 'socialFacebook',  label: 'Facebook',         placeholder: 'https://facebook.com/yourorg' },
                { id: 'ps-x',         key: 'socialX',         label: 'X / Twitter',      placeholder: 'https://x.com/yourorg' },
                { id: 'ps-website',   key: 'socialWebsite',   label: 'Website',          placeholder: 'https://yourorg.ca' },
              ] as const
            ).map(({ id, key, label, placeholder }) => (
              <div className={styles.field} key={key}>
                <label className={styles.label} htmlFor={id}>{label}</label>
                <input
                  id={id}
                  type="url"
                  className={styles.input}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  maxLength={500}
                />
              </div>
            ))}
            <p className={styles.hint}>Leave blank to hide. Links must start with https://</p>
          </div>

          {/* Display Options */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Display Options</h2>

            <div className={styles.field}>
              <label className={styles.toggleRow} htmlFor="ps-show-tournaments">
                <div>
                  <span className={styles.label} style={{ margin: 0 }}>Show upcoming tournaments</span>
                  <p className={styles.hint} style={{ marginTop: '0.2rem' }}>
                    Auto-display a card for each active tournament, linking to its schedule.
                  </p>
                </div>
                <input
                  id="ps-show-tournaments"
                  type="checkbox"
                  className={styles.toggle}
                  checked={form.showUpcomingTournaments}
                  onChange={e => set('showUpcomingTournaments', e.target.checked)}
                />
              </label>
            </div>

            <div className={styles.field}>
              <label className={styles.toggleRow} htmlFor="ps-show-archives">
                <div>
                  <span className={styles.label} style={{ margin: 0 }}>Show past tournaments link</span>
                  <p className={styles.hint} style={{ marginTop: '0.2rem' }}>
                    Display a link to your tournament archives page (only shown if archives exist).
                  </p>
                </div>
                <input
                  id="ps-show-archives"
                  type="checkbox"
                  className={styles.toggle}
                  checked={form.showArchivesLink}
                  onChange={e => set('showArchivesLink', e.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className={styles.formFooter}>
            {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !isDirty}
              id="ps-save-btn"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </>
      )}

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message="Public site settings saved." type="success" />
      <FeedbackModal isOpen={errorOpen}   onClose={() => setErrorOpen(false)}   title="Error" message={errorMsg}                  type="danger"  />
    </div>
  );
}
