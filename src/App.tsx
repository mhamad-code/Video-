import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useI18n } from './lib/i18n';
import Dashboard from './pages/Dashboard';

const Workspace = lazy(() => import('./pages/Workspace'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="shell">
      <nav className="nav glass" aria-label="main">
        <Link to="/" className="brand">DarsAI</Link>
        <div className="row">
          <Link to="/" className="btn ghost">{t('home')}</Link>
          <Link to="/settings" className="btn ghost">{t('settings')}</Link>
          <button className="btn ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="Language">
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </nav>
      <main>
        <Suspense fallback={<p className="muted" role="status">…</p>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/p/:id" element={<Workspace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
