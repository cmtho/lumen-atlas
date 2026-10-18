import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }
  });
}
