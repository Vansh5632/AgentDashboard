"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Key, Calendar, MessageSquare, Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { credentialsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showCalcomKey, setShowCalcomKey] = useState(false);
  
  // Form states
  const [calcomApiKey, setCalcomApiKey] = useState("");
  const [ghlWhatsappWebhook, setGhlWhatsappWebhook] = useState("");

  const { data: calcomData, isLoading: calcomLoading } = useQuery({
    queryKey: ["credentials", "calcom"],
    queryFn: async () => {
      const response = await credentialsApi.getCalcom();
      return response.data;
    },
  });

  // Mutations
  const calcomMutation = useMutation({
    mutationFn: (apiKey: string) => credentialsApi.setCalcom({ calcomApiKey: apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials", "calcom"] });
      setCalcomApiKey("");
    },
  });

  const ghlMutation = useMutation({
    mutationFn: (webhook: string) => credentialsApi.setCalcom({ ghlWhatsappWebhook: webhook }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials", "calcom"] });
      setGhlWhatsappWebhook("");
    },
  });

  const handleCalcomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (calcomApiKey.trim()) {
      calcomMutation.mutate(calcomApiKey.trim());
    }
  };

  const handleGhlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ghlWhatsappWebhook.trim()) {
      ghlMutation.mutate(ghlWhatsappWebhook.trim());
    }
  };

  const isCalcomConfigured = calcomData?.configured;
  const isGhlConfigured = calcomData?.configured && calcomData?.ghlWhatsappWebhook;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your API credentials and integration settings
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6"
      >
        {/* Cal.com API Configuration */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Cal.com Integration</CardTitle>
                    <CardDescription>
                      Configure meeting booking and calendar integration
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isCalcomConfigured ? "success" : "secondary"}>
                  {calcomLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : isCalcomConfigured ? (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {isCalcomConfigured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCalcomSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Cal.com API Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showCalcomKey ? "text" : "password"}
                      placeholder={isCalcomConfigured ? "••••••••••••••••" : "Enter your Cal.com API key"}
                      value={calcomApiKey}
                      onChange={(e) => setCalcomApiKey(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCalcomKey(!showCalcomKey)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showCalcomKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your API key from{" "}
                    <a href="https://app.cal.com/settings/developer/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Cal.com Settings
                    </a>
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={calcomMutation.isPending || !calcomApiKey.trim()}
                  className="w-full"
                >
                  {calcomMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isCalcomConfigured ? "Update API Key" : "Save API Key"}
                </Button>
                {calcomMutation.isError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-600">
                      Failed to save API key. Please check the key and try again.
                    </p>
                  </div>
                )}
                {calcomMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-600">
                      Cal.com API key saved successfully!
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* GoHighLevel WhatsApp Webhook */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Notifications</CardTitle>
                    <CardDescription>
                      Configure GoHighLevel webhook for WhatsApp notifications
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isGhlConfigured ? "success" : "secondary"}>
                  {calcomLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : isGhlConfigured ? (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {isGhlConfigured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGhlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Webhook URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://services.leadconnectorhq.com/hooks/..."
                    value={ghlWhatsappWebhook}
                    onChange={(e) => setGhlWhatsappWebhook(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    GoHighLevel workflow webhook URL for sending WhatsApp messages after meeting bookings
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={ghlMutation.isPending || !ghlWhatsappWebhook.trim()}
                  className="w-full"
                >
                  {ghlMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isGhlConfigured ? "Update Webhook" : "Save Webhook"}
                </Button>
                {ghlMutation.isError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-600">
                      Failed to save webhook. Please check the URL and try again.
                    </p>
                  </div>
                )}
                {ghlMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-600">
                      WhatsApp webhook saved successfully!
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Configuration Status */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>
                Overview of your configured integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className={cn(
                  "rounded-lg border p-4",
                  isCalcomConfigured ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isCalcomConfigured ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {isCalcomConfigured ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Meeting Booking</p>
                      <p className="text-sm text-gray-600">
                        {isCalcomConfigured ? "Ready to book meetings" : "Requires Cal.com API key"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "rounded-lg border p-4",
                  isGhlConfigured ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isGhlConfigured ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {isGhlConfigured ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">WhatsApp Notifications</p>
                      <p className="text-sm text-gray-600">
                        {isGhlConfigured ? "Active" : "Optional"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}