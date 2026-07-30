import { createContext, useCallback, useContext, useState } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { message, yesLabel, resolve }
  const [nameState, setNameState] = useState(null); // { description, resolve }

  const toast = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const confirm = useCallback(
    (message, yesLabel = 'Yes') =>
      new Promise((resolve) => {
        setConfirmState({ message, yesLabel, resolve });
      }),
    []
  );

  const promptName = useCallback(
    (description) =>
      new Promise((resolve) => {
        setNameState({ description, resolve });
      }),
    []
  );

  return (
    <UIContext.Provider value={{ toast, confirm, promptName }}>
      {children}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.msg}
          </div>
        ))}
      </div>

      {confirmState && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              confirmState.resolve(false);
              setConfirmState(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-head">
              <div className="modal-title">Please confirm</div>
              <button
                className="modal-close"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13.5, whiteSpace: 'pre-line' }}>{confirmState.message}</div>
            </div>
            <div className="modal-foot">
              <div />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => {
                    confirmState.resolve(false);
                    setConfirmState(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    confirmState.resolve(true);
                    setConfirmState(null);
                  }}
                >
                  {confirmState.yesLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {nameState && (
        <NamePromptModal
          description={nameState.description}
          onDone={(name) => {
            nameState.resolve(name);
            setNameState(null);
          }}
        />
      )}
    </UIContext.Provider>
  );
}

function NamePromptModal({ description, onDone }) {
  const [name, setName] = useState('');
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDone(null);
      }}
    >
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-head">
          <div className="modal-title">Who&apos;s saving this?</div>
          <button className="modal-close" onClick={() => onDone(null)}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="mini-note" style={{ marginBottom: 10 }}>
            {description}
          </div>
          <div className="field">
            <label>Your name</label>
            <input
              autoFocus
              placeholder="e.g. Priya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDone(name);
              }}
            />
          </div>
        </div>
        <div className="modal-foot">
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => onDone(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => onDone(name)}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
