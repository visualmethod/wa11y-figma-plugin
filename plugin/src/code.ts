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
      layerTree,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown export error';
    figma.ui.postMessage({ type: 'export-error', message });
  }
}

async function handleAddWidget() {
  try {
    const widget = await figma.importWidgetByKeyAsync(WIDGET_MANIFEST_KEY);
    const instance = widget.createInstance({ x: figma.viewport.center.x, y: figma.viewport.center.y });
    figma.currentPage.appendChild(instance);
    figma.viewport.scrollAndZoomIntoView([instance]);
    figma.ui.postMessage({ type: 'widget-added' });
  } catch {
    // Widget not registered yet – instruct user
    figma.notify(
      'Wa11y widget not found. Load the widget manifest in Figma first, then try again.',
      { error: true, timeout: 5000 },
    );
  }
}

async function handlePlaceAnnotations(annotations: AnnotationSet) {
  const frame = await figma.getNodeByIdAsync(annotations.frameId) as FrameNode | null;
  if (!frame) {
    figma.notify('Frame not found. Please re-select it.', { error: true });
    return;
  }

  await placeAnnotationsOnCanvas(frame, annotations);
  figma.ui.postMessage({ type: 'annotations-placed', count: annotations.items.length });
  figma.notify(`✓ ${annotations.items.length} annotations placed`, { timeout: 3000 });
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
  'alt-text':    '#10B981', // green
  'landmarks':   '#8B5CF6', // purple
  'headings':    '#3B82F6', // blue
  'aria':        '#F59E0B', // amber
  'input-roles': '#EF4444', // red
};

const CATEGORY_LABELS: Record<string, string> = {
  'alt-text':    'Alt-Text',
  'landmarks':   'Landmark',
  'headings':    'Heading',
  'aria':        'ARIA',
  'input-roles': 'Input Role',
};

async function placeAnnotationsOnCanvas(frame: FrameNode, annotations: AnnotationSet) {
  const BADGE_SIZE = 24;
  const GUIDE_WIDTH = 260;
  const GUIDE_PADDING = 20;
  const GAP = 24;

  // ── Group container ──────────────────────────────────────────────────────
  const wrapper = figma.createFrame();
  wrapper.name = `[wa11y] ${frame.name}`;
  wrapper.fills = [];
  wrapper.clipsContent = false;
  wrapper.x = frame.x;
  wrapper.y = frame.y;

  // ── Design copy (we reference but don't clone to keep file size small) ──
  // Place badges as a group on top of the original frame
  const badgeGroup = figma.createFrame();
  badgeGroup.name = 'Annotation badges';
  badgeGroup.fills = [];
  badgeGroup.clipsContent = false;
  badgeGroup.resize(frame.width, frame.height);
  badgeGroup.x = GUIDE_WIDTH + GAP;
  badgeGroup.y = 0;

  // ── Annotation guide frame ───────────────────────────────────────────────
  const guide = figma.createFrame();
  guide.name = 'Annotation Guide';
  guide.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  guide.strokeWeight = 1;
  guide.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
  guide.cornerRadius = 12;
  guide.layoutMode = 'VERTICAL';
  guide.itemSpacing = 0;
  guide.paddingTop = GUIDE_PADDING;
  guide.paddingBottom = GUIDE_PADDING;
  guide.paddingLeft = GUIDE_PADDING;
  guide.paddingRight = GUIDE_PADDING;
  guide.primaryAxisSizingMode = 'AUTO';
  guide.counterAxisSizingMode = 'FIXED';
  guide.resize(GUIDE_WIDTH, 100);
  guide.x = 0;
  guide.y = 0;

  // Group items by category
  const byCategory = new Map<string, AnnotationItem[]>();
  for (const item of annotations.items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  // Render guide sections
  let isFirstSection = true;
  for (const [category, items] of byCategory) {
    if (!isFirstSection) await addDivider(guide);
    isFirstSection = false;

    // Section header
    const headerFrame = figma.createFrame();
    headerFrame.name = `Section: ${category}`;
    headerFrame.fills = [];
    headerFrame.layoutMode = 'HORIZONTAL';
    headerFrame.itemSpacing = 8;
    headerFrame.paddingBottom = 8;
    headerFrame.primaryAxisSizingMode = 'FIXED';
    headerFrame.counterAxisSizingMode = 'AUTO';
    headerFrame.resize(GUIDE_WIDTH - GUIDE_PADDING * 2, 24);
    headerFrame.counterAxisAlignItems = 'CENTER';

    const dot = figma.createEllipse();
    dot.resize(10, 10);
    dot.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[category] ?? '#888') }];
    headerFrame.appendChild(dot);

    const headerText = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
    headerText.fontName = { family: 'Inter', style: 'Semi Bold' };
    headerText.fontSize = 12;
    headerText.characters = CATEGORY_LABELS[category] ?? category;
    headerText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
    headerFrame.appendChild(headerText);
    guide.appendChild(headerFrame);

    // Items
    for (const item of items) {
      await addGuideItem(guide, item, category, GUIDE_WIDTH - GUIDE_PADDING * 2);
    }
  }

  // Render badges on canvas (positioned at 0,0 — coordinates are relative hints)
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  for (const item of annotations.items) {
    const badge = await createBadge(item, BADGE_SIZE);
    badgeGroup.appendChild(badge);
    // Badges are stacked at top-left until manual repositioning by designer
    badge.x = 8 + (item.number - 1) % 10 * (BADGE_SIZE + 4);
    badge.y = 8 + Math.floor((item.number - 1) / 10) * (BADGE_SIZE + 4);
  }

  wrapper.appendChild(guide);
  wrapper.appendChild(badgeGroup);

  figma.currentPage.appendChild(wrapper);
  wrapper.x = frame.x - GUIDE_WIDTH - GAP;
  wrapper.y = frame.y;
  wrapper.resize(GUIDE_WIDTH + GAP + frame.width, frame.height);
}

