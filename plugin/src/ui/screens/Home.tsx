import React, { useState } from 'react';
import type { Screen } from '../../shared/types';
import type { AppState } from '../App';

interface Props {
  state: AppState;
  setScreen: (s: Screen) => void;
  postMessage: (msg: object) => void;
}

export default function Home({ state, setScreen, postMessage }: Props) {
  const [widgetAdded, setWidgetAdded] = useState(false);
  const hasApiKey = !!state.apiKey;

  const handleAddWidget = () => {
    postMessage({ type: 'add-widget' });
    setWidgetAdded(true);
    setTimeout(() => setWidgetAdded(false), 2500);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="logo">
          <div className="logo-icon">♿</div>
          Wa11y
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setScreen('settings')}
          title="Settings"
        >
          ⚙
        </button>
      </header>

      <div className="screen-body">
        {!hasApiKey && (
          <div
            style={{
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 12,
              color: '#92400E',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span>⚠</span>
            <span>
              No API key configured.{' '}
              <button
                onClick={() => setScreen('settings')}
                style={{ background: 'none', border: 'none', color: '#92400E', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}
              >
                Add your Gemini key
              </button>{' '}
              to use AI annotation.
            </span>
          </div>
        )}

        {/* ── Generate annotations card ─────────────────────────────────── */}
        <div className="card">
          <div
            style={{
              width: 36,
              height: 36,
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              marginBottom: 12,
            }}
          >
            ✦
          </div>
          <div className="card-title">Generate annotations</div>
          <div className="card-desc">
            Select a frame and AI will draft your accessibility specs — alt-text, landmarks,
            headings, ARIA and input roles.
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setScreen('analyze')}
            disabled={!hasApiKey}
          >
            {state.selectedFrameName
              ? `Annotate "${state.selectedFrameName}"`
              : 'Annotate screen →'}
          </button>
          {!hasApiKey && (
            <p style={{ fontSize: 11, marginTop: 6, textAlign: 'center' }}>
              Requires a Gemini API key
            </p>
          )}
        </div>

        {/* ── Checklist card ────────────────────────────────────────────── */}
        <div className="card">
          <div
            style={{
              width: 36,
              height: 36,
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              marginBottom: 12,
            }}
          >
            ☑
          </div>
          <div className="card-title">Accessibility checklist</div>
          <div className="card-desc">
            Drop an interactive checklist onto your canvas. Mark items off as you validate
            each criterion — it serves as a sign-off for your team.
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleAddWidget}
            style={{ width: '100%' }}
          >
            {widgetAdded ? '✓ Added to canvas' : 'Add checklist to canvas'}
          </button>
        </div>
      </div>

      <footer className="screen-footer">
        <p style={{ fontSize: 11, textAlign: 'center' }}>
          Wa11y · Accessibility for design teams
        </p>
      </footer>
    </div>
  );
}
