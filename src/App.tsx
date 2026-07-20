import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import RecordPage from './pages/RecordPage';
import CheckPage from './pages/CheckPage';
import ChecklistManagePage from './pages/ChecklistManagePage';
import CalendarPage from './pages/CalendarPage';
import WeekPage from './pages/WeekPage';
import SettingsPage from './pages/SettingsPage';
import { useAuth } from './lib/useAuth';

export default function App() {
  // アプリ全体で認証状態を購読する。どの画面にいても
  // 起動時・ログイン成立時・オンライン復帰時のクラウド同期が動くようにする
  useAuth();
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/record" replace />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/record/:date" element={<RecordPage />} />
          <Route path="/check" element={<CheckPage />} />
          <Route path="/check/manage" element={<ChecklistManagePage />} />
          <Route path="/check/:date" element={<CheckPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/record" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
