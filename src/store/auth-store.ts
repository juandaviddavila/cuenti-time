import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, UserRole } from "@/types/user";
import { canManageIntegrations } from "@/lib/user-permissions";

interface AuthState {
  user: User | null;
  /** In-memory only — NOT persisted. The real auth token lives in the httpOnly cookie set by the server. */
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User, accessToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasIntegrationAccess: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null, // in-memory only; not persisted (see partialize below)
      isAuthenticated: false,
      isLoading: false,

      setUser: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      // Does NOT clear httpOnly cookies — call /api/auth/logout first, then this.
      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      setLoading: (loading) => set({ isLoading: loading }),

      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },

      hasIntegrationAccess: () => {
        const { user } = get();
        if (!user) return false;
        return canManageIntegrations(user);
      },
    }),
    {
      name: "faceaccess-auth",
      storage: createJSONStorage(() => localStorage),
      // SECURITY: Only persist the user profile, NEVER the token.
      // The token lives exclusively in the httpOnly cookie managed by the server.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
