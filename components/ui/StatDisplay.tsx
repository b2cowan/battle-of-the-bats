import { cn } from '@/lib/utils';

interface StatDisplayProps {
  value: string | number;
  label: string;
  unit?: string;
  highlight?: boolean;
}

export function StatDisplay({ value, label, unit, highlight }: StatDisplayProps) {
  return (
    <div>
      <div className="hud-label">{label}</div>
      <div className={cn('font-mono text-stat mt-1', highlight ? 'text-logic-lime' : 'text-fl-text')}>
        {value}
        {unit && <span className="text-data-gray text-sm ml-1">{unit}</span>}
      </div>
    </div>
  );
}
