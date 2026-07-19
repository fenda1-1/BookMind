export function isPdfRenderingCancelled(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const name = typeof (error as { name?: unknown }).name === 'string' ? (error as { name: string }).name : '';
  const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
  return name === 'RenderingCancelledException' || name === 'AbortException' || /Rendering cancelled|task cancelled/i.test(message);
}
