import React, { useState, useEffect } from 'react';
import type { Screen } from '../shared/types';
import type { AnnotationSet, Platform, AnnotationCategory } from '../shared/types';
import Home from './screens/Home';
import Settings from './screens/Settings';
import Analyze from './screens/Analyze';
import Review from './screens/Review';
import Done from './screens/Done';

export interface PlacedFrames {
  categoryFrameIds: Record<string, string>;
  guideFrameId: string;
  frameName: string;
}

export interface AppState {
  apiKey: string;
  model: string;
  selectedFrameId: string | null;
  selectedFrameName: string | null;
  platform: Platform;
  categories: AnnotationCategory[];
  pendingAnnotations: AnnotationSet | null;
  /** Frame IDs of the last placed annotation set — used by Done screen filter */
  placedFrames: PlacedFrames | null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [state, setState] = useState<AppState>({
    apiKey: '',
    model: 'claude-sonnet-4-5',
    selectedFrameId: null,
    selectedFrameName: null,
    platform: 'Web',
    categories: ['alt-text', 'landmarks', 'headings', 'aria', 'input-roles'],
    pendingAnnotations: null,
    placedFrames: null,
  });

  // Load persisted settings from figma.clientStorage on mount
  useEffect(() => {
    postMessage({ type: 'load-settings' });
  }, []);

  // Listen for messages from the plugin main thread
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'settings-loaded':
          setState((s) => ({
            ...s,
            apiKey: msg.apiKey ?? '',
            model: msg.model ?? 'claude-sonnet-4-5',
          }));
          break;
        case 'selection-change':
          setState((s) => ({
            ...s,
            selectedFrameId: msg.frameId,
            selectedFrameName: msg.frameName,
          }));
          break;
        case 'annotations-placed':
          setState((s) => ({
            ...s,
            placedFrames: {
              categoryFrameIds: msg.categoryFrameIds,
              guideFrameId: msg.guideFrameId,
              frameName: s.pendingAnnotations?.frameName ?? '',
            },
          }));
          break;
        case 'widget-added':
          // Could show a brief toast — no navigation needed
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateState = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  const saveSettings = (apiKey: string, model: string) => {
    postMessage({ type: 'save-settings', apiKey, model });
    updateState({ apiKey, model });
  };

  const postMessage = (msg: object) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const commonProps = { state, updateState, setScreen, postMessage, saveSettings };

  return (
    <div className="app">
      {screen === 'home'     && <Home     {...commonProps} />}
      {screen === 'settings' && <Settings {...commonProps} />}
      {screen === 'analyze'  && <Analyze  {...commonProps} />}
      {screen === 'review'   && <Review   {...commonProps} />}
      {screen === 'done'     && <Done     {...commonProps} />}
    </div>
  );
}
