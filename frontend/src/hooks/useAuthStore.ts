import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState, User } from "../types";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: null,
      isAuthenticated: false,
      login: (access_token: string, refreshToken: string, user: User) => {
        localStorage.setItem("refresh_token", refreshToken);
        set({ user, access_token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem("refresh_token");
        set({ user: null, access_token: null, isAuthenticated: false });
      },
    }),
    {
      name: "ged-auth",
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
