/**
 * Single severity classifier for canonical events.
 * Rules (V1):
 * - CRITICAL: high risk detection OR multiple risks same user/24h; admin grant for Global/PrivRole/Exchange; MFA failures above threshold + unfamiliar geo
 * - HIGH: repeated MFA failures same IP across users; medium risk
 * - MEDIUM/LOW: single MFA failure, typical behavior
 */

import type { CanonicalEvent, EventSeverity } from './types';
import { HIGH_PRIVILEGE_ROLES, MFA_FAILURE_CRITICAL_THRESHOLD } from './types';

export interface SeverityContext {
  /** MFA failure count for same user in last 24h */
  mfaFailureCountForUser?: number;
  /** MFA failure count from same IP across users (last 24h) */
  mfaFailureCountForIp?: number;
  /** Whether sign-in geo/IP is unfamiliar for user */
  unfamiliarGeo?: boolean;
  /** Risk level from Graph (e.g. risk detection) */
  graphRiskLevel?: 'low' | 'medium' | 'high' | 'hidden' | 'none' | 'unknownFutureValue';
  /** Role name when type is ADMIN_ROLE_GRANTED */
  roleName?: string;
}

/**
 * Classify severity for an event. Caller may pass context from aggregations (e.g. counts in last 24h).
 */
export function classifySeverity(
  event: Pick<CanonicalEvent, 'category' | 'type' | 'actor' | 'target' | 'source'>,
  context?: SeverityContext
): EventSeverity {
  const cat = event.category;
  const type = event.type;

  // --- RISK category ---
  if (cat === 'RISK' && type === 'RISK_DETECTION') {
    const level = context?.graphRiskLevel ?? (event.source?.riskLevel as string) ?? 'medium';
    if (level === 'high') return 'CRITICAL';
    if (level === 'medium') return 'HIGH';
    return 'MEDIUM';
  }
  if (cat === 'RISK' && type === 'MULTIPLE_RISK_DETECTIONS') {
    return 'CRITICAL';
  }

  // --- DIRECTORY: admin role granted ---
  if (cat === 'DIRECTORY' && type === 'ADMIN_ROLE_GRANTED') {
    const role = context?.roleName ?? (event.target?.roleName as string) ?? (event.target?.roleDisplayName as string) ?? '';
    if (HIGH_PRIVILEGE_ROLES.has(role)) return 'CRITICAL';
    return 'HIGH';
  }

  // --- SIGNIN: MFA failure ---
  if (cat === 'SIGNIN' && (type === 'MFA_FAILURE' || type === 'FAILED_SIGNIN')) {
    const userCount = context?.mfaFailureCountForUser ?? 0;
    const ipCount = context?.mfaFailureCountForIp ?? 0;
    const unfamiliar = context?.unfamiliarGeo ?? false;

    if (userCount >= MFA_FAILURE_CRITICAL_THRESHOLD && unfamiliar) return 'CRITICAL';
    if (ipCount > 3) return 'HIGH'; // same IP, multiple users
    if (userCount > 1 || unfamiliar) return 'HIGH';
    return 'MEDIUM';
  }

  // --- SIGNIN: risky sign-in (Graph risk) ---
  if (cat === 'SIGNIN' && type === 'RISKY_SIGNIN') {
    const level = context?.graphRiskLevel ?? (event.source?.riskLevel as string);
    if (level === 'high') return 'CRITICAL';
    if (level === 'medium') return 'HIGH';
    return 'MEDIUM';
  }

  // --- SHARING ---
  if (cat === 'SHARING') {
    if (type === 'EXTERNAL_SHARE_SPIKE') return 'HIGH';
    return 'MEDIUM';
  }

  // Default
  if (cat === 'SIGNIN') return 'LOW';
  return 'MEDIUM';
}
