/**
 * Canonical event schema — single durable model for all signals.
 * Design supports future correlation (e.g. risky sign-in → admin grant → mailbox rule).
 */

export type EventCategory = 'SIGNIN' | 'RISK' | 'DIRECTORY' | 'SHARING' | 'MAIL';
export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EntityType = 'USER' | 'ROLE' | 'IP' | 'DEVICE' | 'APP' | 'RESOURCE' | 'DOMAIN';

export interface CanonicalEvent {
  id: string;
  event_time: string; // ISO timestamp
  ingested_at: string;
  category: EventCategory;
  type: string;
  severity: EventSeverity;
  actor: Record<string, unknown>;
  target: Record<string, unknown>;
  source: Record<string, unknown>;
  tags: string[];
  correlation_key: string | null;
  raw_ref: Record<string, unknown>;
  summary: string;
}

export interface EventEntity {
  event_id: string;
  entity_type: EntityType;
  entity_id: string;
  entity_label: string;
  attributes: Record<string, unknown>;
}

/** High-privilege roles that trigger CRITICAL when granted */
export const HIGH_PRIVILEGE_ROLES = new Set([
  'Global Administrator',
  'Privileged Role Administrator',
  'Exchange Administrator',
  'Global Admin',
  'Privileged Role Admin',
  'Exchange Admin',
]);

/** MFA failure threshold: above this for same user + unfamiliar geo → CRITICAL */
export const MFA_FAILURE_CRITICAL_THRESHOLD = 5;

/** Risk levels from Graph Identity Protection */
export type GraphRiskLevel = 'low' | 'medium' | 'high' | 'hidden' | 'none' | 'unknownFutureValue';
