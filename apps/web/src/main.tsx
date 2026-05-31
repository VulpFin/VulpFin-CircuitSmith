import React from 'react';
import ReactDOM from 'react-dom/client';
import { BRANDING } from '@vfcs/circuit-model';
import App from './App.js';
import './styles/index.css';

document.title = `${BRANDING.appName} (${BRANDING.shortName})`;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);