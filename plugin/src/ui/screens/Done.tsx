import React, { useState, useEffect } from 'react';
import type { Screen, AnnotationCategory } from '../../shared/types';
import type { AppState } from '../App';
import Logo from '../components/Logo';

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  'alt-text':    { label: 'Alt-Text',        color: '#385ef9' },
  'landmarks':   { label: 'Landmarks',        color: '#86418a' },
  'headings':    { label: 'Headings',         color: '#956a0d' },
  'aria':        { label: 'ARIA & Semantics', color: '#038673' },
  'input-roles': { label: 'Input Roles',      color: '#ce3528' },
  'focus-order': { label: 'Focus Order',      color: '#228618' },
};

interface CategoryRow {
  category: string;
  frameId: string;
  visible: boolean;
}

interface Props {
  state: AppState;
  setScreen: (s: Screen) => void;
  postMessage: (msg: object) => void;
}

export default function Done({ state, postMessage, setScreen }: Props) {
  const annotations = state.pendingAnnotations;
  const placedFrames = state.placedFrames;
  const count = annotations?.items.length ?? 0;
  const frameName = annotations?.frameName ?? placedFrames?.frameName ?? '';

  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [guide, setGuide] = useState<{ frameId: string; visible: boolean } | null>(null);
  const [widgetAdded, setWidgetAdded] = useState(false);

  // Count items per category from annotation state
  const categoryCounts: Record<string, number> = {};
  annotations?.items.forEach((item) => {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  });

  // Query current Figma layer visibility on mount — Figma is the source of truth,
  // so this restores filter state even after the plugin is reopened.
  useEffect(() => {
    if (!frameName) return;
    postMessage({ type: 'query-annotation-frames', frameName });

    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type !== 'annotation-frames-state') return;
      window.removeEventListener('message', handler);
      setCategoryRows(msg.frames as CategoryRow[]);
      if (msg.guideFrameId) {
        setGuide({ frameId: msg.guideFrameId, visible: msg.guideVisible });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [frameName]);

  const toggle = (frameId: string, visible: boolean) => {
    postMessage({ type: 'toggle-category', frameId, visible });
    setCategoryRows((rows) => rows.map((r) => r.frameId === frameId ? { ...r, visible } : r));
    if (guide?.frameId === frameId) setGuide((g) => g ? { ...g, visible } : g);
  };

  const toggleAll = (visible: boolean) => {
    categoryRows.forEach((r) => toggle(r.frameId, visible));
    if (guide) toggle(guide.frameId, visible);
  };

  const allVisible = categoryRows.every((r) => r.visible) && (guide?.visible ?? true);
  const noneVisible = categoryRows.every((r) => !r.visible) && !(guide?.visible ?? true);

  const hasFilterData = categoryRows.length > 0;

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="logo">
          <Logo />
          Wa11y
        </div>
      </header>

      <div className="screen-body" style={{ padding: '16px' }}>

        {/* Success summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'var(--color-primary)',
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {count} annotation{count !== 1 ? 's' : ''} placed
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              on <strong>{frameName}</strong>
            </div>
          </div>
        </div>

        <div className="divider" style={{ marginBottom: 16 }} />

        {/* Category filter */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Show / hide categories
            </span>
            {hasFilterData && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px', fontSize: 11, opacity: allVisible ? 0.4 : 1 }}
                  onClick={() => toggleAll(true)}
                  disabled={allVisible}
                >
                  All
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px', fontSize: 11, opacity: noneVisible ? 0.4 : 1 }}
                  onClick={() => toggleAll(false)}
                  disabled={noneVisible}
                >
                  None
                </button>
              </div>
            )}
          </div>

          {!hasFilterData ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 0' }}>
              No annotation frames found on canvas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {categoryRows.map(({ category, frameId, visible }) => {
                const meta = CATEGORY_META[category];
                const catCount = categoryCounts[category as AnnotationCategory] ?? '–';
                return (
                  <div
                    key={frameId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 'var(--radius-md)',
                      background: visible ? 'transparent' : 'var(--color-bg-secondary)',
                      opacity: visible ? 1 : 0.55,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: meta?.color ?? '#888',
                    }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{meta?.label ?? category}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 16, textAlign: 'right' }}>
                      {catCount}
                    </span>
                    <div
                      role="checkbox"
                      aria-checked={visible}
                      tabIndex={0}
                      onClick={() => toggle(frameId, !visible)}
                      onKeyDown={(e) => e.key === ' ' && toggle(frameId, !visible)}
                      title={visible ? 'Hide' : 'Show'}
                      style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: `1.5px solid ${visible ? (meta?.color ?? 'var(--color-primary)') : 'var(--color-border)'}`,
                        background: visible ? (meta?.color ?? 'var(--color-primary)') : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {visible && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1, fontWeight: 700, userSelect: 'none' }}>✓</span>}
                    </div>
                  </div>
                );
              })}

              {/* Guide sidebar row */}
              {guide && (
                <>
                  <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 'var(--radius-md)',
                      background: guide.visible ? 'transparent' : 'var(--color-bg-secondary)',
                      opacity: guide.visible ? 1 : 0.55,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                      background: 'var(--color-border)',
                      border: '1.5px solid var(--color-text-muted)',
                    }} />
                    <span style={{ flex: 1, fontSize: 13 }}>Annotation guide</span>
                    <div
                      role="checkbox"
                      aria-checked={guide.visible}
                      tabIndex={0}
                      onClick={() => toggle(guide.frameId, !guide.visible)}
                      onKeyDown={(e) => e.key === ' ' && toggle(guide.frameId, !guide.visible)}
                      title={guide.visible ? 'Hide guide' : 'Show guide'}
                      style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: `1.5px solid ${guide.visible ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
                        background: guide.visible ? 'var(--color-text-muted)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {guide.visible && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1, fontWeight: 700, userSelect: 'none' }}>✓</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="divider" style={{ margin: '16px 0' }} />

        {/* Checklist upsell */}
        {!widgetAdded ? (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>Add the checklist too?</div>
            <div className="card-desc" style={{ marginBottom: 8 }}>
              Drop an accessibility checklist onto the canvas alongside the annotations.
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => { postMessage({ type: 'add-widget' }); setWidgetAdded(true); }}
            >
              Add checklist to canvas
            </button>
          </div>
        ) : (
          <div style={{
            background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-light)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            textAlign: 'center', fontSize: 13, color: 'var(--color-primary-dark)',
          }}>
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
