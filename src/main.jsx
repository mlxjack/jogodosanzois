import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GameApp from './engine/GameApp.jsx';

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <GameApp gameId="anzois" logo="logo.webp" />
  </StrictMode>,
);
