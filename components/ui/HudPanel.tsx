import { cn } from '@/lib/utils';

interface HudPanelProps {
  children: React.ReactNode;
  className?: string;
  live?: boolean;
  label?: string;
}

export function HudPanel({ children, className, live, label }: HudPanelProps) {
  return (
    <div className={cn(
      'bg-hud-surface border border-blueprint-blue p-4 shadow-hud relative overflow-hidden',
      live && 'border-logic-lime shadow-hud-lime',
      className
    )}>
      {label && <div className="hud-label mb-3">{label}</div>}
      {children}
    </div>
  );
}
