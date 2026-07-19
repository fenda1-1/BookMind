type CharacterBookStripWheelEvent = {
  currentTarget: {
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
  };
  deltaX: number;
  deltaY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function handleCharacterBookStripWheel(event: CharacterBookStripWheelEvent) {
  const strip = event.currentTarget;
  return handleCharacterBookStripElementWheel(strip, event);
}

export function handleCharacterBookStripElementWheel(
  strip: CharacterBookStripWheelEvent['currentTarget'],
  event: Omit<CharacterBookStripWheelEvent, 'currentTarget'>,
) {
  const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
  if (maxScrollLeft <= 0) return false;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return false;
  const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, strip.scrollLeft + delta));
  strip.scrollLeft = nextScrollLeft;
  event.preventDefault();
  event.stopPropagation();
  return true;
}
