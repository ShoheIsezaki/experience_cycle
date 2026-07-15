import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import RecordPage from './pages/RecordPage';
import CalendarPage from './pages/CalendarPage';
import WeekPage from './pages/WeekPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/record" replace />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/record/:date" element={<RecordPage />} />
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
