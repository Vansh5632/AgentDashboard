"use client";

import { Bell, User } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { motion } from "framer-motion";

export default function Header() {
  const user = useAuthStore((state) => state.user);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Welcome back, manage your AI agents</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-full p-2 hover:bg-gray-100"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </motion.button>

        {/* User Menu */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 rounded-lg bg-gray-100 px-3 py-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user?.email}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
