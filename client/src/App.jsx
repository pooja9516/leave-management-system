import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { GuestOnly, RequireAuth } from './components/RouteGuards';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ApplyLeavePage from './pages/leaves/ApplyLeavePage';
import MyLeavesPage from './pages/leaves/MyLeavesPage';
import TeamRequestsPage from './pages/team/TeamRequestsPage';
import UsersPage from './pages/admin/UsersPage';
import HolidaysPage from './pages/admin/HolidaysPage';
import AllLeavesPage from './pages/admin/AllLeavesPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROLES } from './constants';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route element={<RequireAuth roles={[ROLES.EMPLOYEE, ROLES.MANAGER]} />}>
                  <Route path="/leaves" element={<MyLeavesPage />} />
                  <Route path="/leaves/apply" element={<ApplyLeavePage />} />
                </Route>
                <Route element={<RequireAuth roles={[ROLES.MANAGER]} />}>
                  <Route path="/team" element={<TeamRequestsPage />} />
                </Route>
                <Route element={<RequireAuth roles={[ROLES.ADMIN]} />}>
                  <Route path="/admin/leaves" element={<AllLeavesPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/holidays" element={<HolidaysPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
