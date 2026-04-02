export type Screen = 'home' | 'settings' | 'analyze' | 'review' | 'done';

export type Platform = 'Web' | 'iOS' | 'Android';

export type AnnotationCategory =
  | 'alt-text'
  | 'landmarks'
  | 'headings'
  | 'aria'
  | 'input-roles';

export interface AnnotationItem {
  id: string;
  number: number;
  category: AnnotationCategory;
  label: string;
  description: string;
  ariaRole?: string;
  ariaNote?: string;
}

export interface AnnotationSet {
  frameId: string;
  frameName: string;
  platform: Platform;
  categories: AnnotationCategory[];
  items: AnnotationItem[];
}

// Messages between plugin main thread and UI
export type PluginMessage =
  | { type: 'selection-change'; frameId: string | null; frameName: string | null }
  | { type: 'export-result'; imageData: string; layerTree: LayerNode[] }
  | { type: 'widget-added' }
  | { type: 'annotations-placed'; count: number };

export type UIMessage =
  | { type: 'get-selection' }
  | { type: 'export-frame'; frameId: string }
  | { type: 'add-widget' }
  | { type: 'place-annotations'; annotations: AnnotationSet }
  | { type: 'resize'; width: number; height: number };

// Simplified layer tree sent to AI
export interface LayerNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  textContent?: string;
  fills?: ColorValue[];
  children?: LayerNode[];
  componentName?: string;
  isImage?: boolean;
  isInteractive?: boolean;
}

export interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
}
