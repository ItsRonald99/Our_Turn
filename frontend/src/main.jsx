import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { api } from './api/client';

if (import.meta.env.DEV) {
  window.__triggerReminders = async (force = true) => {
    const result = await api.triggerReminders(force);
    console.log('[dev] Reminders result:', result);
    return result;
  };
  console.log('[dev] __triggerReminders(force=true) available in console');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
