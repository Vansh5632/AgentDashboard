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
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [showCalcomKey, setShowCalcomKey] = useState(false);
  
  // Form states
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("");
  const [calcomApiKey, setCalcomApiKey] = useState("");
  const [ghlWhatsappWebhook, setGhlWhatsappWebhook] = useState("");

  // Fetch current credentials
  const { data: elevenLabsData, isLoading: elevenLabsLoading } = useQuery({
    queryKey: ["credentials", "elevenlabs"],
    queryFn: async () => {
      const response = await credentialsApi.getElevenLabs();
      return response.data;
    },
  });

  const { data: calcomData, isLoading: calcomLoading } = useQuery({
    queryKey: ["credentials", "calcom"],
    queryFn: async () => {
      const response = await credentialsApi.getCalcom();
      return response.data;
    },
  });

  // Mutations
  const elevenLabsMutation = useMutation({
    mutationFn: (apiKey: string) => credentialsApi.setElevenLabs(apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials", "elevenlabs"] });
      setElevenLabsApiKey("");
    },
  });

  const calcomMutation = useMutation({
    mutationFn: (data: any) => credentialsApi.setCalcom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials", "calcom"] });
      setCalcomApiKey("");
      setGhlWhatsappWebhook("");
    },
  });

  const handleElevenLabsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (elevenLabsApiKey.trim()) {
      elevenLabsMutation.mutate(elevenLabsApiKey.trim());
    }
  };

  const handleCalcomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (calcomApiKey.trim()) {
      calcomMutation.mutate({
        calcomApiKey: calcomApiKey.trim(),
        ghlWhatsappWebhook: ghlWhatsappWebhook.trim() || undefined,
      });
    }
  };

  const isElevenLabsConfigured = elevenLabsData?.configured;
  const isCalcomConfigured = calcomData?.configured;

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
        {/* ElevenLabs API Configuration */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Key className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>ElevenLabs API Key</CardTitle>
                    <CardDescription>
                      Connect your ElevenLabs account to manage AI agents
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isElevenLabsConfigured ? "success" : "secondary"}>
                  {elevenLabsLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : isElevenLabsConfigured ? (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {isElevenLabsConfigured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleElevenLabsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    API Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showElevenLabsKey ? "text" : "password"}
                      placeholder={isElevenLabsConfigured ? "••••••••••••••••" : "Enter your ElevenLabs API key"}
                      value={elevenLabsApiKey}
                      onChange={(e) => setElevenLabsApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showElevenLabsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your API key from{" "}
                    <a href="https://elevenlabs.io/app/speech-synthesis/text-to-speech" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                      ElevenLabs Dashboard
                    </a>
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={elevenLabsMutation.isPending || !elevenLabsApiKey.trim()}
                  className="w-full"
                >
                  {elevenLabsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isElevenLabsConfigured ? "Update API Key" : "Save API Key"}
                </Button>
                {elevenLabsMutation.isError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-600">
                      Failed to save API key. Please check the key and try again.
                    </p>
                  </div>
                )}
                {elevenLabsMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-600">
                      ElevenLabs API key saved successfully!
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>

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
                    Cal.com API Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showCalcomKey ? "text" : "password"}
                      placeholder={isCalcomConfigured ? "••••••••••••••••" : "Enter your Cal.com API key"}
                      value={calcomApiKey}
                      onChange={(e) => setCalcomApiKey(e.target.value)}
                      className="pr-10"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    GoHighLevel WhatsApp Webhook (Optional)
                  </label>
                  <Input
                    type="url"
                    placeholder="https://hooks.zapier.com/hooks/..."
                    value={ghlWhatsappWebhook}
                    onChange={(e) => setGhlWhatsappWebhook(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Optional webhook URL for sending WhatsApp notifications after meeting bookings
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
                  {isCalcomConfigured ? "Update Configuration" : "Save Configuration"}
                </Button>
                {calcomMutation.isError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-600">
                      Failed to save configuration. Please check the settings and try again.
                    </p>
                  </div>
                )}
                {calcomMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-600">
                      Cal.com configuration saved successfully!
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
                  isElevenLabsConfigured ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isElevenLabsConfigured ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {isElevenLabsConfigured ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">AI Voice Agents</p>
                      <p className="text-sm text-gray-600">
                        {isElevenLabsConfigured ? "Ready to handle calls" : "Requires ElevenLabs API key"}
                      </p>
                    </div>
                  </div>
                </div>

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
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}