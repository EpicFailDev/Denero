import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show banner after a short delay
      bannerTimer = window.setTimeout(() => setShowBanner(true), 2000);
    };

    let bannerTimer: number | undefined;

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (bannerTimer) window.clearTimeout(bannerTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (dismissed || !showBanner || !deferredPrompt) return null;

  return (
    <div className={`pwa-install-banner ${showBanner ? 'visible' : ''}`}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'linear-gradient(135deg, #10b981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
          Instalar OrganizAI
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(235, 235, 245, 0.5)', lineHeight: 1.3 }}>
          Adicione à tela inicial para acesso rápido
        </div>
      </div>
      <button className="pwa-install-btn" onClick={handleInstall}>
        Instalar
      </button>
      <button className="pwa-install-dismiss" onClick={handleDismiss}>
        <X size={18} />
      </button>
    </div>
  );
};
