"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  User,
  Mail,
  Phone,
  ExternalLink,
  MessageSquare,
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { meetingsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Meeting } from "@/types";

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
  PENDING: { label: "Pending", color: "bg-yellow-500", icon: Clock, variant: "warning" as const },
  CONFIRMED: { label: "Confirmed", color: "bg-green-500", icon: CheckCircle, variant: "success" as const },
  FAILED: { label: "Failed", color: "bg-red-500", icon: X, variant: "destructive" as const },
  CANCELLED: { label: "Cancelled", color: "bg-gray-500", icon: X, variant: "secondary" as const },
  WHATSAPP_SENT: { label: "WhatsApp Sent", color: "bg-green-600", icon: MessageSquare, variant: "success" as const },
  WHATSAPP_FAILED: { label: "WhatsApp Failed", color: "bg-red-600", icon: AlertTriangle, variant: "destructive" as const },
};

export default function MeetingsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const { data: meetingsData, isLoading } = useQuery({
    queryKey: ["meetings", searchQuery, statusFilter, currentPage],
    queryFn: async () => {
      const params: any = {
        limit,
        offset: (currentPage - 1) * limit,
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const response = await meetingsApi.getAll(params);
      return response.data;
    },
  });

  const meetings = meetingsData?.meetings || [];
  const totalMeetings = meetingsData?.total || 0;
  const totalPages = Math.ceil(totalMeetings / limit);

  // Filter meetings based on search query
  const filteredMeetings = meetings.filter((meeting: Meeting) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.customerName?.toLowerCase().includes(query) ||
      meeting.customerEmail?.toLowerCase().includes(query) ||
      meeting.customerPhoneNumber?.toLowerCase().includes(query)
    );
  });

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return null;
    return phone.startsWith("+") ? phone : `+${phone}`;
  };

  const handleMeetingSelect = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  const getMeetingStats = () => {
    const total = meetings.length;
    const confirmed = meetings.filter((m: Meeting) => m.status === "CONFIRMED").length;
    const pending = meetings.filter((m: Meeting) => m.status === "PENDING").length;
    const failed = meetings.filter((m: Meeting) => m.status === "FAILED").length;

    return { total, confirmed, pending, failed };
  };

  const stats = getMeetingStats();

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
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="mt-2 text-gray-600">
            Manage scheduled meetings and bookings
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
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Meetings</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-sm font-medium text-gray-600">Confirmed</p>
                  <p className="text-2xl font-bold">{stats.confirmed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
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
                  placeholder="Search by customer name, email, or phone..."
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

      {/* Meetings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting History</CardTitle>
          <CardDescription>
            {filteredMeetings.length} meetings found • Page {currentPage} of {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMeetings.map((meeting: Meeting) => {
              const statusConfig = getStatusConfig(meeting.status);
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div
                  key={meeting.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-lg border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm cursor-pointer"
                  onClick={() => handleMeetingSelect(meeting)}
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
                            {meeting.customerName || "Unknown Customer"}
                          </p>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                          {meeting.whatsappSent && (
                            <Badge variant="outline">
                              <MessageSquare className="mr-1 h-3 w-3" />
                              WhatsApp
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          {meeting.customerEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {meeting.customerEmail}
                            </span>
                          )}
                          {meeting.customerPhoneNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatPhoneNumber(meeting.customerPhoneNumber)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(meeting.meetingTime)}
                          </span>
                          <span>Duration: {meeting.duration} min</span>
                          <span>Created {formatRelativeTime(meeting.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meeting.meetingLink && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredMeetings.length === 0 && (
              <div className="py-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search criteria."
                    : "No meetings have been scheduled yet."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing {(currentPage - 1) * limit + 1} to{" "}
                {Math.min(currentPage * limit, totalMeetings)} of {totalMeetings} results
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

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMeeting(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Meeting Details</h2>
                <Button variant="ghost" onClick={() => setSelectedMeeting(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-3">Customer Information</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Name</label>
                      <p className="text-sm font-medium">
                        {selectedMeeting.customerName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Email</label>
                      <p className="text-sm font-medium">
                        {selectedMeeting.customerEmail || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Phone</label>
                      <p className="text-sm font-medium">
                        {formatPhoneNumber(selectedMeeting.customerPhoneNumber) || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Meeting Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-3">Meeting Information</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Status</label>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusConfig(selectedMeeting.status).variant}>
                          {getStatusConfig(selectedMeeting.status).label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Duration</label>
                      <p className="text-sm font-medium">{selectedMeeting.duration} minutes</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Scheduled Time</label>
                      <p className="text-sm font-medium">
                        {formatDateTime(selectedMeeting.meetingTime)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Timezone</label>
                      <p className="text-sm font-medium">{selectedMeeting.timezone}</p>
                    </div>
                  </div>
                </div>

                {/* Meeting Link */}
                {selectedMeeting.meetingLink && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-3">Meeting Link</h3>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                      <a 
                        href={selectedMeeting.meetingLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {selectedMeeting.meetingLink}
                      </a>
                    </div>
                  </div>
                )}

                {/* WhatsApp Status */}
                {selectedMeeting.whatsappSent && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-3">WhatsApp Notification</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      <span>Sent at {selectedMeeting.whatsappSentAt ? formatDateTime(selectedMeeting.whatsappSentAt) : "Unknown"}</span>
                    </div>
                    {selectedMeeting.whatsappError && (
                      <div className="mt-2 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600">{selectedMeeting.whatsappError}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selectedMeeting.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-3">Notes</h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm">{selectedMeeting.notes}</p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {selectedMeeting.errorMessage && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-3">Error</h3>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">{selectedMeeting.errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* System Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-3">System Information</h3>
                  <div className="grid gap-3 md:grid-cols-2 text-xs text-gray-500">
                    <div>
                      <label className="font-medium">Meeting ID</label>
                      <p>{selectedMeeting.id}</p>
                    </div>
                    {selectedMeeting.calcomEventId && (
                      <div>
                        <label className="font-medium">Cal.com Event ID</label>
                        <p>{selectedMeeting.calcomEventId}</p>
                      </div>
                    )}
                    {selectedMeeting.conversationId && (
                      <div>
                        <label className="font-medium">Conversation ID</label>
                        <p>{selectedMeeting.conversationId}</p>
                      </div>
                    )}
                    <div>
                      <label className="font-medium">Created</label>
                      <p>{formatDateTime(selectedMeeting.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}