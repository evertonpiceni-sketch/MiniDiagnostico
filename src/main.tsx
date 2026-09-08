import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './post-payment-recovery';
import './ambient-audio';
import App from './App.tsx';
import './index.css';
import './approved-board-completion.css';
import './landing-reference-lock.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
