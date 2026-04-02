import React, { useState } from 'react';
import type { Screen } from '../../shared/types';
import type { AppState } from '../App';

const MODELS = [
  { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash (fast, recommended)' },
  { id: 'gemini-2.0-flash-lite',  label: 'Gemini 2.0 Flash Lite (fastest)' },
  { id: 'gemini-1.5-pro',         label: 'Gemini 1.5 Pro (most capable)' },
  { id: 'gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro Preview' },
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
          <label className="input-label">Gemini API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              placeholder="AIza…"
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
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-primary)' }}
            >
              Google AI Studio
            </a>
            . Stored locally in this browser only.
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
            Your API key is stored in browser localStorage — it never leaves your device except
            to call Google's Gemini API directly. No data is sent to Wa11y servers.
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
