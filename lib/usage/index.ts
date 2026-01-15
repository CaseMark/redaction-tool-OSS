/**
 * Demo usage tracking module
 *
 * Tracks API usage costs and session duration for demo limiting.
 * Uses localStorage for persistence.
 */

// Types
export type {
  DemoUsage,
  ApiCallRecord,
  UsageCheckResult,
  UsageConfig,
  CostInput,
} from './types';

// Config
export { getUsageConfig, getClientUsageConfig, PRICING } from './config';

// Cost calculations
export {
  calculateLlmInputCost,
  calculateLlmOutputCost,
  calculateOcrCost,
  calculateTotalCost,
  formatCost,
  formatCostPrecise,
} from './cost-calculator';

// Storage
export {
  getUsage,
  saveUsage,
  getOrCreateUsage,
  resetUsage,
  recordApiUsage,
  getSessionAgeHours,
} from './usage-storage';

// Limit checking
export {
  checkUsageLimits,
  getUsageWarningLevel,
  getTimeRemaining,
  getCostRemaining,
  formatTimeRemaining,
} from './limit-checker';
