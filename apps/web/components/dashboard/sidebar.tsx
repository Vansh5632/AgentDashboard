"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Phone, 
  Calendar, 
  Bot, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GitBranch
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calls", href: "/dashboard/calls", icon: Phone },
  { name: "Meetings", href: "/dashboard/meetings", icon: Calendar },
  { name: "Agents", href: "/dashboard/agents", icon: Bot },
  { name: "Agent Mappings", href: "/dashboard/agent-mappings", icon: GitBranch },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0, width: isCollapsed ? 80 : 256 }}
      className="relative border-r border-gray-200 bg-white shadow-sm"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-gray-900">AI Agent</span>
            </motion.div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {!isCollapsed && <span>{item.name}</span>}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-4">
          <motion.button
            whileHover={{ x: 4 }}
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Logout</span>}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
}
