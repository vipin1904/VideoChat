import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

const HomePage          = React.lazy(() => import("./pages/HomePage.jsx"));
const SignUpPage        = React.lazy(() => import("./pages/SignUpPage.jsx"));
const LoginPage         = React.lazy(() => import("./pages/LoginPage.jsx"));
const NotificationsPage = React.lazy(() => import("./pages/NotificationsPage.jsx"));
const CallPage          = React.lazy(() => import("./pages/CallPage.jsx"));
const ChatPage          = React.lazy(() => import("./pages/ChatPage.jsx"));
const OnboardingPage    = React.lazy(() => import("./pages/OnboardingPage.jsx"));
const FriendsPage       = React.lazy(() => import("./pages/FriendsPage.jsx"));

import { Toaster } from "react-hot-toast";
import PageLoader from "./components/PageLoader.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import Layout from "./components/Layout.jsx";
import { useThemeStore } from "./store/useThemeStore.js";

const App = () => {
  const { isLoading, authUser } = useAuthUser();
  const { theme } = useThemeStore();

  const isAuthenticated = Boolean(authUser);
  const isOnboarded     = authUser?.isOnboarded;

  if (isLoading) return <PageLoader />;

  const authRedirect = <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />;

  return (
    <div className="h-screen" data-theme={theme}>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Home ── */}
          <Route path="/" element={
            isAuthenticated && isOnboarded
              ? <Layout showSidebar={true}><HomePage /></Layout>
              : authRedirect
          } />

          {/* ── Friends / Contacts ── */}
          <Route path="/friends" element={
            isAuthenticated && isOnboarded
              ? <Layout showSidebar={true}><FriendsPage /></Layout>
              : authRedirect
          } />

          {/* ── Notifications ── */}
          <Route path="/notifications" element={
            isAuthenticated && isOnboarded
              ? <Layout showSidebar={true}><NotificationsPage /></Layout>
              : authRedirect
          } />

          {/* ── Chat ── */}
          <Route path="/chat/:id" element={
            isAuthenticated && isOnboarded
              ? <Layout showSidebar={false}><ChatPage /></Layout>
              : authRedirect
          } />

          {/* ── Video / Audio Call (full screen, no layout wrapper) ── */}
          <Route path="/call/:id" element={
            isAuthenticated && isOnboarded ? <CallPage /> : authRedirect
          } />

          {/* ── Auth ── */}
          <Route path="/signup" element={
            !isAuthenticated ? <SignUpPage /> : <Navigate to={isOnboarded ? "/" : "/onboarding"} />
          } />
          <Route path="/login" element={
            !isAuthenticated ? <LoginPage /> : <Navigate to={isOnboarded ? "/" : "/onboarding"} />
          } />

          {/* ── Onboarding ── */}
          <Route path="/onboarding" element={
            isAuthenticated
              ? (!isOnboarded ? <OnboardingPage /> : <Navigate to="/" />)
              : <Navigate to="/login" />
          } />

        </Routes>
      </Suspense>

      <Toaster />
    </div>
  );
};

export default App;
