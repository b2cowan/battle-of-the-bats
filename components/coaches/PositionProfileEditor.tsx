'use client';
import { ChevronUp, ChevronDown } from 'lucide-react';
import HelpTooltip from '@/components/help/HelpTooltip';

// Best / Okay / Never position picker for the Lineup Intelligence player profile (P1).
// Replaces the old Primary/Secondary dropdowns with a single, richer control:
//   • Tap a position chip to cycle it: (unset) → Best → Okay → Never → (unset).
//   • "Best" is RANKED — the order chips are added is the priority; reorder with the arrows.
//   • "Never" is a HARD block the lineup auto-fill will never assign.
// The parent owns the value ({best, okay, never}); this component is presentational + stateless.

export type PositionState = 'best' | 'okay' | 'never' | 'neutral';

export interface PositionProfileValue {
  best: string[];   // ordered = priority (rank 1 first)
  okay: string[];
  never: string[];
}

interface Props {
  positions: string[];                     // sport vocabulary (chips)
  value: PositionProfileValue;
  onChange: (next: PositionProfileValue) => void;
  labelFor?: (code: string) => string;     // optional display label per code
  disabled?: boolean;
}

const NEXT_STATE: Record<PositionState, PositionState> = {
  neutral: 'best',
  best: 'okay',
  okay: 'never',
  never: 'neutral',
};

const CHIP_STYLE: Record<PositionState, React.CSSProperties> = {
  best:    { background: 'rgba(132,204,22,0.16)', borderColor: 'rgba(132,204,22,0.55)', color: '#bef264' },
  okay:    { background: 'rgba(96,165,250,0.14)', borderColor: 'rgba(96,165,250,0.45)', color: '#93c5fd' },
  never:   { background: 'rgba(248,113,113,0.14)', borderColor: 'rgba(248,113,113,0.5)', color: '#fca5a5', textDecoration: 'line-through' },
  neutral: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' },
};

const STATE_WORD: Record<Exclude<PositionState, 'neutral'>, string> = {
  best: 'Best', okay: 'Okay', never: 'Never',
};

export default function PositionProfileEditor({ positions, value, onChange, labelFor, disabled }: Props) {
  const { best, okay, never } = value;

  const stateOf = (code: string): PositionState => {
    if (best.includes(code)) return 'best';
    if (okay.includes(code)) return 'okay';
    if (never.includes(code)) return 'never';
    return 'neutral';
  };

  const setState = (code: string, target: PositionState) => {
    // Remove from every bucket, then add to the target (neutral = removed everywhere).
    const next: PositionProfileValue = {
      best: best.filter(c => c !== code),
      okay: okay.filter(c => c !== code),
      never: never.filter(c => c !== code),
    };
    if (target === 'best') next.best = [...next.best, code];
    else if (target === 'okay') next.okay = [...next.okay, code];
    else if (target === 'never') next.never = [...next.never, code];
    onChange(next);
  };

  const cycle = (code: string) => { if (!disabled) setState(code, NEXT_STATE[stateOf(code)]); };

  const moveBest = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (disabled || j < 0 || j >= best.length) return;
    const reordered = [...best];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    onChange({ best: reordered, okay, never });
  };

  const label = (code: string) => (labelFor ? labelFor(code) : code);

  // Show a chip for every offered position, plus any value already set that isn't offered
  // (e.g. a legacy OF/DH or a custom entry) so nothing becomes an un-editable ghost. Extras
  // vanish once cycled back to Not set, so the list self-cleans down to the offered positions.
  const extras = Array.from(new Set([...best, ...okay, ...never].filter(c => !positions.includes(c))));
  const allChips = [...positions, ...extras];

  if (!allChips.length) {
    return <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>No positions defined for this sport.</p>;
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
        <LegendDot state="best" text="Best (tap to rank)" />
        <LegendDot state="okay" text="Okay — fill in if needed" />
        <LegendDot state="never" text="Never — hard block" />
        <LegendDot state="neutral" text="Not set — only if needed" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Tap a position to cycle
          <HelpTooltip
            title="How positions guide the lineup"
            size="md"
            content={
              <div style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.75)' }}>
                <p style={{ margin: '0 0 8px' }}>Where the game-day <strong>Auto-fill</strong> will play this player:</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <HelpStateRow state="best" label="Best" desc="go-to spots, in your rank order — used first" />
                  <HelpStateRow state="okay" label="Okay" desc="a fine fill-in when Best spots are taken" />
                  <HelpStateRow state="never" label="Never" desc="a hard block — never placed here" />
                  <HelpStateRow state="neutral" label="Not set" desc="allowed, not preferred — used only to round out the field" />
                </ul>
                <p style={{ margin: '9px 0 0', color: 'rgba(255,255,255,0.55)' }}>Playing time stays fair (no back-to-back sits). You can edit the lineup before the game.</p>
              </div>
            }
          />
        </span>
      </div>

      {/* Chip grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allChips.map(code => {
          const st = stateOf(code);
          const rank = st === 'best' ? best.indexOf(code) + 1 : 0;
          return (
            <button
              key={code}
              type="button"
              onClick={() => cycle(code)}
              disabled={disabled}
              aria-label={`${label(code)}: ${st === 'neutral' ? 'not set' : STATE_WORD[st]}. Tap to change.`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999, border: '1px solid',
                fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                transition: 'all 0.12s ease', ...CHIP_STYLE[st],
              }}
            >
              {rank > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 16, height: 16, borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: 'rgba(132,204,22,0.35)', color: '#f7fee7',
                }}>{rank}</span>
              )}
              {label(code)}
            </button>
          );
        })}
      </div>

      {/* Best priority reorder — only meaningful with 2+ */}
      {best.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>
            Best positions — priority order
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {best.map((code, idx) => (
              <div key={code} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 8,
                background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.3)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#bef264', minWidth: 16 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#ecfccb' }}>{label(code)}</span>
                <button type="button" onClick={() => moveBest(idx, -1)} disabled={disabled || idx === 0}
                  aria-label={`Move ${label(code)} up`}
                  style={arrowBtn(disabled || idx === 0)}>
                  <ChevronUp size={15} />
                </button>
                <button type="button" onClick={() => moveBest(idx, 1)} disabled={disabled || idx === best.length - 1}
                  aria-label={`Move ${label(code)} down`}
                  style={arrowBtn(disabled || idx === best.length - 1)}>
                  <ChevronDown size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HelpStateRow({ state, label, desc }: { state: PositionState; label: string; desc: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        flexShrink: 0, marginTop: 4, width: 10, height: 10, borderRadius: 3, border: '1px solid',
        background: CHIP_STYLE[state].background, borderColor: CHIP_STYLE[state].borderColor,
      }} />
      <span><strong style={{ color: 'rgba(255,255,255,0.92)' }}>{label}</strong> — {desc}</span>
    </li>
  );
}

function LegendDot({ state, text }: { state: PositionState; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 10, height: 10, borderRadius: 3, border: '1px solid',
        background: CHIP_STYLE[state].background, borderColor: CHIP_STYLE[state].borderColor,
      }} />
      {text}
    </span>
  );
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
    cursor: disabled ? 'default' : 'pointer',
  };
}
