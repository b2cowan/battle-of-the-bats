'use client';

/**
 * components/notifications/PushDeviceTester.tsx
 *
 * A self-contained panel that lists the current user's registered push devices
 * and lets them fire a TEST notification at a specific one — reporting the real
 * outcome (delivered / server-not-configured / VAPID mismatch / expired). This
 * is the fast, self-serve way to confirm OS push actually reaches a phone,
 * instead of waiting for a real event and getting silence.
 *
 * User-scoped (push_subscriptions is per user, not per org), so it renders the
 * same on every notification-settings surface.
 */

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Send, CheckCircle2, AlertTriangle, XCircle, RefreshCw, BellRing, PowerOff } from 'lucide-react';
import {
  isPushSupported,
  getCurrentPushEndpoint,
  enablePushOnThisDevice,
  removePushDevice,
  PushPermissionError,
} from '@/lib/push-client';
import styles from './PushDeviceTester.module.css';

interface Device {
  id:          string;
  endpoint:    string;
  deviceLabel: string | null;
  lastUsedAt:  string | null;
  createdAt:   string | null;
}

type TestStatus = 'delivered' | 'not_configured' | 'mismatch' | 'gone' | 'error';
interface TestResult { status: TestStatus; message: string; }

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PushDeviceTester() {
  const [supported, setSupported]   = useState<boolean | null>(null);
  const [devices, setDevices]       = useState<Device[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [testingId, setTestingId]   = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [results, setResults]       = useState<Map<string, TestResult>>(new Map());
  const [enabling, setEnabling]     = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/notifications/push/devices');
      if (!res.ok) throw new Error('Failed to load devices.');
      const { devices } = await res.json() as { devices: Device[] };
      setDevices(devices);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) { setLoading(false); return; }
    getCurrentPushEndpoint().then(setCurrentEndpoint).catch(() => setCurrentEndpoint(null));
    load();
  }, [load]);

  // Register THIS device (request OS permission + subscribe + save server-side).
  // The device list is server-side; a green "Push" preference toggle does NOT
  // register a device on its own, so this is the reliable one-tap way to do it
  // from the same panel that reports "no devices registered".
  async function handleEnableThisDevice() {
    setEnabling(true);
    setEnableError(null);
    try {
      await enablePushOnThisDevice();
      const ep = await getCurrentPushEndpoint();
      setCurrentEndpoint(ep);
      await load();
    } catch (e) {
      const reason = e instanceof PushPermissionError ? e.reason : 'failed';
      setEnableError(
        reason === 'denied'
          ? 'Notifications are blocked for this app. Turn them on in your phone or browser settings, then try again.'
        : reason === 'unsupported'
          ? 'This device doesn’t support push. On iPhone, add the app to your Home Screen first (iOS 16.4+).'
        : reason === 'unconfigured'
          ? 'Push isn’t set up on the server yet. Please try again later.'
        : 'Couldn’t turn on notifications on this device. Please try again.',
      );
    } finally {
      setEnabling(false);
    }
  }

  async function sendTest(device: Device) {
    setTestingId(device.id);
    setResults(prev => { const n = new Map(prev); n.delete(device.id); return n; });
    try {
      const res = await fetch('/api/notifications/push/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscriptionId: device.id }),
      });
      const data = await res.json().catch(() => ({})) as Partial<TestResult> & { error?: string };
      if (!res.ok) {
        setResults(prev => new Map(prev).set(device.id, {
          status: 'error',
          message: data.error ?? 'Test failed. Please try again.',
        }));
      } else {
        setResults(prev => new Map(prev).set(device.id, {
          status: (data.status as TestStatus) ?? 'error',
          message: data.message ?? '',
        }));
        // An expired device gets removed server-side — refresh the list.
        if (data.status === 'gone') load();
      }
    } catch {
      setResults(prev => new Map(prev).set(device.id, {
        status: 'error',
        message: 'Network error sending the test. Please try again.',
      }));
    } finally {
      setTestingId(null);
    }
  }

  // Turn a device OFF — stop notifications reaching it (and un-register this browser if it's the one).
  async function turnOff(device: Device) {
    setRemovingId(device.id);
    setResults(prev => { const n = new Map(prev); n.delete(device.id); return n; });
    try {
      await removePushDevice(device.endpoint);
      if (device.endpoint === currentEndpoint) setCurrentEndpoint(null);
      await load();
    } catch (e) {
      setResults(prev => new Map(prev).set(device.id, {
        status: 'error',
        message: e instanceof Error ? e.message : 'Could not turn off notifications on this device.',
      }));
    } finally {
      setRemovingId(null);
    }
  }

  if (supported === false) return null; // Push column already explains unsupported browsers.

  // "This device" counts as registered only if the browser's active subscription
  // matches a saved server row. A green Push preference toggle does not qualify.
  const currentDeviceRegistered = !!currentEndpoint && devices.some(d => d.endpoint === currentEndpoint);
  const showEnableCta = !loading && !currentDeviceRegistered;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Smartphone size={16} className={styles.headerIcon} />
          <div>
            <div className={styles.title}>Your notification devices</div>
            <div className={styles.sub}>
              Send a test to confirm push is reaching a device.
              <span className={styles.subExtra}> Open this page on the phone you want to test and tap its <strong>This device</strong> button.</span>
            </div>
          </div>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={load} aria-label="Refresh device list" disabled={loading}>
          <RefreshCw size={14} className={loading ? styles.spin : ''} />
        </button>
      </div>

      {loadError && (
        <div className={styles.error}><AlertTriangle size={14} /> {loadError}</div>
      )}

      {showEnableCta && (
        <div className={styles.enableRow}>
          <button
            type="button"
            className={styles.enableBtn}
            onClick={handleEnableThisDevice}
            disabled={enabling}
          >
            <BellRing size={14} />
            {enabling ? 'Turning on…' : 'Turn on notifications on this device'}
          </button>
          <span className={styles.enableHint}>
            Turning the <strong>Push</strong> toggle green isn’t enough on its own — tap here to
            register this phone so it can receive notifications.
          </span>
          {enableError && (
            <div className={styles.enableError}><AlertTriangle size={13} /> {enableError}</div>
          )}
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Loading devices…</div>
      ) : devices.length === 0 ? (
        <div className={styles.empty}>
          No devices registered yet — use <strong>Turn on notifications on this device</strong> above
          to register this phone, then send it a test.
        </div>
      ) : (
        <ul className={styles.list}>
          {devices.map(device => {
            const isCurrent = !!currentEndpoint && device.endpoint === currentEndpoint;
            const result    = results.get(device.id);
            const busy      = testingId === device.id;
            const removing  = removingId === device.id;
            return (
              <li key={device.id} className={styles.device}>
                <div className={styles.deviceTop}>
                  <div className={styles.deviceInfo}>
                    <span className={styles.deviceLabel}>
                      {device.deviceLabel || 'Unknown device'}
                      {isCurrent && <span className={styles.currentBadge}>This device</span>}
                    </span>
                    <span className={styles.deviceMeta}>
                      {device.lastUsedAt ? `Last used ${relativeTime(device.lastUsedAt)}` : 'Never used'}
                    </span>
                  </div>
                  <div className={styles.deviceActions}>
                    <button
                      type="button"
                      className={`${styles.testBtn} ${isCurrent ? styles.testBtnPrimary : ''}`}
                      onClick={() => sendTest(device)}
                      disabled={busy || removing}
                    >
                      <Send size={13} />
                      {busy ? 'Sending…' : isCurrent ? 'Test this device' : 'Send test'}
                    </button>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => turnOff(device)}
                      disabled={busy || removing}
                      aria-label={`Turn off notifications on ${device.deviceLabel || 'this device'}`}
                    >
                      <PowerOff size={13} />
                      {removing ? 'Turning off…' : 'Turn off'}
                    </button>
                  </div>
                </div>

                {result && (
                  <div className={`${styles.result} ${styles[`result_${result.status}`]}`}>
                    {result.status === 'delivered'
                      ? <CheckCircle2 size={14} />
                      : result.status === 'error' || result.status === 'mismatch'
                        ? <XCircle size={14} />
                        : <AlertTriangle size={14} />}
                    <span>{result.message}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
