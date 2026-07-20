import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/record', label: '記録', icon: '✍️' },
  { to: '/check', label: 'チェック', icon: '✅' },
  { to: '/calendar', label: 'カレンダー', icon: '📅' },
  { to: '/week', label: '週', icon: '🗓️' },
  { to: '/settings', label: '設定', icon: '⚙️' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => 'bottom-nav__item' + (isActive ? ' is-active' : '')}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
