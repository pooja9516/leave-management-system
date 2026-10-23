import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import Brand from '../Brand';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from './navigation';
import { useTeamPendingCount } from '../../hooks/useTeamPendingCount';
import { ROLES } from '../../constants';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const badges = { teamPending: useTeamPendingCount(user.role === ROLES.MANAGER) };

  return (
    <aside id="app-sidebar" className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Sidebar">
      <div className="sidebar__brand">
        <Brand />
        <Button variant="ghost" size="sm" icon className="sidebar__close" onClick={onClose} aria-label="Close menu">
          <X aria-hidden="true" />
        </Button>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        <p className="sidebar__section-label">Menu</p>
        <ul className="nav-list">
          {items.map(({ to, label, icon: Icon, end, badge }) => {
            const count = badge ? badges[badge] : 0;
            return (
              <li key={to}>
                <NavLink to={to} end={end} className="nav-link">
                  <Icon aria-hidden="true" />
                  <span className="nav-link__label">{label}</span>
                  {count > 0 && (
                    <span className="nav-link__badge" aria-label={`${count} pending`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <Avatar name={user.name} />
        <div className="sidebar__user">
          <p className="sidebar__user-name" title={user.name}>
            {user.name}
          </p>
          <p className="sidebar__user-role">{user.role}</p>
        </div>
        <Button variant="ghost" size="sm" icon onClick={() => logout()} aria-label="Sign out" title="Sign out">
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}
