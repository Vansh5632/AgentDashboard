"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Phone, CheckCircle, PhoneForwarded, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { callsApi } from "@/lib/api";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ["callStats"],
    queryFn: async () => {
      const response = await callsApi.getStats(7);
      return response.data;
    },
  });

  const { data: recentCallsData } = useQuery({
    queryKey: ["recentCalls"],
    queryFn: async () => {
      const response = await callsApi.getAll({ limit: 5 });
      return response.data;
    },
  });

  const stats = statsData?.overview;
  const dailyVolume = statsData?.dailyVolume || [];
  const recentCalls = recentCallsData?.calls || [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Calculate trends from daily volume data
  const calculateTrend = (data: any[], key?: string) => {
    if (data.length < 2) return { change: "0%", trend: "up" };
    
    const recent = data.slice(-3).reduce((sum, item) => sum + (key ? item[key] : item.count), 0);
    const previous = data.slice(-6, -3).reduce((sum, item) => sum + (key ? item[key] : item.count), 0);
    
    if (previous === 0) return { change: recent > 0 ? "+100%" : "0%", trend: "up" };
    
    const changePercent = Math.round(((recent - previous) / previous) * 100);
    return {
      change: `${changePercent >= 0 ? "+" : ""}${changePercent}%`,
      trend: changePercent >= 0 ? "up" : "down"
    };
  };

  const callsTrend = calculateTrend(dailyVolume);
  const successRate = stats?.successRate || 0;
  const successTrend = { change: "N/A", trend: "up" }; // Would need historical data
  const callbacksTrend = { change: "N/A", trend: "up" }; // Would need historical data
  const durationTrend = { change: "N/A", trend: "up" }; // Would need historical data

  const statCards = [
    {
      title: "Total Calls",
      value: stats?.totalCalls || 0,
      change: callsTrend.change,
      trend: callsTrend.trend,
      icon: Phone,
      color: "bg-blue-500",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      change: successTrend.change,
      trend: successTrend.trend,
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "Callbacks",
      value: stats?.callbacksRequested || 0,
      change: callbacksTrend.change,
      trend: callbacksTrend.trend,
      icon: PhoneForwarded,
      color: "bg-orange-500",
    },
    {
      title: "Avg Duration",
      value: formatDuration(stats?.avgCallDuration || 0),
      change: durationTrend.change,
      trend: durationTrend.trend,
      icon: Clock,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.color} text-white`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="mt-1 flex items-center text-xs">
                  {stat.change !== "N/A" && (
                    <>
                      {stat.trend === "up" ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                      )}
                      <span
                        className={stat.trend === "up" ? "text-green-500" : "text-red-500"}
                      >
                        {stat.change}
                      </span>
                      <span className="ml-1 text-gray-500">from last week</span>
                    </>
                  )}
                  {stat.change === "N/A" && (
                    <span className="text-gray-400">Trend data unavailable</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Call Volume Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Calls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Latest incoming calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCalls.map((call: any) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Phone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {call.customerPhoneNumber || "Unknown"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {call.summary?.substring(0, 60)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        call.status === "COMPLETED"
                          ? "success"
                          : call.callbackRequested
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {call.callbackRequested ? "Callback" : call.status}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(call.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
              {recentCalls.length === 0 && (
                <p className="py-8 text-center text-gray-500">No calls yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
