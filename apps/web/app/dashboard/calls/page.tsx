"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Phone, 
  Search, 
  Filter, 
  Download, 
  Eye,
  PhoneForwarded,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  Calendar,
  User,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { callsApi } from "@/lib/api";
import { formatDuration, formatRelativeTime, cn } from "@/lib/utils";
import { CallLog } from "@/types";

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

const statusConfig = {
  COMPLETED: { label: "Completed", color: "bg-green-500", icon: CheckCircle, variant: "success" as const },
  FAILED: { label: "Failed", color: "bg-red-500", icon: X, variant: "destructive" as const },
  NO_PICKUP: { label: "No Pickup", color: "bg-yellow-500", icon: PhoneForwarded, variant: "warning" as const },
  CALLBACK_NEEDED: { label: "Callback Needed", color: "bg-orange-500", icon: PhoneForwarded, variant: "warning" as const },
  CALLBACK_SCHEDULED: { label: "Callback Scheduled", color: "bg-blue-500", icon: Clock, variant: "secondary" as const },
  CALLBACK_COMPLETED: { label: "Callback Completed", color: "bg-green-600", icon: CheckCircle, variant: "success" as const },
  APPOINTMENT_BOOKED: { label: "Appointment Booked", color: "bg-purple-500", icon: Calendar, variant: "secondary" as const },
  PROCESSING: { label: "Processing", color: "bg-gray-500", icon: Clock, variant: "secondary" as const },
};

export default function CallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const { data: callsData, isLoading } = useQuery({
    queryKey: ["calls", searchQuery, statusFilter, currentPage],
    queryFn: async () => {
      const params: any = {
        limit,
        offset: (currentPage - 1) * limit,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const response = await callsApi.getAll(params);
      return response.data;
    },
  });

  const calls = callsData?.calls || [];
  const stats = callsData?.stats || {};
  const totalCalls = callsData?.total || 0;
  const totalPages = Math.ceil(totalCalls / limit);

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.PROCESSING;
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "Unknown";
    return phone.startsWith("+") ? phone : `+${phone}`;
  };

  const handleCallSelect = (call: CallLog) => {
    setSelectedCall(call);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calls</h1>
          <p className="mt-2 text-gray-600">
            Manage and analyze your AI agent calls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold">{stats.totalCalls || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedCalls || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                  <PhoneForwarded className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Callbacks</p>
                  <p className="text-2xl font-bold">{stats.callbacksRequested || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(stats.avgCallDuration || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by phone number or conversation ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t pt-4"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    >
                      <option value="all">All Statuses</option>
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <option key={status} value={status}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
          <CardDescription>
            {totalCalls} total calls • Page {currentPage} of {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calls.map((call: CallLog) => {
              const statusConfig = getStatusConfig(call.status);
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div
                  key={call.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-lg border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm cursor-pointer"
                  onClick={() => handleCallSelect(call)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        statusConfig.color.replace("bg-", "bg-").replace("-500", "-100"),
                        "text-white"
                      )}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {formatPhoneNumber(call.customerPhoneNumber)}
                          </p>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                          {call.callbackRequested && (
                            <Badge variant="outline">
                              <PhoneForwarded className="mr-1 h-3 w-3" />
                              Callback
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {call.summary ? `${call.summary.substring(0, 100)}...` : "No summary available"}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {call.callDuration ? formatDuration(call.callDuration) : "Unknown"}
                          </span>
                          <span>{formatRelativeTime(call.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.leadStatus && (
                        <Badge variant="secondary">
                          {call.leadStatus}
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {calls.length === 0 && (
              <div className="py-12 text-center">
                <Phone className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No calls found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search criteria."
                    : "Your AI agents haven't received any calls yet."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing {(currentPage - 1) * limit + 1} to{" "}
                {Math.min(currentPage * limit, totalCalls)} of {totalCalls} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Modal */}
      {selectedCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCall(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Call Details</h2>
                <Button variant="ghost" onClick={() => setSelectedCall(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer Phone</label>
                    <p className="text-lg font-medium">
                      {formatPhoneNumber(selectedCall.customerPhoneNumber)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusConfig(selectedCall.status).variant}>
                        {getStatusConfig(selectedCall.status).label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Duration</label>
                    <p className="text-lg font-medium">
                      {formatDuration(selectedCall.callDuration || 0)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date</label>
                    <p className="text-lg font-medium">
                      {new Date(selectedCall.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {selectedCall.summary && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Summary</label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm">{selectedCall.summary}</p>
                    </div>
                  </div>
                )}

                {selectedCall.callbackRequested && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Callback Information</label>
                    <div className="mt-2 space-y-2">
                      {selectedCall.callbackReason && (
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span> {selectedCall.callbackReason}
                        </p>
                      )}
                      {selectedCall.callbackScheduledAt && (
                        <p className="text-sm">
                          <span className="font-medium">Scheduled:</span> {" "}
                          {new Date(selectedCall.callbackScheduledAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedCall.leadStatus && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Lead Status</label>
                    <p className="text-lg font-medium">{selectedCall.leadStatus}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}