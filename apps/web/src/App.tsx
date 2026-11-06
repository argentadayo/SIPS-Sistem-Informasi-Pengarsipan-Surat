import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./lib/toast";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SuratMasukPage } from "./pages/SuratMasukPage";
import { SuratKeluarPage } from "./pages/SuratKeluarPage";
import { MasterPage } from "./pages/MasterPage";
import { UsersPage } from "./pages/UsersPage";
import { NotificationsPage } from "./pages/NotificationsPage";

function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
        <div className="spinner" />
        <p className="text-sm font-medium text-muted">Memuat sesi…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Private>
              <Layout>
                <ErrorBoundary label="Halaman">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route
                      path="/surat-masuk"
                      element={
                        <ErrorBoundary label="Surat Masuk">
                          <SuratMasukPage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/surat-keluar"
                      element={
                        <ErrorBoundary label="Surat Keluar">
                          <SuratKeluarPage />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/master" element={<MasterPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ErrorBoundary>
              </Layout>
            </Private>
          }
        />
      </Routes>
    </ToastProvider>
  );
}
