/**
 * Cost calculation utilities for demo usage tracking
 */

import { PRICING } from './config';
import type { CostInput } from './types';

/**
 * Calculate cost for LLM input tokens
 */
export function calculateLlmInputCost(tokens: number): number {
  return (tokens / 1_000_000) * PRICING.LLM_INPUT_PER_MILLION;
}

/**
 * Calculate cost for LLM output tokens
 */
export function calculateLlmOutputCost(tokens: number): number {
  return (tokens / 1_000_000) * PRICING.LLM_OUTPUT_PER_MILLION;
}

/**
 * Calculate cost for OCR pages
 */
export function calculateOcrCost(pages: number): number {
  return pages * PRICING.OCR_PER_PAGE;
}

/**
 * Calculate total cost from various inputs
 */
export function calculateTotalCost(input: CostInput): number {
  let total = 0;

  if (input.inputTokens) {
    total += calculateLlmInputCost(input.inputTokens);
  }

  if (input.outputTokens) {
    total += calculateLlmOutputCost(input.outputTokens);
  }

  if (input.ocrPages) {
    total += calculateOcrCost(input.ocrPages);
  }

  return total;
}

/**
 * Format cost as USD string
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return '<$0.01';
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Format cost with more precision for display
 */
export function formatCostPrecise(costUsd: number): string {
  if (costUsd < 0.001) {
    return '<$0.001';
  }
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(3)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}
