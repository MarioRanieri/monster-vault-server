import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';
import App from './App.tsx';
import { registerSW } from './pwa';

registerSW();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
