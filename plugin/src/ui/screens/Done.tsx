import React, { useState } from 'react';
import type { Screen } from '../../shared/types';
import type { AppState } from '../App';

interface Props {
  state: AppState;
  setScreen: (s: Screen) => void;
  postMessage: (msg: object) => void;
}

export default function Done({ state, postMessage, setScreen }: Props) {
  const count = state.pendingAnnotations?.items.length ?? 0;
  const [widgetAdded, setWidgetAdded] = useState(false);

  const handleAddWidget = () => {
    postMessage({ type: 'add-widget' });
    setWidgetAdded(true);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 8, flexShrink: 0 }}>
            <rect width="32" height="32" rx="8" fill="#5ee9b5"/>
            <circle cx="10.5" cy="11"   r="6"   fill="#015354"/>
            <circle cx="16"   cy="8.5"  r="6"   fill="#015354"/>
            <circle cx="21.5" cy="11"   r="6"   fill="#015354"/>
            <circle cx="8"    cy="17"   r="5.5" fill="#015354"/>
            <circle cx="24"   cy="17"   r="5.5" fill="#015354"/>
            <circle cx="10.5" cy="22.5" r="5.5" fill="#015354"/>
            <circle cx="21.5" cy="22.5" r="5.5" fill="#015354"/>
            <circle cx="16"   cy="16.5" r="9"   fill="#015354"/>
            <circle cx="16"   cy="16.5" r="5"   fill="#5ee9b5"/>
          </svg>
          Wa11y
        </div>
      </header>

      <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 40 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}
        >
          ✓
        </div>
        <h2 style={{ textAlign: 'center' }}>Annotations placed</h2>
        <p style={{ textAlign: 'center' }}>
          {count} annotation{count !== 1 ? 's' : ''} added to{' '}
          <strong>{state.pendingAnnotations?.frameName}</strong>.
          <br />
          Badges and the annotation guide are on your canvas.
        </p>

        <div className="divider" style={{ width: '100%' }} />

        {!widgetAdded ? (
          <div className="card" style={{ width: '100%' }}>
            <div className="card-title" style={{ marginBottom: 6 }}>Add the checklist too?</div>
            <div className="card-desc">
              Drop an accessibility checklist onto the canvas to track your review criteria
              alongside the annotations.
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleAddWidget}>
              Add checklist to canvas
            </button>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-light)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              width: '100%', textAlign: 'center', fontSize: 13, color: 'var(--color-primary-dark)',
            }}
          >
            ✓ Checklist added to canvas
          </div>
        )}
      </div>

      <div className="screen-footer" style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setScreen('analyze')}>
          Annotate another
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setScreen('home')}>
          Done
        </button>
      </div>
    </div>
  );
}
