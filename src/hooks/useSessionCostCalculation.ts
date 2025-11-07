/**
 * Session cost calculation hook
 *
 * Optimization: Supports multi-model pricing, complies with official Claude Code specification
 * Reference: https://docs.claude.com/en/docs/claude-code/costs
 */

import { useMemo } from 'react';
import { aggregateSessionCost } from '@/lib/sessionCost';
import { formatCost as formatCostUtil, formatDuration } from '@/lib/pricing';
import type { ClaudeStreamMessage } from '@/types/claude';

export interface SessionCostStats {
  /** Total cost (USD) */
  totalCost: number;
  /** Total tokens */
  totalTokens: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cache read tokens */
  cacheReadTokens: number;
  /** Cache write tokens */
  cacheWriteTokens: number;
  /** Session duration (seconds) - wall time */
  durationSeconds: number;
  /** API execution duration (seconds) - total time for all API calls */
  apiDurationSeconds: number;
}

interface SessionCostResult {
  /** Cost statistics */
  stats: SessionCostStats;
  /** Format cost string */
  formatCost: (amount: number) => string;
  /** Format duration string */
  formatDuration: (seconds: number) => string;
}

/**
 * Calculate the token cost and statistics of a session
 *
 * @param messages - List of session messages
 * @returns Cost statistics object
 *
 * @example
 * const { stats, formatCost } = useSessionCostCalculation(messages);
 * console.log(formatCost(stats.totalCost)); // "$0.0123"
 */
export function useSessionCostCalculation(messages: ClaudeStreamMessage[]): SessionCostResult {
  // Calculate total cost and statistics
  const stats = useMemo(() => {
    if (messages.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationSeconds: 0,
        apiDurationSeconds: 0
      };
    }

    const {
      totals,
      events,
      firstEventTimestampMs,
      lastEventTimestampMs,
    } = aggregateSessionCost(messages);

    const durationSeconds = calculateSessionDuration(messages, firstEventTimestampMs, lastEventTimestampMs);

    // Calculate API execution duration (TODO: Needs to extract actual API response time from messages)
    // Currently uses a simplified estimate: 2-10 seconds per unique assistant message on average
    const apiDurationSeconds = events.length * 5; // Rough estimate

    return {
      totalCost: totals.totalCost,
      totalTokens: totals.totalTokens,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      durationSeconds,
      apiDurationSeconds
    };
  }, [messages]);

  return { 
    stats, 
    formatCost: formatCostUtil,
    formatDuration
  };
}

function calculateSessionDuration(
  messages: ClaudeStreamMessage[],
  fallbackFirstEventMs?: number,
  fallbackLastEventMs?: number
): number {
  const timestamps = messages
    .map(extractTimestampMs)
    .filter((value): value is number => typeof value === 'number');

  if (timestamps.length >= 2) {
    const first = Math.min(...timestamps);
    const last = Math.max(...timestamps);
    if (last >= first) {
      return (last - first) / 1000;
    }
  }

  if (
    typeof fallbackFirstEventMs === 'number' &&
    typeof fallbackLastEventMs === 'number' &&
    fallbackLastEventMs >= fallbackFirstEventMs
  ) {
    return (fallbackLastEventMs - fallbackFirstEventMs) / 1000;
  }

  return 0;
}

function extractTimestampMs(message: ClaudeStreamMessage): number | undefined {
  const candidates = [
    (message as any).timestamp,
    (message as any).receivedAt,
    (message as any).sentAt,
    (message as any)?.message?.timestamp,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}
