"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/auth-session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthSessionProvider>{children}</AuthSessionProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </ThemeProvider>
  );
}
