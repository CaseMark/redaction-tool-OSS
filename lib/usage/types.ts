/**
 * Demo usage tracking types
 */

export interface DemoUsage {
  sessionId: string;
  sessionStartedAt: string; // ISO timestamp
  totalCostUsd: number;
  breakdown: {
    llmInputTokens: number;
    llmOutputTokens: number;
    llmCostUsd: number;
    ocrPages: number;
    ocrCostUsd: number;
  };
  apiCalls: ApiCallRecord[];
}

export interface ApiCallRecord {
  endpoint: string;
  timestamp: string;
  costUsd: number;
  metadata?: {
    inputTokens?: number;
    outputTokens?: number;
    pages?: number;
  };
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: 'session_expired' | 'cost_limit_exceeded';
  currentUsage: {
    costUsd: number;
    sessionAgeHours: number;
  };
  limits: {
    maxCostUsd: number;
    maxSessionHours: number;
  };
  percentUsed: number;
}

export interface UsageConfig {
  sessionHours: number;
  priceLimitUsd: number;
}

export interface CostInput {
  inputTokens?: number;
  outputTokens?: number;
  ocrPages?: number;
}
