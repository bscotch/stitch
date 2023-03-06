export type ElementSide = 'top' | 'bottom' | 'left' | 'right';

export function computeRelativeDistance(
  from: Element,
  to: Element,
  fromSide: ElementSide = 'top',
  toSide: ElementSide = fromSide,
): number {
  if (!from || !to) {
    throw new Error(`elementOffset: from and to must be HTMLElements`);
  }
  const fromRect = from?.getBoundingClientRect?.();
  const toRect = to?.getBoundingClientRect?.();
  if (!fromRect || !toRect) {
    throw new Error(`elementOffset: at least one element had no rect`);
  }
  return toRect[toSide] - fromRect[fromSide];
}
