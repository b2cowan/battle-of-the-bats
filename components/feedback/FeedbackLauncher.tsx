'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackWidget from './FeedbackWidget';

/**
 * "Send feedback" trigger + the widget it opens. The single component each surface mounts. Pass a
 * `className` to match the host chrome (sidebar link, dropdown item, coach rail). `compact` renders
 * a small icon+label button with its own inline style for the scorekeeper / check-in headers.
 */
export default function FeedbackLauncher({
  className,
  label = 'Send feedback',
  helpSection,
  iconSize = 15,
  compact = false,
}: {
  className?: string;
  label?: string;
  helpSection?: string;
  iconSize?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        style={
          compact
            ? {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: '#94A3B8',
                fontFamily: 'var(--font-data)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: 0,
                flexShrink: 0,
              }
            : undefined
        }
      >
        <MessageSquarePlus size={iconSize} aria-hidden />
        <span>{compact ? 'Feedback' : label}</span>
      </button>
      <FeedbackWidget open={open} onClose={() => setOpen(false)} helpSection={helpSection} />
    </>
  );
}
