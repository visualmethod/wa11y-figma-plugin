/// <reference types="@figma/plugin-typings" />

import type { UIMessage, AnnotationSet, LayerNode, ColorValue } from './shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

// Update this after registering the Wa11y widget in Figma.
// Go to Resources > Widgets and copy the widget's manifest key.
const WIDGET_MANIFEST_KEY = 'REPLACE_WITH_WIDGET_MANIFEST_KEY';

const PLUGIN_WIDTH = 360;
const PLUGIN_HEIGHT = 560;

// ─── Bootstrap ───────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: PLUGIN_WIDTH, height: PLUGIN_HEIGHT, themeColors: true });

// Notify UI of current selection on open
sendSelectionState();

figma.on('selectionchange', sendSelectionState);

// ─── Message handler ─────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'get-selection':
      sendSelectionState();
      break;

    case 'load-settings': {
      const saved = await figma.clientStorage.getAsync('wa11y_settings') as
        | { apiKey: string; model: string }
        | undefined;
      figma.ui.postMessage({
        type: 'settings-loaded',
        apiKey: saved?.apiKey ?? '',
        model: saved?.model ?? 'claude-sonnet-4-5',
      });
      break;
    }

    case 'save-settings':
      await figma.clientStorage.setAsync('wa11y_settings', {
        apiKey: msg.apiKey,
        model: msg.model,
      });
      break;

    case 'export-frame':
      await handleExportFrame(msg.frameId);
      break;

    case 'add-widget':
      await handleAddWidget();
      break;

    case 'place-annotations':
      await handlePlaceAnnotations(msg.annotations);
      break;

    case 'query-annotation-frames':
      handleQueryAnnotationFrames(msg.frameName);
      break;

    case 'toggle-category':
      await handleToggleCategory(msg.frameId, msg.visible);
      break;

    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendSelectionState() {
  const sel = figma.currentPage.selection;
  const frame = sel.length === 1 && (sel[0].type === 'FRAME' || sel[0].type === 'COMPONENT')
    ? sel[0]
    : null;

  figma.ui.postMessage({
    type: 'selection-change',
    frameId: frame?.id ?? null,
    frameName: frame?.name ?? null,
  });
}

async function handleExportFrame(frameId: string) {
  try {
    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || (node.type !== 'FRAME' && node.type !== 'COMPONENT')) {
      figma.ui.postMessage({ type: 'export-error', message: 'Frame not found. Re-select it and try again.' });
      return;
    }

    const imageBytes = await (node as FrameNode).exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });

    const base64 = figma.base64Encode(imageBytes);
    const layerTree = await extractLayerTree(node as FrameNode);

    figma.ui.postMessage({
      type: 'export-result',
      imageData: base64,
      layerTree: [layerTree],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown export error';
    figma.ui.postMessage({ type: 'export-error', message });
  }
}

async function handleAddWidget() {
  figma.notify(
    'To add the checklist: open Resources (Shift+I) → Widgets → search "Wa11y Checklist" and drag it onto the canvas.',
    { timeout: 8000 },
  );
  figma.ui.postMessage({ type: 'widget-added' });
}

