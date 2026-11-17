import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { loadLocalSession } from './db/indexedDb.ts';
import { applyThemeToDocument, loadThemeFromStorage } from './utils/theme.ts';
import './index.css';

// Apply persisted theme synchronously before initial React mount to prevent theme flicker
const initialSession = loadLocalSession();
applyThemeToDocument(loadThemeFromStorage(initialSession.activeAccountId ?? 'local_default'));

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
