'use client';
import { useLiveLogic } from './LiveLogicProvider';
import { cn } from '@/lib/utils';

export function LiveLogicRail() {
  const { events, dismiss } = useLiveLogic();

  // top = the original 5rem clearance + the Stage C top strip's height, so toasts keep the
  // same distance from the event header now that all admin chrome sits under the strip. The
  // var resolves only when this rail is mounted inside .adminShell (AdminChrome does); the
  // 0px fallback reproduces the old offset anywhere else.
  //
  // z-1050, not 9999: these toasts land top-right — exactly where the notification panel and
  // the What's-New popover (1100+) drop from the strip — so on a game day an ambient score
  // ticker was painting over a panel the operator had just opened. The rail is ambient
  // information, so it sits ABOVE the shell chrome (strip 60, sticky header 40) and BELOW
  // anything the operator deliberately opened (top-nav audit §D12, 2026-08-01).
  return (
    <div className="fixed top-[calc(var(--admin-topstrip-h,0px)+5rem)] right-4 z-[1050] flex flex-col gap-2 w-[360px] pointer-events-none">
      {events.map(event => (
        <div
          key={event.id}
          className="pointer-events-auto border-l-2 border-logic-lime bg-structural-slate px-4 py-3 animate-hud-boot"
        >
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className={cn(
              'font-mono text-[10px] font-bold tracking-wider',
              (event.type === 'SCORE_UPDATE' || event.type === 'GAME_COMPLETE')
                ? 'text-logic-lime'
                : event.type === 'TEAM_REGISTERED'
                ? 'text-blueprint-light'
                : 'text-data-gray',
            )}>
              [{event.type}]
            </span>
            <button
              onClick={() => dismiss(event.id)}
              className="font-mono text-[10px] text-data-gray/50 hover:text-data-gray leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="font-mono text-[10px] text-data-gray/70 tracking-wider">{event.title}</div>
          <div className="font-mono text-xs text-fl-text/80 leading-snug mt-0.5">{event.detail}</div>
          <div className="font-mono text-[9px] text-data-gray/40 mt-1">
            {event.timestamp.toLocaleTimeString('en-CA', { hour12: false })}
          </div>
        </div>
      ))}
    </div>
  );
}
