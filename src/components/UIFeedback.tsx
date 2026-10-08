import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive: boolean;
  resolve?: (value: boolean) => void;
}

interface FeedbackContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
  }) => Promise<boolean>;
  alertModal: (options: {
    title: string;
    message: string;
    buttonLabel?: string;
  }) => Promise<void>;
  haptic: (pattern?: number | number[]) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    isDestructive: false,
  });

  const nextToastId = useRef(0);

  const haptic = useCallback((pattern: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignora caso dispositivo não suporte vibração
      }
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    haptic(type === 'error' ? [30, 50, 30] : 15);
    const id = `toast_${Date.now()}_${nextToastId.current++}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, [haptic]);

  const confirm = useCallback((options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
  }): Promise<boolean> => {
    haptic(options.isDestructive ? [20, 40, 20] : 15);
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || (options.isDestructive ? 'Excluir' : 'Confirmar'),
        cancelLabel: options.cancelLabel || 'Cancelar',
        isDestructive: Boolean(options.isDestructive),
        resolve,
      });
    });
  }, [haptic]);

  const alertModal = useCallback((options: {
    title: string;
    message: string;
    buttonLabel?: string;
  }): Promise<void> => {
    haptic(15);
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.buttonLabel || 'Entendido',
        cancelLabel: '',
        isDestructive: false,
        resolve: () => resolve(),
      });
    });
  }, [haptic]);

  const handleConfirmAction = (confirmed: boolean) => {
    haptic(15);
    if (confirmDialog.resolve) {
      confirmDialog.resolve(confirmed);
    }
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, resolve: undefined }));
  };

  return (
    <FeedbackContext.Provider value={{ showToast, confirm, alertModal, haptic }}>
      {children}

      {/* Container de Toasts Flutuantes iOS */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-top, 0px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: '420px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '16px',
              background: 'rgba(28, 28, 30, 0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${
                toast.type === 'error'
                  ? 'rgba(255, 69, 58, 0.35)'
                  : toast.type === 'success'
                  ? 'rgba(48, 209, 88, 0.35)'
                  : 'rgba(255, 255, 255, 0.12)'
              }`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 500,
              lineHeight: 1.4,
              animation: 'slideInDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} color="#30D158" style={{ flexShrink: 0 }} />}
            {toast.type === 'error' && <AlertTriangle size={18} color="#FF453A" style={{ flexShrink: 0 }} />}
            {toast.type === 'info' && <Info size={18} color="#0A84FF" style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(235, 235, 245, 0.4)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Diálogo de Confirmação Estilo iOS Action Sheet */}
      {confirmDialog.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => handleConfirmAction(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              borderRadius: '20px',
              background: 'rgba(36, 36, 38, 0.98)',
              border: '0.5px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
              padding: '1.25rem 1rem 0.75rem',
              textAlign: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              style={{
                margin: '0 0 0.5rem',
                fontSize: '17px',
                fontWeight: 600,
                letterSpacing: '-0.3px',
              }}
            >
              {confirmDialog.title}
            </h4>
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: '13.5px',
                color: 'rgba(235, 235, 245, 0.75)',
                lineHeight: 1.45,
              }}
            >
              {confirmDialog.message}
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderTop: '0.5px solid rgba(255, 255, 255, 0.12)',
                paddingTop: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => handleConfirmAction(true)}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  background: confirmDialog.isDestructive
                    ? 'rgba(255, 69, 58, 0.9)'
                    : 'rgba(10, 132, 255, 0.9)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {confirmDialog.confirmLabel}
              </button>

              {confirmDialog.cancelLabel && (
                <button
                  type="button"
                  onClick={() => handleConfirmAction(false)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '12px',
                    border: '0.5px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'rgba(235, 235, 245, 0.85)',
                    fontSize: '15px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {confirmDialog.cancelLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export function useFeedback(): FeedbackContextType {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    // Fallback gracioso caso chamado fora do provider
    return {
      showToast: (msg: string) => console.log('[Toast]', msg),
      confirm: async () => true,
      alertModal: async (opts) => console.log('[Alert]', opts.message),
      haptic: () => {},
    };
  }
  return ctx;
}
