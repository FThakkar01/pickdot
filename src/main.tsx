import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initClarity, tag } from './lib/clarity';
import { pingVisit } from './lib/notify';
import { browserId, hasBrowserId } from './lib/storage';
import './styles.css';

const returning = hasBrowserId();
browserId(); // mint the id now so the next visit counts as returning
initClarity();
tag('returning', String(returning));
pingVisit(returning);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