async function handlePlaceAnnotations(annotations: AnnotationSet) {
  try {
    const node = await figma.getNodeByIdAsync(annotations.frameId);
    if (!node || (node.type !== 'FRAME' && node.type !== 'COMPONENT')) {
      figma.ui.postMessage({ type: 'export-error', message: 'Frame not found. Please re-select it.' });
      return;
    }
    const { categoryFrameIds, guideFrameId } = await placeAnnotationsOnCanvas(
      node as FrameNode,
      annotations,
    );
    figma.ui.postMessage({
      type: 'annotations-placed',
      count: annotations.items.length,
      categoryFrameIds,
      guideFrameId,
    });
    figma.notify(`✓ ${annotations.items.length} annotations placed`, { timeout: 3000 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown placement error';
    figma.ui.postMessage({ type: 'export-error', message: `Placement failed: ${message}` });
  }
}

function handleQueryAnnotationFrames(frameName: string) {
  const prefix = `[wa11y] ${frameName} — `;
  const frames: Array<{ category: string; frameId: string; visible: boolean }> = [];
  let guideFrameId: string | null = null;
  let guideVisible = true;

  for (const child of figma.currentPage.children) {
    if (!child.name.startsWith(prefix)) continue;
    const suffix = child.name.slice(prefix.length);
    if (suffix === 'Guide') {
      guideFrameId = child.id;
      guideVisible = child.visible;
    } else {
      frames.push({ category: suffix, frameId: child.id, visible: child.visible });
    }
  }

  figma.ui.postMessage({ type: 'annotation-frames-state', frames, guideFrameId, guideVisible });
}

async function handleToggleCategory(frameId: string, visible: boolean) {
  const node = await figma.getNodeByIdAsync(frameId);
  if (!node) return;
  node.visible = visible;

  // If this is a category badge frame, also toggle the matching guide section.
  // Badge frame name:  "[wa11y] {frameName} — {category}"
  // Guide frame name:  "[wa11y] {frameName} — Guide"
  // Guide section name: "section:{category}" (direct child of guide frame)
  const m = node.name.match(/^(\[wa11y\] .+) — (.+)$/);
  if (!m) return;
  const [, prefix, category] = m;
  if (category === 'Guide') return; // guide toggle itself — nothing more to do

  const guideName = `${prefix} — Guide`;
  const guideFrame = figma.currentPage.children.find(
    (n) => n.name === guideName,
  ) as FrameNode | undefined;
  if (!guideFrame) return;

  const section = guideFrame.children.find((n) => n.name === `section:${category}`);
  if (section) section.visible = visible;
}

// ─── Layer tree extraction ────────────────────────────────────────────────────

async function extractLayerTree(node: SceneNode, depth = 0): Promise<LayerNode> {
  const base: LayerNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: 'visible' in node ? node.visible : true,
  };

  // Extract text content
  if (node.type === 'TEXT') {
    base.textContent = node.characters;
  }

  // Extract fills (colors)
  if ('fills' in node && Array.isArray(node.fills)) {
    base.fills = (node.fills as readonly Paint[])
      .filter((f): f is SolidPaint => f.type === 'SOLID')
      .map((f) => solidPaintToColor(f));
  }

  // Detect images
  if ('fills' in node && Array.isArray(node.fills)) {
    base.isImage = (node.fills as readonly Paint[]).some((f) => f.type === 'IMAGE');
  }

  // Component instance name — must use async API with dynamic-page access
  if (node.type === 'INSTANCE') {
    const mainComp = await node.getMainComponentAsync();
    base.componentName = mainComp?.name ?? undefined;
    base.isInteractive =
      mainComp?.name.toLowerCase().match(/button|link|input|toggle|checkbox|radio|select|tab|menu/) != null;
  }

  // Recurse up to depth 5 to avoid huge payloads on complex frames
  if (depth < 5 && 'children' in node) {
    base.children = await Promise.all(
      (node as FrameNode).children.map((c) => extractLayerTree(c, depth + 1))
    );
  }

  return base;
}

function solidPaintToColor(paint: SolidPaint): ColorValue {
  const r = Math.round(paint.color.r * 255);
  const g = Math.round(paint.color.g * 255);
  const b = Math.round(paint.color.b * 255);
  return {
    r, g, b,
    a: paint.opacity ?? 1,
    hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
  };
}

// ─── Annotation placement ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'alt-text':    '#385ef9',  // blue
  'landmarks':   '#86418a',  // purple
  'headings':    '#956a0d',  // amber
  'aria':        '#038673',  // teal (brand)
  'input-roles': '#ce3528',  // red
  'focus-order': '#228618',  // green
};

const CATEGORY_LABELS: Record<string, string> = {
  'alt-text':    'Alt-Text',
  'landmarks':   'Landmark',
  'headings':    'Heading',
  'aria':        'ARIA',
  'input-roles': 'Input Role',
  'focus-order': 'Focus Order',
};

