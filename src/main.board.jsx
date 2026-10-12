import React from 'react';
import ReactDOM from 'react-dom/client';
import BoardApp from './App.board.jsx';
import { ErrorBoundary } from './board/ErrorBoundary.jsx';
import { initDiagnostics } from './diagnostics.js';
import { startAnalyticsIfAllowed } from './consent.js';

initDiagnostics();
// The Google tag is no longer in index.board.html. This loads it, and only
// when the user has allowed analytics. Removing the static tag without
// this call is how Notebook sent nothing at all for a week (Oct 2026).
startAnalyticsIfAllowed();

// The boundary sits outside BoardApp so a throw anywhere in the tree —
// including BoardApp's own render — lands on the fallback panel instead
// of a blank screen.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BoardApp />
  </ErrorBoundary>,
);
