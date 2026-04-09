import React, { useState, useEffect } from 'react';
import type { Screen, Platform, AnnotationCategory, AnnotationSet, LayerNode } from '../../shared/types';
import type { AppState } from '../App';

const ALL_CATEGORIES: { id: AnnotationCategory; label: string; platforms: Platform[] }[] = [
  { id: 'alt-text',    label: 'Alt-Text',        platforms: ['Web', 'iOS', 'Android'] },
  { id: 'landmarks',   label: 'Landmarks',        platforms: ['Web'] },
  { id: 'headings',    label: 'Headings',         platforms: ['Web', 'iOS', 'Android'] },
  { id: 'aria',        label: 'ARIA & Semantics', platforms: ['Web'] },
  { id: 'input-roles', label: 'Input Roles',      platforms: ['Web', 'iOS', 'Android'] },
  { id: 'focus-order', label: 'Focus Order',      platforms: ['Web', 'iOS', 'Android'] },
];

interface Props {
  state: AppState;
  updateState: (p: Partial<AppState>) => void;
  setScreen: (s: Screen) => void;
  postMessage: (msg: object) => void;
}

type Status = 'idle' | 'exporting' | 'analyzing' | 'error';

export default function Analyze({ state, updateState, setScreen, postMessage }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const availableCategories = ALL_CATEGORIES.filter((c) =>
    c.platforms.includes(state.platform),
  );

  // Keep selected categories in sync when platform changes
  useEffect(() => {
    const available = availableCategories.map((c) => c.id);
    const filtered = state.categories.filter((c) => available.includes(c));
    if (filtered.length !== state.categories.length) {
      updateState({ categories: filtered });
    }
  }, [state.platform]);

  const toggleCategory = (id: AnnotationCategory) => {
    const next = state.categories.includes(id)
      ? state.categories.filter((c) => c !== id)
      : [...state.categories, id];
    updateState({ categories: next });
  };

  const canGenerate =
    !!state.selectedFrameId &&
    state.categories.length > 0 &&
    status === 'idle';

  const handleGenerate = async () => {
    if (!state.selectedFrameId || !state.selectedFrameName) return;
    setStatus('exporting');
    setErrorMsg('');
    console.log('[wa11y] Requesting frame export:', state.selectedFrameId);

    postMessage({ type: 'export-frame', frameId: state.selectedFrameId });

    const onMessage = async (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg || (msg.type !== 'export-result' && msg.type !== 'export-error')) return;
      window.removeEventListener('message', onMessage);

      if (msg.type === 'export-error') {
        console.error('[wa11y] Export failed:', msg.message);
        setErrorMsg(`Export failed: ${msg.message}`);
        setStatus('error');
        return;
      }

      console.log('[wa11y] Export OK, sending to Claude…');
      setStatus('analyzing');
      try {
        const annotations = await callGemini(
          state.apiKey,
          state.model,
          msg.imageData as string,
          msg.layerTree as LayerNode[],
          state.platform,
          state.categories,
          state.selectedFrameName!,
        );
        console.log('[wa11y] Claude response OK, items:', annotations.items.length);
        updateState({ pendingAnnotations: annotations });
        setScreen('review');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error from Claude API';
        console.error('[wa11y] Claude API error:', message);
        setErrorMsg(message);
        setStatus('error');
      }
    };

    window.addEventListener('message', onMessage);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="btn btn-ghost btn-icon" onClick={() => setScreen('home')}>←</button>
        <h2 style={{ flex: 1, textAlign: 'center' }}>Annotate screen</h2>
        <div style={{ width: 32 }} />
      </header>

      <div className="screen-body">
        {/* Frame selection */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Selected frame</div>
          {state.selectedFrameName ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: 16 }}>▢</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{state.selectedFrameName}</span>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
              <p>Select a frame on the canvas to get started</p>
            </div>
          )}
        </div>

        {/* Platform */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Platform</div>
          <div className="segment">
            {(['Web', 'iOS', 'Android'] as Platform[]).map((p) => (
              <button
                key={p}
                className={`segment-btn ${state.platform === p ? 'active' : ''}`}
                onClick={() => updateState({ platform: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Annotation categories</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {availableCategories.map((cat) => {
              const active = state.categories.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleCategory(cat.id)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {status === 'error' && (
          <div
            style={{
              background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              fontSize: 12, color: 'var(--color-critical)',
            }}
          >
            <strong>Error: </strong>{errorMsg}
            <button
              onClick={() => setStatus('idle')}
              style={{ marginLeft: 8, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="screen-footer">
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{ gap: 8 }}
        >
          {status === 'exporting' && <span className="loading-spinner" />}
          {status === 'analyzing' && <span className="loading-spinner" />}
          {status === 'exporting' && 'Exporting frame…'}
          {status === 'analyzing' && 'Analysing with AI…'}
          {status === 'idle'      && 'Generate annotations →'}
          {status === 'error'     && 'Generate annotations →'}
        </button>
      </div>
    </div>
  );
}

// ─── Claude API call ──────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  layerTree: LayerNode[],
  platform: Platform,
  categories: AnnotationCategory[],
  frameName: string,
): Promise<AnnotationSet> {
  const prompt = buildPrompt(platform, categories, layerTree, frameName);

  const requestBody = JSON.stringify({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  // Retry up to 3 times for transient overload errors (529 / 503)
  const MAX_RETRIES = 3;
  let response!: Response;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if ((response.status === 529 || response.status === 503) && attempt < MAX_RETRIES) {
      const wait = attempt * 3000; // 3s, 6s
      console.warn(`[wa11y] API overloaded (${response.status}), retrying in ${wait / 1000}s… (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    break;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('[wa11y] Claude HTTP error:', response.status, err);
    const base = err?.error?.message ?? `Claude API error ${response.status}`;
    const suffix = response.status === 529 || response.status === 503
      ? ' — the API is temporarily busy, please try again in a moment'
      : '';
    throw new Error(base + suffix);
  }

  const data = await response.json();
  console.log('[wa11y] Claude raw response:', JSON.stringify(data).slice(0, 300));
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: { items: AnnotationItem[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Could not parse Claude response as JSON');
  }

  return {
    frameId: '',
    frameName,
    platform,
    categories,
    // Assign per-category sequential numbers so each section reads 1, 2, 3…
    items: (() => {
      const counters: Record<string, number> = {};
      return parsed.items.map((item, i) => {
        const cat = item.category as AnnotationCategory;
        counters[cat] = (counters[cat] ?? 0) + 1;
        return {
          id: `item-${i}`,
          number: counters[cat],
          category: cat,
          label: item.label,
          description: item.description,
          x: typeof item.x === 'number' ? Math.max(0, Math.min(1, item.x)) : undefined,
          y: typeof item.y === 'number' ? Math.max(0, Math.min(1, item.y)) : undefined,
          nodeId: item.nodeId,
          ariaRole: item.ariaRole,
          ariaNote: item.ariaNote,
        };
      });
    })(),
  };
}

interface AnnotationItem {
  category: string;
  label: string;
  description: string;
  x?: number;
  y?: number;
  nodeId?: string;
  ariaRole?: string;
  ariaNote?: string;
}

function buildPrompt(
  platform: Platform,
  categories: AnnotationCategory[],
  layerTree: LayerNode[],
  frameName: string,
): string {
  const categoryDescriptions: Record<AnnotationCategory, string> = {
    'alt-text':    'Alternative text for every image and icon — mark each one as either the descriptive alt string or "Decorative" (aria-hidden="true"). Annotate EVERY instance separately, even identical-looking icons on different cards.',
    'landmarks':   'Page regions: header/banner, nav, main, footer, aside, section. Annotate each distinct region.',
    'headings':    'Complete heading hierarchy: every H1–H6 and its visible text content.',
    'aria':        'ARIA roles, states and properties for custom or composite interactive elements (tabs, live regions, dialogs, etc.). Only annotate what cannot be expressed with native HTML semantics.',
    'input-roles': 'Every interactive control: buttons, links, inputs, checkboxes, toggles, tabs. Annotate every instance separately even on repeated cards.',
    'focus-order': 'Logical keyboard tab order. Number every focusable element in the order a keyboard user reaches it (left-to-right, top-to-bottom unless layout dictates otherwise). Flag elements that should be skipped (aria-hidden) or break expected reading order.',
  };

  const requestedCategories = categories
    .map((c) => `- ${c}: ${categoryDescriptions[c]}`)
    .join('\n');

  return `You are an expert accessibility auditor analysing a ${platform} UI design frame called "${frameName}".

I am providing:
1. A screenshot of the design frame
2. The Figma layer tree as JSON (node ids, names, types, text content)

Layer tree:
${JSON.stringify(layerTree, null, 2)}

Generate accessibility annotations for these categories:
${requestedCategories}

RULES — follow these exactly:
1. Be EXHAUSTIVE. Annotate every element that qualifies. Never merge similar items into one — annotate each card's image, each button, each icon separately.
2. Number annotations sequentially across all categories starting from 1.
3. For EVERY item, look at the screenshot and set "x" and "y" to the element's approximate position as a fraction of the total frame dimensions (x: 0=left edge, 1=right edge; y: 0=top edge, 1=bottom edge). Target the top-left corner of the element. These values must be between 0 and 1.
4. When the design contains vertically stacked repeating sections (cards, list items, rows), pay close attention to y — elements in the 1st, 2nd, 3rd section MUST have clearly distinct y values that reflect their actual vertical position. Do not give two different cards the same y value.
5. For "nodeId", use the exact "id" value of the best-matching node from the layer tree JSON. Omit only if truly no node corresponds.
6. Descriptions must be concrete implementation values (e.g. alt="Mountain bike on grassy outdoor trail"), not vague instructions.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "items": [
    {
      "category": "alt-text" | "landmarks" | "headings" | "aria" | "input-roles" | "focus-order",
      "label": "Short element label (e.g. 'Hero image', 'Main nav', 'H1 – Purchases')",
      "description": "Concrete annotation value (e.g. 'alt=\\"Mountain bike\\"' or 'role=\\"tablist\\"')",
      "x": 0.15,
      "y": 0.08,
      "nodeId": "123:456",
      "ariaRole": "optional ARIA role string",
      "ariaNote": "optional developer note"
    }
  ]
}`;
}