async function placeAnnotationsOnCanvas(
  frame: FrameNode,
  annotations: AnnotationSet,
): Promise<{ categoryFrameIds: Record<string, string>; guideFrameId: string }> {
  const BADGE_SIZE = 24;
  const GUIDE_WIDTH = 280;
  const GUIDE_PADDING = 16;
  const GAP = 32;

  // ── Cleanup: remove any previously placed wa11y frames for this target ──
  const namePrefix = `[wa11y] ${frame.name} — `;
  for (const child of [...figma.currentPage.children]) {
    if (child.name.startsWith(namePrefix)) child.remove();
  }

  // Load all fonts before touching any text nodes
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  // Absolute canvas coords — frame.x/y are relative to parent, not the page
  const frameBounds = frame.absoluteBoundingBox;
  if (!frameBounds) return { categoryFrameIds: {}, guideFrameId: '' };

  // ── Annotation guide (placed to the LEFT of the frame) ──────────────────
  const guide = figma.createFrame();
  guide.name = `[wa11y] ${frame.name} — Guide`;
  guide.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  guide.strokeWeight = 1;
  guide.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
  guide.cornerRadius = 12;
  guide.layoutMode = 'VERTICAL';
  guide.itemSpacing = 0;
  guide.paddingTop = GUIDE_PADDING;
  guide.paddingBottom = GUIDE_PADDING;
  guide.paddingLeft = GUIDE_PADDING;
  guide.paddingRight = GUIDE_PADDING;
  guide.primaryAxisSizingMode = 'AUTO';
  guide.counterAxisSizingMode = 'FIXED';
  guide.resize(GUIDE_WIDTH, 100); // height will grow via AUTO
  guide.x = frameBounds.x - GUIDE_WIDTH - GAP;
  guide.y = frameBounds.y;
  figma.currentPage.appendChild(guide);

  // ── Per-category badge overlay frames (one per category, created lazily) ─
  // Built after byCategory is populated so we only create frames we need.
  const categoryFrameMap = new Map<string, FrameNode>();
  const makeCategoryFrame = (category: string): FrameNode => {
    if (categoryFrameMap.has(category)) return categoryFrameMap.get(category)!;
    const cf = figma.createFrame();
    cf.name = `[wa11y] ${frame.name} — ${category}`;
    cf.fills = [];
    cf.clipsContent = false;
    cf.resize(frame.width, frame.height);
    cf.x = frameBounds.x;
    cf.y = frameBounds.y;
    figma.currentPage.appendChild(cf);
    categoryFrameMap.set(category, cf);
    return cf;
  };

  // ── Group items by category ──────────────────────────────────────────────
  const byCategory = new Map<string, AnnotationItem[]>();
  for (const item of annotations.items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  // ── Build guide sections ─────────────────────────────────────────────────
  // Each category is wrapped in a named section frame so toggling a category
  // can collapse its guide section alongside hiding its badge overlay.
  let firstSection = true;
  for (const [category, items] of byCategory) {
    // Section wrapper: STRETCH width, AUTO height, participates in guide auto-layout
    const section = figma.createFrame();
    section.name = `section:${category}`;
    section.fills = [];
    section.layoutMode = 'VERTICAL';
    section.itemSpacing = 0;
    section.layoutAlign = 'STRETCH';
    section.primaryAxisSizingMode = 'AUTO';
    section.counterAxisSizingMode = 'FIXED';
    section.resize(GUIDE_WIDTH - GUIDE_PADDING * 2, 10);
    guide.appendChild(section);

    // Divider lives inside the section so it hides with it
    if (!firstSection) {
      const div = figma.createRectangle();
      div.name = 'divider';
      div.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      div.layoutAlign = 'STRETCH';
      div.resize(GUIDE_WIDTH - GUIDE_PADDING * 2, 1);
      section.appendChild(div);
    }
    firstSection = false;

    // Section header row
    const headerRow = figma.createFrame();
    headerRow.name = `cat:${category}`;
    headerRow.fills = [];
    headerRow.layoutMode = 'HORIZONTAL';
    headerRow.itemSpacing = 6;
    headerRow.paddingTop = 10;
    headerRow.paddingBottom = 6;
    headerRow.primaryAxisSizingMode = 'FIXED';
    headerRow.counterAxisSizingMode = 'AUTO';
    headerRow.counterAxisAlignItems = 'CENTER';
    headerRow.layoutAlign = 'STRETCH';
    headerRow.resize(GUIDE_WIDTH - GUIDE_PADDING * 2, 28);
    section.appendChild(headerRow);

    const dot = figma.createEllipse();
    dot.resize(8, 8);
    dot.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[category] ?? '#888') }];
    dot.layoutAlign = 'INHERIT';
    headerRow.appendChild(dot);

    const headerText = figma.createText();
    headerText.fontName = { family: 'Inter', style: 'Bold' };
    headerText.fontSize = 11;
    headerText.characters = (CATEGORY_LABELS[category] ?? category).toUpperCase();
    headerText.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[category] ?? '#333') }];
    headerText.textAutoResize = 'WIDTH_AND_HEIGHT';
    headerRow.appendChild(headerText);

    // Items
    for (const item of items) {
      const row = figma.createFrame();
      row.name = `#${item.number}`;
      row.fills = [];
      row.layoutMode = 'HORIZONTAL';
      row.itemSpacing = 8;
      row.paddingTop = 4;
      row.paddingBottom = 8;
      row.counterAxisAlignItems = 'MIN';
      row.layoutAlign = 'STRETCH';
      row.primaryAxisSizingMode = 'FIXED';
      row.counterAxisSizingMode = 'AUTO';
      section.appendChild(row);

      // Numbered badge (coloured circle with annotation number inside)
      const numBadge = figma.createFrame();
      numBadge.name = `num`;
      numBadge.resize(20, 20);
      numBadge.cornerRadius = 10;
      numBadge.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[category] ?? '#888') }];
      numBadge.layoutMode = 'VERTICAL';
      numBadge.primaryAxisAlignItems = 'CENTER';
      numBadge.counterAxisAlignItems = 'CENTER';
      numBadge.primaryAxisSizingMode = 'FIXED';
      numBadge.counterAxisSizingMode = 'FIXED';
      numBadge.layoutAlign = 'CENTER';
      row.appendChild(numBadge);

      const numBadgeText = figma.createText();
      numBadgeText.fontName = { family: 'Inter', style: 'Bold' };
      numBadgeText.fontSize = 9;
      numBadgeText.characters = String(item.number);
      numBadgeText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      numBadgeText.textAutoResize = 'WIDTH_AND_HEIGHT';
      numBadge.appendChild(numBadgeText);

      // Text column
      const textCol = figma.createFrame();
      textCol.fills = [];
      textCol.layoutMode = 'VERTICAL';
      textCol.itemSpacing = 3;
      textCol.layoutAlign = 'STRETCH';
      textCol.primaryAxisSizingMode = 'AUTO';
      textCol.counterAxisSizingMode = 'FIXED';
      textCol.resize(GUIDE_WIDTH - GUIDE_PADDING * 2 - 28, 20);
      row.appendChild(textCol);

      const labelNode = figma.createText();
      labelNode.fontName = { family: 'Inter', style: 'Medium' };
      labelNode.fontSize = 11;
      labelNode.characters = item.label;
      labelNode.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
      labelNode.layoutAlign = 'STRETCH';
      labelNode.textAutoResize = 'HEIGHT';
      textCol.appendChild(labelNode);

      if (item.description) {
        const descNode = figma.createText();
        descNode.fontName = { family: 'Inter', style: 'Regular' };
        descNode.fontSize = 10;
        descNode.characters = item.description;
        descNode.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.45 } }];
        descNode.layoutAlign = 'STRETCH';
        descNode.textAutoResize = 'HEIGHT';
        textCol.appendChild(descNode);
      }
    }
  }

  // ── Place numbered badges on top of their annotated elements ────────────
  // Priority: 1) Claude's visual x/y coords  2) nodeId absoluteBoundingBox  3) grid fallback
  let fallbackCol = 0;
  let fallbackRow = 0;

  // Track placed badge centres to detect and resolve stacking
  const placedPositions: Array<{ bx: number; by: number }> = [];

  for (const item of annotations.items) {
    let bx: number;
    let by: number;

    if (typeof item.x === 'number' && typeof item.y === 'number') {
      bx = item.x * frame.width  - BADGE_SIZE / 2;
      by = item.y * frame.height - BADGE_SIZE / 2;
    } else if (item.nodeId) {
      const targetNode = await figma.getNodeByIdAsync(item.nodeId) as SceneNode | null;
      const bounds = targetNode && 'absoluteBoundingBox' in targetNode
        ? targetNode.absoluteBoundingBox
        : null;
      if (bounds) {
        bx = bounds.x - frameBounds.x - BADGE_SIZE / 2;
        by = bounds.y - frameBounds.y - BADGE_SIZE / 2;
      } else {
        bx = 8 + fallbackCol * (BADGE_SIZE + 4);
        by = 8 + fallbackRow * (BADGE_SIZE + 4);
        fallbackCol++;
        if (fallbackCol >= 8) { fallbackCol = 0; fallbackRow++; }
      }
    } else {
      bx = 8 + fallbackCol * (BADGE_SIZE + 4);
      by = 8 + fallbackRow * (BADGE_SIZE + 4);
      fallbackCol++;
      if (fallbackCol >= 8) { fallbackCol = 0; fallbackRow++; }
    }

    // Clamp so the badge body stays fully inside the frame
    bx = Math.max(0, Math.min(frame.width  - BADGE_SIZE, bx));
    by = Math.max(0, Math.min(frame.height - BADGE_SIZE, by));

    // Resolve collisions using a radial spiral.
    // EXCL_ZONE: how close two badge centres can be (badge size + 4px breathing room).
    // STEP: distance between rings.
    // Up to 6 rings × 8 directions = 48 candidate positions tried before giving up.
    const EXCL = BADGE_SIZE + 4;
    const STEP = BADGE_SIZE + 4;
    const isClear = (cx: number, cy: number) =>
      !placedPositions.some((p) => Math.abs(p.bx - cx) < EXCL && Math.abs(p.by - cy) < EXCL);

    if (!isClear(bx, by)) {
      let resolved = false;
      outer: for (let ring = 1; ring <= 6 && !resolved; ring++) {
        const d = ring * STEP;
        for (const [dx, dy] of [
          [0, -d], [d, -d], [d, 0], [d, d],
          [0,  d], [-d, d], [-d, 0], [-d, -d],
        ]) {
          const cx = Math.max(0, Math.min(frame.width  - BADGE_SIZE, bx + dx));
          const cy = Math.max(0, Math.min(frame.height - BADGE_SIZE, by + dy));
          if (isClear(cx, cy)) {
            bx = cx; by = cy;
            resolved = true;
            break outer;
          }
        }
      }
      // Beyond 6 rings: keep original (slight overlap near the element is
      // better than displacing the badge to an unrelated area of the frame)
    }
    placedPositions.push({ bx, by });

    const cf = makeCategoryFrame(item.category);

    const circle = figma.createEllipse();
    circle.name = `#${item.number} ${item.label}`;
    circle.resize(BADGE_SIZE, BADGE_SIZE);
    circle.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[item.category] ?? '#888') }];
    circle.x = bx;
    circle.y = by;
    cf.appendChild(circle);

    const numText = figma.createText();
    numText.fontName = { family: 'Inter', style: 'Bold' };
    numText.fontSize = 10;
    numText.characters = String(item.number);
    numText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    numText.resize(BADGE_SIZE, BADGE_SIZE);
    numText.textAlignHorizontal = 'CENTER';
    numText.textAlignVertical = 'CENTER';
    numText.x = bx;
    numText.y = by;
    cf.appendChild(numText);
  }

  figma.viewport.scrollAndZoomIntoView([guide, ...categoryFrameMap.values()]);

  const categoryFrameIds: Record<string, string> = {};
  for (const [cat, cf] of categoryFrameMap) categoryFrameIds[cat] = cf.id;

  return { categoryFrameIds, guideFrameId: guide.id };
}


function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

// Type narrowing helper used in placement
interface AnnotationItem {
  id: string;
  number: number;
  category: string;
  label: string;
  description: string;
  x?: number;
  y?: number;
  nodeId?: string;
}
