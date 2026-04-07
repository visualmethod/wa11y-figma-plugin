import React, { useState } from 'react';
import type { Screen } from '../../shared/types';
import type { AppState } from '../App';

const MODELS = [
  { id: 'claude-sonnet-4-5',            label: 'Claude Sonnet 4.5 (recommended)' },
  { id: 'claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5 (fastest)' },
  { id: 'claude-opus-4-5',              label: 'Claude Opus 4.5 (most capable)' },
];

interface Props {
  state: AppState;
  setScreen: (s: Screen) => void;
  saveSettings: (apiKey: string, model: string) => void;
}

export default function Settings({ state, setScreen, saveSettings }: Props) {
  const [apiKey, setApiKey] = useState(state.apiKey);
  const [model, setModel]   = useState(state.model);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSave = () => {
    saveSettings(apiKey.trim(), model);
    setSaved(true);
    setTimeout(() => { setSaved(false); setScreen('home'); }, 1000);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="btn btn-ghost btn-icon" onClick={() => setScreen('home')}>
          ←
        </button>
        <h2 style={{ flex: 1, textAlign: 'center' }}>Settings</h2>
        <div style={{ width: 32 }} />
      </header>

      <div className="screen-body">
        <div className="input-group">
          <label className="input-label">Claude API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 14,
              }}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
          <p style={{ fontSize: 11 }}>
            Get your key from{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary)' }}
            >
              Anthropic Console
            </a>
            . Stored in Figma client storage on your device only.
          </p>
        </div>

        <div className="input-group">
          <label className="input-label">Model</label>
          <select
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="divider" />

        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
          <h3 style={{ marginBottom: 6 }}>Privacy note</h3>
          <p style={{ fontSize: 12 }}>
            Your API key is stored in Figma's local client storage — it never leaves your device
            except to call Google's Gemini API directly. No data is sent to Wa11y servers.
          </p>
        </div>
      </div>

      <div className="screen-footer">
        <button className="btn btn-primary" onClick={handleSave} disabled={!apiKey.trim()}>
          {saved ? '✓ Saved' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
