import { useEffect, useState } from 'react';

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  });

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const onDisplay = (e) => { if (e.matches) setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media?.addEventListener?.('change', onDisplay);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media?.removeEventListener?.('change', onDisplay);
    };
  }, []);

  const promptInstall = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    setPromptEvent(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    return choice.outcome === 'accepted';
  };

  return { installed, available: !!promptEvent, promptInstall };
}
