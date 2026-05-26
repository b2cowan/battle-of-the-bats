/**
 * /unsubscribe/confirmed
 *
 * Minimal dark-theme confirmation page shown after a successful (or invalid)
 * unsubscribe request. Matches the FieldLogicHQ marketing style.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unsubscribed — FieldLogicHQ',
  robots: 'noindex',
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function UnsubscribeConfirmedPage({ searchParams }: Props) {
  const params = await searchParams;
  const isError = Boolean(params.error);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0f14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        border: '1px solid rgba(217, 249, 157, 0.15)',
        padding: '2.5rem 2rem',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* Wordmark */}
        <div style={{
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid rgba(217, 249, 157, 0.12)',
        }}>
          <span style={{
            fontFamily: 'monospace, sans-serif',
            fontSize: '0.65rem',
            fontWeight: 900,
            color: '#D9F99D',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>
            FIELDLOGICHQ
          </span>
        </div>

        {isError ? (
          <>
            <h1 style={{
              color: '#F1F5F9',
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: '0 0 1rem',
              lineHeight: 1.3,
            }}>
              Link not recognised
            </h1>
            <p style={{
              color: 'rgba(241, 245, 249, 0.65)',
              fontSize: '0.9rem',
              lineHeight: 1.65,
              margin: 0,
            }}>
              This unsubscribe link has expired or is invalid. If you'd like to
              stop receiving FieldLogicHQ marketing emails, reply to any email
              you received and we'll remove you within 10 business days as
              required by CASL.
            </p>
          </>
        ) : (
          <>
            <h1 style={{
              color: '#F1F5F9',
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: '0 0 1rem',
              lineHeight: 1.3,
            }}>
              You've been unsubscribed
            </h1>
            <p style={{
              color: 'rgba(241, 245, 249, 0.65)',
              fontSize: '0.9rem',
              lineHeight: 1.65,
              margin: '0 0 1.25rem',
            }}>
              Your organization has been removed from FieldLogicHQ marketing
              emails. You won't receive any further promotional messages.
            </p>
            <p style={{
              color: 'rgba(241, 245, 249, 0.4)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              margin: 0,
            }}>
              Transactional emails — billing, account security, and tournament
              notifications — are not affected by this unsubscribe.
            </p>
          </>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(217, 249, 157, 0.08)',
        }}>
          <p style={{
            color: 'rgba(241, 245, 249, 0.25)',
            fontSize: '0.72rem',
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            FieldLogicHQ · Canada
          </p>
        </div>
      </div>
    </div>
  );
}
