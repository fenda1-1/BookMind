export function emitBrowserDomainEvent<Detail>(name: string, detail: Detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Detail>(name, { detail }));
}

export function subscribeBrowserDomainEvent<Detail>(name: string, handler: (detail: Detail) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<Detail>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
