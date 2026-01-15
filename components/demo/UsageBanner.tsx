'use client';

import { useUsage } from '@/lib/contexts/usage-context';
import { Info, Warning, WarningCircle } from '@phosphor-icons/react';
import { formatCost } from '@/lib/usage';

export function UsageBanner() {
  const { usage, warningLevel, percentUsed, timeRemaining, costRemaining, checkResult } = useUsage();

  // Don't show banner if no usage or under 50%
  if (!warningLevel || !usage) {
    return null;
  }

  const getVariantStyles = () => {
    switch (warningLevel) {
      case 'high':
        return {
          bg: 'bg-destructive/10',
          border: 'border-destructive/20',
          text: 'text-destructive',
          icon: WarningCircle,
        };
      case 'medium':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/30',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-700 dark:text-orange-300',
          icon: Warning,
        };
      case 'low':
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-muted-foreground',
          icon: Info,
        };
    }
  };

  const styles = getVariantStyles();
  const Icon = styles.icon;

  const getMessage = () => {
    if (warningLevel === 'high') {
      return `Demo usage at ${Math.round(percentUsed)}%. Only ${costRemaining} remaining.`;
    }
    if (warningLevel === 'medium') {
      return `Demo usage at ${Math.round(percentUsed)}%. ${costRemaining} remaining.`;
    }
    return `Demo usage: ${formatCost(usage.totalCostUsd)} of ${formatCost(checkResult?.limits.maxCostUsd || 5)} used.`;
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${styles.bg} ${styles.border}`}
    >
      <Icon size={16} className={styles.text} />
      <span className={styles.text}>{getMessage()}</span>
      <span className="text-xs text-muted-foreground ml-auto">
        Resets in {timeRemaining}
      </span>
    </div>
  );
}
