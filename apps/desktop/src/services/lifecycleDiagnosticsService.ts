export type LifecycleDiagnosticDomain = 'reader-session' | 'source-execution' | 'cache' | 'cancellation' | 'task-refresh' | 'performance';

export type LifecycleDiagnosticEvent = {
  id: number;
  at: string;
  domain: LifecycleDiagnosticDomain;
  action: string;
  detail: Record<string, string | number | boolean | null>;
};

type LifecycleDiagnosticListener = (event: LifecycleDiagnosticEvent) => void;

const maxLifecycleDiagnosticEvents = 240;
const events: LifecycleDiagnosticEvent[] = [];
const listeners = new Set<LifecycleDiagnosticListener>();
let nextEventId = 1;

export function recordLifecycleDiagnostic(
  domain: LifecycleDiagnosticDomain,
  action: string,
  detail: Record<string, string | number | boolean | null> = {},
) {
  const event: LifecycleDiagnosticEvent = {
    id: nextEventId++,
    at: new Date().toISOString(),
    domain,
    action,
    detail,
  };
  events.unshift(event);
  if (events.length > maxLifecycleDiagnosticEvents) events.length = maxLifecycleDiagnosticEvents;
  for (const listener of listeners) listener(event);
  return event;
}

export function getLifecycleDiagnostics(limit = maxLifecycleDiagnosticEvents) {
  return events.slice(0, Math.max(0, Math.min(maxLifecycleDiagnosticEvents, Math.floor(limit))));
}

export function clearLifecycleDiagnostics() {
  events.length = 0;
}

export function subscribeLifecycleDiagnostics(listener: LifecycleDiagnosticListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
