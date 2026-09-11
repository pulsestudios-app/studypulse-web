import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { AuthCallbackPage } from "./auth/AuthCallbackPage";
import { AuthProvider } from "./auth/AuthProvider";
import { RedirectIfAuthed, RequireAuth } from "./auth/guards";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { SignInPage } from "./auth/SignInPage";
import { SignUpPage } from "./auth/SignUpPage";
import { AppShell } from "./components/AppShell";
import { CrashFallback, NotFoundPage } from "./components/NotFoundPage";
import { LibraryPage } from "./library/LibraryPage";
import { queryClient } from "./lib/queryClient";
import { ResultPlaceholderPage } from "./results/ResultPlaceholderPage";
import { SettingsPage } from "./settings/SettingsPage";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/library" replace /> },
  {
    path: "/auth",
    errorElement: <CrashFallback />,
    children: [
      { index: true, element: <Navigate to="/auth/sign-in" replace /> },
      {
        element: <RedirectIfAuthed />,
        children: [
          { path: "sign-in", element: <SignInPage /> },
          { path: "sign-up", element: <SignUpPage /> },
        ],
      },
      { path: "reset", element: <ResetPasswordPage /> },
      { path: "callback", element: <AuthCallbackPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <CrashFallback />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "library", element: <LibraryPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "results/:id", element: <ResultPlaceholderPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

export function App() {
  return (
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}
