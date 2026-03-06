import { useState } from 'react'
import type { BridgeOptions } from '../hooks/useWorkerBridge'

interface VpsSettingsProps {
  options: BridgeOptions
  onChange: (options: BridgeOptions) => void
}

export function VpsSettings({ options, onChange }: VpsSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="vps-settings-container">
      <button 
        className={`settings-toggle ${options.mode === 'remote' ? 'mode-remote' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="VPS Settings"
      >
        <span className="icon">🌐</span>
        <span className="label">{options.mode === 'remote' ? 'Remote (VPS)' : 'Local Mode'}</span>
      </button>

      {isOpen && (
        <div className="settings-dropdown">
          <div className="settings-group">
            <label>Operation Mode</label>
            <div className="mode-toggle">
              <button 
                className={options.mode === 'local' ? 'active' : ''} 
                onClick={() => onChange({ ...options, mode: 'local' })}
              >
                Local
              </button>
              <button 
                className={options.mode === 'remote' ? 'active' : ''} 
                onClick={() => onChange({ ...options, mode: 'remote' })}
              >
                Remote (VPS)
              </button>
            </div>
          </div>

          {options.mode === 'remote' && (
            <>
              <div className="settings-group">
                <label>VPS Server URL</label>
                <input 
                  type="text" 
                  placeholder="http://your-vps-ip:3000"
                  value={options.remoteUrl || ''}
                  onChange={(e) => onChange({ ...options, remoteUrl: e.target.value })}
                />
              </div>
              <div className="settings-group">
                <label>API Key</label>
                <input 
                  type="password" 
                  placeholder="Your API Key"
                  value={options.apiKey || ''}
                  onChange={(e) => onChange({ ...options, apiKey: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="settings-footer">
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        .vps-settings-container {
          position: relative;
          margin-bottom: 20px;
        }
        .settings-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .settings-toggle:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .settings-toggle.mode-remote {
          border-color: #2e7d32;
          background: rgba(46, 125, 50, 0.1);
        }
        .settings-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #1a1a24;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .settings-group {
          margin-bottom: 16px;
        }
        .settings-group label {
          display: block;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }
        .mode-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          padding: 3px;
        }
        .mode-toggle button {
          flex: 1;
          padding: 6px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          border-radius: 4px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .mode-toggle button.active {
          background: #3d3d5c;
          color: #fff;
        }
        input {
          width: 100%;
          padding: 10px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          outline: none;
        }
        input:focus {
          border-color: #5c5cff;
        }
        .settings-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .settings-footer button {
          padding: 6px 16px;
          background: #3d3d5c;
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
