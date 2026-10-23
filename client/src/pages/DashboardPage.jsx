import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants';
import AdminDashboard from './dashboard/AdminDashboard';
import EmployeeDashboard from './dashboard/EmployeeDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  return user.role === ROLES.ADMIN ? <AdminDashboard /> : <EmployeeDashboard />;
}
