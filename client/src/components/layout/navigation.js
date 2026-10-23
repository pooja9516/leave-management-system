import { LayoutDashboard, CalendarPlus, ListChecks, Inbox, Users, CalendarDays, ClipboardList } from 'lucide-react';
import { ROLES } from '../../constants';

const ALL = Object.values(ROLES);
const APPLICANTS = [ROLES.EMPLOYEE, ROLES.MANAGER];

// Sidebar items per role. `badge: 'teamPending'` shows the manager's pending count.
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, end: true },
  { to: '/leaves', label: 'My leaves', icon: ListChecks, roles: APPLICANTS, end: true },
  { to: '/leaves/apply', label: 'Apply leave', icon: CalendarPlus, roles: APPLICANTS },
  { to: '/team', label: 'Team requests', icon: Inbox, roles: [ROLES.MANAGER], badge: 'teamPending' },
  { to: '/admin/leaves', label: 'All leaves', icon: ClipboardList, roles: [ROLES.ADMIN] },
  { to: '/admin/users', label: 'Users', icon: Users, roles: [ROLES.ADMIN] },
  { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays, roles: [ROLES.ADMIN] },
];
