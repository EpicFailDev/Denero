/**
 * Service Worker Registration for OrganizAI PWA
 * Registers the service worker and handles updates.
 */

export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('SW registered:', registration.scope);

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                // Optionally notify user of update
                console.log('New content available, refresh to update.');
              }
            });
          }
        });
      } catch (error) {
        console.log('SW registration failed:', error);
      }
    });
  }
}
