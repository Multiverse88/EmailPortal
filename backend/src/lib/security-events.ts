import { EventEmitter } from 'events';
import type { Response } from 'express';

export type SecurityEventType = 'login-attempt' | 'anomaly' | 'threat' | 'session-terminated' | 'connected';
export type SecuritySeverity = 'info' | 'warning' | 'critical';

export interface SecurityEventData {
  type: SecurityEventType;
  severity: SecuritySeverity;
  title: string;
  detail?: string;
  accountEmail?: string;
  ipAddress?: string;
  customerId?: string;
  riskScore?: number;
  at: string;
}

export type SecurityEventInput = Omit<SecurityEventData, 'at'>;

const bus = new EventEmitter();
bus.setMaxListeners(50);

const sseClients = new Set<Response>();

function formatSSE(event: SecurityEventData): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Broadcast a security event to all connected admin SSE streams. */
export function emitSecurityEvent(input: SecurityEventInput): void {
  const event: SecurityEventData = { ...input, at: new Date().toISOString() };
  bus.emit('security-event', event);
  const payload = formatSSE(event);
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function onSecurityEvent(listener: (event: SecurityEventData) => void): () => void {
  bus.on('security-event', listener);
  return () => bus.off('security-event', listener);
}

export function addSSEClient(res: Response): void {
  sseClients.add(res);
}

export function removeSSEClient(res: Response): void {
  sseClients.delete(res);
}

export function connectedClientCount(): number {
  return sseClients.size;
}
