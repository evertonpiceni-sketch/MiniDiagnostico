import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './asaas-cpf-fix';
import './payment-fix';
import './pix-only';
import App from './App.tsx';
import './index.css';
import './responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
