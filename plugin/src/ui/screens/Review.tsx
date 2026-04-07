import React, { useState } from 'react';
import type { Screen, AnnotationCategory, AnnotationItem, AnnotationSet } from '../../shared/types';
import type { AppState } from '../App';

const CATEGORY_META: Record<AnnotationCategory, { label: string; color: string }> = {
  'alt-text':    { label: 'Alt-Text',        color: '#038673' },  // brand.mid
  'landmarks':   { label: 'Landmarks',        color: '#86418a' },  // semantic.light.purple.mid
  'headings':    { label: 'Headings',         color: '#385ef9' },  // semantic.light.blue.mid
  'aria':        { label: 'ARIA & Semantics', color: '#956a0d' },  // semantic.light.warning.mid
  'input-roles': { label: 'Input Roles',      color: '#ce3528' },  // semantic.light.negative.mid
};

interface Props {
  state: AppState;
  updateState: (p: Partial<AppState>) => void;
  setScreen: (s: Screen) => void;
  postMessage: (msg: object) => void;
}

export default function Review({ state, updateState, setScreen, postMessage }: Props) {
  const annotations = state.pendingAnnotations;
  const [activeCategory, setActiveCategory] = useState<AnnotationCategory | 'all'>('all');
  const [placing, setPlacing] = useState(false);

  if (!annotations) {
    setScreen('analyze');
    return null;
  }

  const usedCategories = [...new Set(annotations.items.map((i) => i.category))];

  const visibleItems =
    activeCategory === 'all'
      ? annotations.items
      : annotations.items.filter((i) => i.category === activeCategory);

  const updateItem = (id: string, patch: Partial<AnnotationItem>) => {
    const next: AnnotationSet = {
      ...annotations,
      items: annotations.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    };
    updateState({ pendingAnnotations: next });
  };

  const deleteItem = (id: string) => {
    const remaining = annotations.items.filter((i) => i.id !== id);
    // Re-number
    const renumbered = remaining.map((item, idx) => ({ ...item, number: idx + 1 }));
    updateState({ pendingAnnotations: { ...annotations, items: renumbered } });
  };

  const addItem = () => {
    const cat = activeCategory === 'all' ? usedCategories[0] : activeCategory;
    const newItem: AnnotationItem = {
      id: `item-${Date.now()}`,
      number: annotations.items.length + 1,
      category: cat,
      label: 'New annotation',
      description: '',
    };
    updateState({
      pendingAnnotations: {
        ...annotations,
        items: [...annotations.items, newItem],
      },
    });
  };

  const handlePlace = () => {
    if (!state.selectedFrameId) return;
    setPlacing(true);
    const toPlace: AnnotationSet = {
      ...annotations,
      frameId: state.selectedFrameId,
    };
    postMessage({ type: 'place-annotations', annotations: toPlace });

    const onMsg = (e: MessageEvent) => {
      if (e.data?.pluginMessage?.type === 'annotations-placed') {
        window.removeEventListener('message', onMsg);
        setPlacing(false);
        setScreen('done');
      }
    };
    window.addEventListener('message', onMsg);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="btn btn-ghost btn-icon" onClick={() => setScreen('analyze')}>←</button>
        <h2 style={{ flex: 1, textAlign: 'center' }}>
          Review annotations
        </h2>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 32, textAlign: 'right' }}>
          {annotations.items.length}
        </span>
      </header>

      {/* Category filter tabs */}
      <div style={{ padding: '8px 16px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: activeCategory === 'all' ? 700 : 400,
            borderBottom: activeCategory === 'all' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeCategory === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          All
        </button>
        {usedCategories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 700 : 400,
                borderBottom: active ? `2px solid ${meta.color}` : '2px solid transparent',
                color: active ? meta.color : 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="screen-body">
        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>No annotations in this category</p>
          </div>
        ) : (
          <div>
            {visibleItems.map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <div key={item.id} className="annotation-item">
                  <div
                    className="annotation-num"
                    style={{ background: meta.color }}
                  >
                    {item.number}
                  </div>
                  <div className="annotation-content">
                    <input
                      className="annotation-label-input"
                      value={item.label}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                    />
                    <textarea
                      className="annotation-desc-input"
                      value={item.description}
                      rows={2}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Add description…"
                    />
                    {(item.ariaRole || item.ariaNote) && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {item.ariaRole && <span style={{ marginRight: 8 }}><strong>role=</strong>"{item.ariaRole}"</span>}
                        {item.ariaNote && <span>{item.ariaNote}</span>}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => deleteItem(item.id)}
                    title="Remove"
                    style={{ color: 'var(--color-text-muted)', fontSize: 14, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <button
              className="btn btn-ghost"
              onClick={addItem}
              style={{ width: '100%', marginTop: 8, justifyContent: 'center', color: 'var(--color-primary)' }}
            >
              + Add annotation
            </button>
          </div>
        )}
      </div>

      <div className="screen-footer">
        <button
          className="btn btn-primary"
          onClick={handlePlace}
          disabled={placing || annotations.items.length === 0 || !state.selectedFrameId}
          style={{ gap: 8 }}
        >
          {placing && <span className="loading-spinner" />}
          {placing ? 'Placing on canvas…' : 'Place on canvas →'}
        </button>
        {!state.selectedFrameId && (
          <p style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>
            Re-select the frame on canvas to place annotations
          </p>
        )}
      </div>
    </div>
  );
}
