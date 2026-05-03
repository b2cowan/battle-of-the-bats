'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Upload } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './settings.module.css';

interface OrgSettings {
  name: string;
  slug: string;
  logoUrl: string | null;
  isPublic: boolean;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const { currentOrg, userRole, loading, refresh } = useOrg();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', isPublic: false });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentOrg) return;
    fetch('/api/admin/org-settings')
      .then(r => r.json())
      .then((data: OrgSettings) => {
        setSettings(data);
        setForm({ name: data.name, slug: data.slug, isPublic: data.isPublic });
        setLogoPreview(data.logoUrl);
      })
      .catch(() => showError('Failed to load org settings'));
  }, [currentOrg]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setErrorOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          isPublic: form.isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      setSuccessMsg('Settings saved successfully.');
      setSuccessOpen(true);
      refresh();

      // Navigate to new slug if it changed
      if (data.slug && data.slug !== currentOrg.slug) {
        router.push(`/${data.slug}/admin/settings`);
      }
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/org-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setLogoPreview(data.logoUrl);
      setSuccessMsg('Logo updated.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      setLogoPreview(settings?.logoUrl ?? null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <div className={styles.accessDenied}>
          <Settings size={32} className={styles.accessDeniedIcon} />
          <h2>Access Denied</h2>
          <p>Only organization owners can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Settings size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageSub}>Manage your organization profile</p>
          </div>
        </div>
      </div>

      {/* Logo upload */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Organization Logo</h2>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className={styles.logoImg} />
              : <span className={styles.logoPlaceholder}>⚾</span>
            }
          </div>
          <div className={styles.logoActions}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              id="settings-logo-upload-btn"
            >
              <Upload size={15} />
              {uploading ? 'Uploading…' : 'Upload Logo'}
            </button>
            <p className={styles.logoHint}>JPG, PNG, or WebP — max 2 MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleLogoChange}
          style={{ display: 'none' }}
          id="settings-logo-input"
        />
      </div>

      {/* Org settings form */}
      <form onSubmit={handleSave}>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Organization Details</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-name">Organization Name</label>
            <input
              id="settings-name"
              type="text"
              className={styles.input}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-slug">URL Slug</label>
            <input
              id="settings-slug"
              type="text"
              className={styles.input}
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              required
              maxLength={60}
              pattern="[a-z0-9-]+"
            />
            {form.slug !== currentOrg?.slug && (
              <p className={styles.slugWarning}>
                ⚠ Changing your slug will change all your public URLs — existing links will break.
              </p>
            )}
            <p className={styles.hint}>Only lowercase letters, numbers, and hyphens.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.toggleRow} htmlFor="settings-public">
              <span className={styles.label} style={{ margin: 0 }}>Listed on /discover</span>
              <input
                id="settings-public"
                type="checkbox"
                className={styles.toggle}
                checked={form.isPublic}
                onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
              />
            </label>
            <p className={styles.hint}>When enabled, your organization appears in the public discover directory.</p>
          </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            id="settings-save-btn"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      <FeedbackModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Saved"
        message={successMsg}
        type="success"
      />
      <FeedbackModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Error"
        message={errorMsg}
        type="danger"
      />
    </div>
  );
}
