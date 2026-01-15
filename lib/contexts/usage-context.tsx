'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type DemoUsage,
  type UsageCheckResult,
  type CostInput,
  getOrCreateUsage,
  recordApiUsage,
  checkUsageLimits,
  getUsageWarningLevel,
  getTimeRemaining,
  getCostRemaining,
  formatCost,
  formatTimeRemaining,
} from '@/lib/usage';

interface UsageContextValue {
  usage: DemoUsage | null;
  checkResult: UsageCheckResult | null;
  warningLevel: 'low' | 'medium' | 'high' | null;
  isLimitExceeded: boolean;
  timeRemaining: string;
  costRemaining: string;
  percentUsed: number;
  recordUsage: (endpoint: string, costInput: CostInput) => void;
  refreshUsage: () => void;
}

const UsageContext = createContext<UsageContextValue | null>(null);

// Config values (can be overridden via props or env)
const DEFAULT_CONFIG = {
  sessionHours: 24,
  priceLimitUsd: 5,
};

interface UsageProviderProps {
  children: ReactNode;
  config?: {
    sessionHours?: number;
    priceLimitUsd?: number;
  };
}

export function UsageProvider({ children, config }: UsageProviderProps) {
  const [usage, setUsage] = useState<DemoUsage | null>(null);
  const [checkResult, setCheckResult] = useState<UsageCheckResult | null>(null);

  const mergedConfig = {
    sessionHours: config?.sessionHours || DEFAULT_CONFIG.sessionHours,
    priceLimitUsd: config?.priceLimitUsd || DEFAULT_CONFIG.priceLimitUsd,
  };

  // Initialize usage on mount
  useEffect(() => {
    const currentUsage = getOrCreateUsage();
    setUsage(currentUsage);
    setCheckResult(checkUsageLimits(mergedConfig));
  }, [mergedConfig.sessionHours, mergedConfig.priceLimitUsd]);

  // Refresh usage state
  const refreshUsage = useCallback(() => {
    const currentUsage = getOrCreateUsage();
    setUsage(currentUsage);
    setCheckResult(checkUsageLimits(mergedConfig));
  }, [mergedConfig]);

  // Record API usage
  const recordUsage = useCallback(
    (endpoint: string, costInput: CostInput) => {
      const updatedUsage = recordApiUsage(endpoint, costInput);
      setUsage(updatedUsage);
      setCheckResult(checkUsageLimits(mergedConfig));
    },
    [mergedConfig]
  );

  // Derived values
  const warningLevel = checkResult ? getUsageWarningLevel(checkResult.percentUsed) : null;
  const isLimitExceeded = checkResult ? !checkResult.allowed : false;
  const timeRemaining = formatTimeRemaining(getTimeRemaining(usage, mergedConfig));
  const costRemaining = formatCost(getCostRemaining(usage, mergedConfig));
  const percentUsed = checkResult?.percentUsed || 0;

  return (
    <UsageContext.Provider
      value={{
        usage,
        checkResult,
        warningLevel,
        isLimitExceeded,
        timeRemaining,
        costRemaining,
        percentUsed,
        recordUsage,
        refreshUsage,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
}

// Hook for checking if we can make an API call
export function useUsageCheck() {
  const { checkResult, isLimitExceeded } = useUsage();

  return {
    canMakeApiCall: !isLimitExceeded,
    reason: checkResult?.reason,
    percentUsed: checkResult?.percentUsed || 0,
  };
}
