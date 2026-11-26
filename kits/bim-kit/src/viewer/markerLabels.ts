/**
 * The name and value printed beside each sensor marker.
 *
 * Labels are plain elements laid over the canvas and not textures in the
 * scene, so the browser draws the text at the screen's own resolution and a
 * page can read it, select it and test it. They never take a click, which
 * stays with the model under them.
 *
 * The colours are CSS custom properties that the canvas sets from the host's
 * theme, so a label is a light box with dark text in a light theme and a dark
 * box with light text in a dark one. Either way it is a filled box with its
 * own border, so it reads against the grey of the model behind it.
 */

/** How far above its marker a label sits, in pixels, so it does not cover the dot. */
export const LABEL_OFFSET_PX = 14;

/**
 * The colours of every label over the canvas, the measure's as well, each a
 * theme variable with the light value to fall back on, kept here once so the
 * two kinds of label cannot drift apart.
 */
export const LABEL_BG = 'var(--bim-label-bg,#ffffff)';
export const LABEL_FG = 'var(--bim-label-fg,#1f2933)';
export const LABEL_BORDER = 'var(--bim-label-border,#5f6b76)';
export const LABEL_ACCENT = 'var(--bim-label-accent,#1565c0)';

const BASE_STYLE = [
  'position:absolute',
  'left:0',
  'top:0',
  'pointer-events:none',
  'white-space:nowrap',
  'font:12px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  'padding:1px 6px',
  'border-radius:4px',
  `background:${LABEL_BG}`,
  `color:${LABEL_FG}`,
  `border:1px solid ${LABEL_BORDER}`,
].join(';');

/** A point on screen, in pixels from the top left of the canvas. */
export interface ScreenPoint {
  x: number;
  y: number;
  /** False when the point is behind the camera or beyond the far plane. */
  visible: boolean;
}

/**
 * Where a projected point lands on a canvas of `width` by `height` pixels.
 *
 * `ndc` is the point after `Vector3.project`, so each axis runs from -1 to 1
 * inside the view. A depth outside that range is behind the camera or past
 * the far plane and a label there would float over the wrong thing.
 */
export function toScreen(
  ndc: { x: number; y: number; z: number },
  width: number,
  height: number,
): ScreenPoint {
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
    visible: ndc.z >= -1 && ndc.z <= 1,
  };
}

/** A new, empty label element, ready to be placed in the overlay. */
export function createLabel(document: Document, title: string): HTMLElement {
  const label = document.createElement('div');
  label.setAttribute('style', BASE_STYLE);
  label.dataset.bimLabel = '';
  // The full label of the binding, for a person who hovers the short tag.
  label.title = title;
  return label;
}

/** How a label looks: selected is outlined in the accent colour and drawn on top. */
export function styleLabel(label: HTMLElement, selected: boolean, live: boolean): void {
  const { style } = label;
  style.borderWidth = selected ? '2px' : '1px';
  style.borderColor = selected ? LABEL_ACCENT : LABEL_BORDER;
  style.fontWeight = selected ? '600' : '400';
  style.zIndex = selected ? '2' : '1';
  // Faded the way the card of a reading that is not current is faded.
  style.opacity = live ? '1' : '0.7';
  label.dataset.selected = String(selected);
}

/**
 * Put a label above a point on screen, or hide it. `lift` raises it further,
 * in pixels, when another label already sits where it would go.
 */
export function placeLabel(label: HTMLElement, at: ScreenPoint, shown: boolean, lift = 0): void {
  const { style } = label;
  style.display = shown && at.visible ? 'block' : 'none';
  style.transform =
    `translate(${Math.round(at.x)}px, ${Math.round(at.y - lift)}px) ` +
    `translate(-50%, calc(-100% - ${LABEL_OFFSET_PX}px))`;
}

/** The space kept between two labels moved apart, in pixels. */
export const LABEL_GAP_PX = 2;

/** A label on screen: the point it belongs to and its size, in pixels. */
export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rectangle of a label drawn as `placeLabel` draws it, raised by `lift`. */
function rectOf(box: LabelBox, lift: number) {
  const bottom = box.y - LABEL_OFFSET_PX - lift;
  return {
    left: box.x - box.width / 2,
    right: box.x + box.width / 2,
    top: bottom - box.height,
    bottom,
  };
}

/**
 * How far to raise each label so that no two cover each other, in the order
 * given. Labels are settled from the bottom of the screen up: each keeps its
 * place unless it covers one already settled, and then it moves just above
 * that one. Sensors close together on screen get a short stack of labels
 * instead of one label hiding the others.
 */
export function spreadLabels(boxes: readonly LabelBox[]): number[] {
  const lifts = boxes.map(() => 0);
  const order = boxes.map((_, index) => index).sort((a, b) => boxes[b].y - boxes[a].y);
  const settled: Array<ReturnType<typeof rectOf>> = [];
  for (const index of order) {
    const box = boxes[index];
    // Each move clears one settled label, so there are at most as many moves as labels.
    for (let tries = 0; tries <= settled.length; tries += 1) {
      const rect = rectOf(box, lifts[index]);
      const covered = settled.find(
        (other) =>
          rect.left < other.right &&
          other.left < rect.right &&
          rect.top < other.bottom &&
          other.top < rect.bottom,
      );
      if (!covered) break;
      lifts[index] = box.y - LABEL_OFFSET_PX - (covered.top - LABEL_GAP_PX);
    }
    settled.push(rectOf(box, lifts[index]));
  }
  return lifts;
}
