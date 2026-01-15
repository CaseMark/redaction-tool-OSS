/**
 * Demo usage configuration
 * Loads from environment variables with sensible defaults
 */

import type { UsageConfig } from './types';

// Pricing constants (per Anthropic/OCR pricing)
export const PRICING = {
  // Claude pricing (per million tokens)
  LLM_INPUT_PER_MILLION: 3, // $3 per 1M input tokens
  LLM_OUTPUT_PER_MILLION: 15, // $15 per 1M output tokens
  // OCR pricing
  OCR_PER_PAGE: 0.02, // $0.02 per page
} as const;

// Default limits
const DEFAULT_SESSION_HOURS = 24;
const DEFAULT_PRICE_LIMIT_USD = 5;

/**
 * Get usage configuration from environment variables
 */
export function getUsageConfig(): UsageConfig {
  const sessionHours = parseFloat(process.env.DEMO_SESSION_HOURS || '') || DEFAULT_SESSION_HOURS;
  const priceLimitUsd = parseFloat(process.env.DEMO_SESSION_PRICE_LIMIT || '') || DEFAULT_PRICE_LIMIT_USD;

  return {
    sessionHours,
    priceLimitUsd,
  };
}

/**
 * Get client-safe config (doesn't expose sensitive values)
 */
export function getClientUsageConfig(): UsageConfig {
  // These are safe to expose to the client
  return getUsageConfig();
}
