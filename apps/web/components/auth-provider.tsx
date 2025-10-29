"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if there's a token in localStorage on mount
    const token = localStorage.getItem('token');
    if (token) {
      // Token exists, mark as authenticated
      useAuthStore.setState({ 
        token, 
        isAuthenticated: true 
      });
    }
    setIsHydrated(true);
  }, []);

  // Show nothing until hydrated to prevent flash of unauthenticated state
  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
