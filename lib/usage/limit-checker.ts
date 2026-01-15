/**
 * Limit checking utilities for demo usage
 */

import type { DemoUsage, UsageCheckResult, UsageConfig } from './types';
import { getUsage, getSessionAgeHours, resetUsage } from './usage-storage';
import { getUsageConfig } from './config';

/**
 * Check if usage is within limits
 * Automatically resets session if expired
 */
export function checkUsageLimits(config?: UsageConfig): UsageCheckResult {
  const limits = config || getUsageConfig();
  let usage = getUsage();

  // No usage yet - allowed
  if (!usage) {
    return {
      allowed: true,
      currentUsage: {
        costUsd: 0,
        sessionAgeHours: 0,
      },
      limits: {
        maxCostUsd: limits.priceLimitUsd,
        maxSessionHours: limits.sessionHours,
      },
      percentUsed: 0,
    };
  }

  const sessionAgeHours = getSessionAgeHours(usage);

  // Check if session expired - auto-reset and allow
  if (sessionAgeHours >= limits.sessionHours) {
    usage = resetUsage();
    return {
      allowed: true,
      reason: undefined,
      currentUsage: {
        costUsd: 0,
        sessionAgeHours: 0,
      },
      limits: {
        maxCostUsd: limits.priceLimitUsd,
        maxSessionHours: limits.sessionHours,
      },
      percentUsed: 0,
    };
  }

  // Check cost limit
  const percentUsed = (usage.totalCostUsd / limits.priceLimitUsd) * 100;
  const costLimitExceeded = usage.totalCostUsd >= limits.priceLimitUsd;

  if (costLimitExceeded) {
    return {
      allowed: false,
      reason: 'cost_limit_exceeded',
      currentUsage: {
        costUsd: usage.totalCostUsd,
        sessionAgeHours,
      },
      limits: {
        maxCostUsd: limits.priceLimitUsd,
        maxSessionHours: limits.sessionHours,
      },
      percentUsed: Math.min(percentUsed, 100),
    };
  }

  // Within limits
  return {
    allowed: true,
    currentUsage: {
      costUsd: usage.totalCostUsd,
      sessionAgeHours,
    },
    limits: {
      maxCostUsd: limits.priceLimitUsd,
      maxSessionHours: limits.sessionHours,
    },
    percentUsed,
  };
}

/**
 * Get warning level based on usage percentage
 * Returns null if no warning needed
 */
export function getUsageWarningLevel(percentUsed: number): 'low' | 'medium' | 'high' | null {
  if (percentUsed >= 90) return 'high';
  if (percentUsed >= 75) return 'medium';
  if (percentUsed >= 50) return 'low';
  return null;
}

/**
 * Calculate time remaining in session (in hours)
 */
export function getTimeRemaining(usage: DemoUsage | null, config?: UsageConfig): number {
  if (!usage) return (config || getUsageConfig()).sessionHours;

  const limits = config || getUsageConfig();
  const sessionAgeHours = getSessionAgeHours(usage);
  return Math.max(0, limits.sessionHours - sessionAgeHours);
}

/**
 * Calculate cost remaining in session
 */
export function getCostRemaining(usage: DemoUsage | null, config?: UsageConfig): number {
  if (!usage) return (config || getUsageConfig()).priceLimitUsd;

  const limits = config || getUsageConfig();
  return Math.max(0, limits.priceLimitUsd - usage.totalCostUsd);
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(hours: number): string {
  if (hours <= 0) return 'Expired';
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const roundedHours = Math.round(hours * 10) / 10;
  return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`;
}
