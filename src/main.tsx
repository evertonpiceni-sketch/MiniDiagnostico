import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './post-payment-recovery';
import './ambient-audio';
import './landing-approved-runtime';
import App from './App.tsx';
import './index.css';
import './final-approved-layout.css';
import './approved-board-completion.css';
import './landing-history-restore.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
