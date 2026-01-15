/**
 * Usage storage utilities
 * Handles localStorage persistence for demo usage tracking
 */

import type { DemoUsage, ApiCallRecord, CostInput } from './types';
import { calculateTotalCost, calculateLlmInputCost, calculateLlmOutputCost, calculateOcrCost } from './cost-calculator';

const STORAGE_KEY = 'demo_usage';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new empty usage record
 */
function createEmptyUsage(): DemoUsage {
  return {
    sessionId: generateSessionId(),
    sessionStartedAt: new Date().toISOString(),
    totalCostUsd: 0,
    breakdown: {
      llmInputTokens: 0,
      llmOutputTokens: 0,
      llmCostUsd: 0,
      ocrPages: 0,
      ocrCostUsd: 0,
    },
    apiCalls: [],
  };
}

/**
 * Get current usage from localStorage
 * Returns null if no usage exists or on server
 */
export function getUsage(): DemoUsage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as DemoUsage;
  } catch {
    return null;
  }
}

/**
 * Save usage to localStorage
 */
export function saveUsage(usage: DemoUsage): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.error('Failed to save usage:', error);
  }
}

/**
 * Get or create usage record
 */
export function getOrCreateUsage(): DemoUsage {
  const existing = getUsage();
  if (existing) {
    return existing;
  }

  const newUsage = createEmptyUsage();
  saveUsage(newUsage);
  return newUsage;
}

/**
 * Reset usage (start new session)
 */
export function resetUsage(): DemoUsage {
  const newUsage = createEmptyUsage();
  saveUsage(newUsage);
  return newUsage;
}

/**
 * Record API usage
 */
export function recordApiUsage(
  endpoint: string,
  costInput: CostInput
): DemoUsage {
  const usage = getOrCreateUsage();
  const cost = calculateTotalCost(costInput);

  // Update breakdown
  if (costInput.inputTokens) {
    usage.breakdown.llmInputTokens += costInput.inputTokens;
    usage.breakdown.llmCostUsd += calculateLlmInputCost(costInput.inputTokens);
  }
  if (costInput.outputTokens) {
    usage.breakdown.llmOutputTokens += costInput.outputTokens;
    usage.breakdown.llmCostUsd += calculateLlmOutputCost(costInput.outputTokens);
  }
  if (costInput.ocrPages) {
    usage.breakdown.ocrPages += costInput.ocrPages;
    usage.breakdown.ocrCostUsd += calculateOcrCost(costInput.ocrPages);
  }

  // Update total
  usage.totalCostUsd += cost;

  // Record API call
  const record: ApiCallRecord = {
    endpoint,
    timestamp: new Date().toISOString(),
    costUsd: cost,
    metadata: {
      inputTokens: costInput.inputTokens,
      outputTokens: costInput.outputTokens,
      pages: costInput.ocrPages,
    },
  };
  usage.apiCalls.push(record);

  // Keep only last 100 API calls to prevent storage bloat
  if (usage.apiCalls.length > 100) {
    usage.apiCalls = usage.apiCalls.slice(-100);
  }

  saveUsage(usage);
  return usage;
}

/**
 * Get session age in hours
 */
export function getSessionAgeHours(usage: DemoUsage): number {
  const startTime = new Date(usage.sessionStartedAt).getTime();
  const now = Date.now();
  return (now - startTime) / (1000 * 60 * 60);
}
