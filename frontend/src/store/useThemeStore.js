import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("videochat-theme") || "coffee",
  setTheme: (theme) => {
    localStorage.setItem("videochat-theme", theme);
    set({ theme });
  },
}));