async function addGuideItem(
  parent: FrameNode,
  item: AnnotationItem,
  category: string,
  width: number,
) {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

  const row = figma.createFrame();
  row.name = `Item ${item.number}`;
  row.fills = [];
  row.layoutMode = 'HORIZONTAL';
  row.itemSpacing = 8;
  row.paddingTop = 6;
  row.paddingBottom = 6;
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.resize(width, 24);
  row.counterAxisAlignItems = 'MIN';

  // Number badge
  const numFrame = figma.createFrame();
  numFrame.resize(20, 20);
  numFrame.cornerRadius = 10;
  numFrame.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[category] ?? '#888') }];
  numFrame.layoutMode = 'HORIZONTAL';
  numFrame.primaryAxisAlignItems = 'CENTER';
  numFrame.counterAxisAlignItems = 'CENTER';
  numFrame.primaryAxisSizingMode = 'FIXED';
  numFrame.counterAxisSizingMode = 'FIXED';

  const numText = figma.createText();
  numText.fontName = { family: 'Inter', style: 'Bold' };
  numText.fontSize = 10;
  numText.characters = String(item.number);
  numText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  numFrame.appendChild(numText);
  row.appendChild(numFrame);

  // Text content
  const textFrame = figma.createFrame();
  textFrame.fills = [];
  textFrame.layoutMode = 'VERTICAL';
  textFrame.itemSpacing = 2;
  textFrame.primaryAxisSizingMode = 'AUTO';
  textFrame.counterAxisSizingMode = 'FIXED';
  textFrame.resize(width - 28, 24);

  const labelText = figma.createText();
  labelText.fontName = { family: 'Inter', style: 'Semi Bold' };
  labelText.fontSize = 11;
  labelText.characters = item.label;
  labelText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  labelText.textAutoResize = 'WIDTH_AND_HEIGHT';
  textFrame.appendChild(labelText);

  if (item.description) {
    const descText = figma.createText();
    descText.fontName = { family: 'Inter', style: 'Regular' };
    descText.fontSize = 10;
    descText.characters = item.description;
    descText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    descText.textAutoResize = 'WIDTH_AND_HEIGHT';
    textFrame.appendChild(descText);
  }

  row.appendChild(textFrame);
  parent.appendChild(row);
}

async function addDivider(parent: FrameNode) {
  const div = figma.createFrame();
  div.name = 'Divider';
  div.resize(220, 1);
  div.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
  div.layoutMode = 'NONE';
  parent.appendChild(div);
}

async function createBadge(item: AnnotationItem, size: number): Promise<EllipseNode> {
  const circle = figma.createEllipse();
  circle.resize(size, size);
  circle.fills = [{ type: 'SOLID', color: hexToRgb(CATEGORY_COLORS[item.category] ?? '#888') }];
  circle.name = `#${item.number} ${item.label}`;
  return circle;
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
}
