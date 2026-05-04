'use client';
import { useLiveLogic } from './LiveLogicProvider';
import { cn } from '@/lib/utils';

export function LiveLogicRail() {
  const { events, dismiss } = useLiveLogic();

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 w-[360px] pointer-events-none">
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
