import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './payment-session-guard';
import './asaas-cpf-fix';
import './payment-fix-safe';
import './post-payment-recovery';
import './ambient-audio';
import App from './App.tsx';
import './index.css';
import './responsive.css';
import './reference-layout.css';
import './final-approved-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
