import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './asaas-cpf-fix';
import './payment-fix-safe';
import App from './App.tsx';
import './index.css';
import './responsive.css';
import './reference-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
