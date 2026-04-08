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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('[wa11y] Claude HTTP error:', response.status, err);
    throw new Error(err?.error?.message ?? `Claude API error ${response.status}`);
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
    items: parsed.items.map((item, i) => ({
      id: `item-${i}`,
      number: i + 1,
      category: item.category as AnnotationCategory,
      label: item.label,
      description: item.description,
      nodeId: item.nodeId,
      ariaRole: item.ariaRole,
      ariaNote: item.ariaNote,
    })),
  };
}

interface AnnotationItem {
  category: string;
  label: string;
  description: string;
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
    'alt-text':    'Alternative text for images and icons (mark decorative ones as "Decorative")',
    'landmarks':   'Page regions: header, nav, main, footer, aside, section (Web only)',
    'headings':    'Heading hierarchy: H1–H6 and their text content',
    'aria':        'ARIA roles, states and properties for custom/interactive elements',
    'input-roles': 'Input types and roles: text, email, password, search, button, combobox, etc.',
    'focus-order': 'Logical keyboard/focus tab order based on visual layout and layer hierarchy. Number each focusable element in the order a keyboard user should reach it (left-to-right, top-to-bottom unless layout dictates otherwise). Flag any elements that appear visually but should be skipped (aria-hidden) or that break expected reading order.',
  };

  const requestedCategories = categories
    .map((c) => `- ${c}: ${categoryDescriptions[c]}`)
    .join('\n');

  return `You are an expert accessibility auditor analysing a ${platform} UI design frame called "${frameName}".

I am providing you with:
1. A screenshot of the design frame
2. The Figma layer tree as JSON (names, types, text content, colors)

Layer tree:
${JSON.stringify(layerTree, null, 2)}

Your task: generate accessibility annotations for the following categories:
${requestedCategories}

Rules:
- Be specific and actionable. Each annotation should help a developer implement the correct accessibility attribute.
- For alt-text: distinguish between "Written" (has meaningful content) and "Decorative" (aria-hidden="true")
- For ARIA: only annotate elements that genuinely need explicit ARIA (don't annotate native semantic elements)
- Number annotations sequentially across all categories, starting from 1
- For EVERY item, set "nodeId" to the exact "id" value of the corresponding node from the layer tree JSON above. If the annotation covers a container or group, use its id. If no single node matches, omit the field.

Return ONLY valid JSON in this exact schema — no markdown, no explanation:
{
  "items": [
    {
      "category": "alt-text" | "landmarks" | "headings" | "aria" | "input-roles" | "focus-order",
      "label": "Short element label (e.g. 'Search bar', 'Navigation', 'H1 - Page title')",
      "description": "The actual annotation value (e.g. 'Search products', 'role=\\"navigation\\" aria-label=\\"Main navigation\\"')",
      "nodeId": "the id field of the matching node from the layer tree, e.g. '123:456'",
      "ariaRole": "optional ARIA role string",
      "ariaNote": "optional additional note for developers"
    }
  ]
}`;
}
