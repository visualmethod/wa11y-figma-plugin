import React, { useState, useEffect } from 'react';
import type { Screen } from '../shared/types';
import type { AnnotationSet, Platform, AnnotationCategory } from '../shared/types';
import Home from './screens/Home';
import Settings from './screens/Settings';
import Analyze from './screens/Analyze';
import Review from './screens/Review';
import Done from './screens/Done';

export interface AppState {
  apiKey: string;
  model: string;
  selectedFrameId: string | null;
  selectedFrameName: string | null;
  platform: Platform;
  categories: AnnotationCategory[];
  pendingAnnotations: AnnotationSet | null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [state, setState] = useState<AppState>({
    apiKey: '',
    model: 'gemini-2.0-flash',
    selectedFrameId: null,
    selectedFrameName: null,
    platform: 'Web',
    categories: ['alt-text', 'landmarks', 'headings', 'aria', 'input-roles'],
    pendingAnnotations: null,
  });

  // Load persisted settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('wa11y_settings');
    if (saved) {
      try {
        const { apiKey, model } = JSON.parse(saved);
        setState((s) => ({ ...s, apiKey: apiKey ?? '', model: model ?? 'gemini-2.0-flash' }));
      } catch {
        // ignore corrupt storage
      }
    }
  }, []);

  // Listen for messages from the plugin main thread
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'selection-change':
          setState((s) => ({
            ...s,
            selectedFrameId: msg.frameId,
            selectedFrameName: msg.frameName,
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
    localStorage.setItem('wa11y_settings', JSON.stringify({ apiKey, model }));
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
