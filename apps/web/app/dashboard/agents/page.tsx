"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Bot, 
  Plus, 
  Search, 
  Edit3,
  Trash2,
  RefreshCw,
  ExternalLink,
  Phone,
  User,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Agent, ElevenLabsAgent } from "@/types";

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

interface AgentFormData {
  name: string;
  persona: string;
  phoneNumber: string;
  elevenLabsVoiceId: string;
  elevenLabsAgentId: string;
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<AgentFormData>({
    name: "",
    persona: "",
    phoneNumber: "",
    elevenLabsVoiceId: "",
    elevenLabsAgentId: "",
  });

  // Fetch agents from database
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await agentsApi.getAll();
      return response.data;
    },
  });

  // Fetch ElevenLabs agents
  const { data: elevenLabsAgentsData, isLoading: elevenLabsLoading } = useQuery({
    queryKey: ["elevenlabs-agents"],
    queryFn: async () => {
      const response = await agentsApi.getElevenLabsAgents();
      return response.data;
    },
  });

  // Sync from ElevenLabs mutation
  const syncMutation = useMutation({
    mutationFn: () => agentsApi.syncFromElevenLabs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["elevenlabs-agents"] });
    },
  });

  // Create agent mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => agentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowCreateForm(false);
      resetForm();
    },
  });

  // Update agent mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => agentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setEditingAgent(null);
      resetForm();
    },
  });

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const agents = agentsData?.agents || [];
  const elevenLabsAgents = elevenLabsAgentsData?.agents || [];

  // Filter agents based on search query
  const filteredAgents = agents.filter((agent: Agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(query) ||
      agent.phoneNumber?.toLowerCase().includes(query) ||
      agent.elevenLabsAgentId?.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setFormData({
      name: "",
      persona: "",
      phoneNumber: "",
      elevenLabsVoiceId: "",
      elevenLabsAgentId: "",
    });
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || "",
      persona: agent.persona || "",
      phoneNumber: agent.phoneNumber || "",
      elevenLabsVoiceId: agent.elevenLabsVoiceId || "",
      elevenLabsAgentId: agent.elevenLabsAgentId || "",
    });
  };

  const handleSave = () => {
    if (editingAgent) {
      updateMutation.mutate({
        id: editingAgent.id,
        data: {
          name: formData.name,
          persona: formData.persona,
          phoneNumber: formData.phoneNumber || null,
          elevenLabsVoiceId: formData.elevenLabsVoiceId || null,
          elevenLabsAgentId: formData.elevenLabsAgentId || null,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        persona: formData.persona,
        phoneNumber: formData.phoneNumber || null,
        elevenLabsVoiceId: formData.elevenLabsVoiceId || null,
        elevenLabsAgentId: formData.elevenLabsAgentId || null,
      });
    }
  };

  const handleCancel = () => {
    setEditingAgent(null);
    setShowCreateForm(false);
    resetForm();
  };

  const handleDelete = (agent: Agent) => {
    if (confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
      deleteMutation.mutate(agent.id);
    }
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "Not set";
    return phone.startsWith("+") ? phone : `+${phone}`;
  };

  const getAgentStats = () => {
    const total = agents.length;
    const withPhoneNumbers = agents.filter((a: Agent) => a.phoneNumber).length;
    const synced = agents.filter((a: Agent) => a.elevenLabsAgentId).length;

    return { total, withPhoneNumbers, synced };
  };

  const stats = getAgentStats();

  if (agentsLoading) {
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
          <h1 className="text-3xl font-bold text-gray-900">AI Agents</h1>
          <p className="mt-2 text-gray-600">
            Manage your AI voice agents and ElevenLabs integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Sync from ElevenLabs
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-3"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Agents</p>
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
                  <p className="text-sm font-medium text-gray-600">ElevenLabs Synced</p>
                  <p className="text-2xl font-bold">{stats.synced}</p>
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
                  <Phone className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">With Phone Numbers</p>
                  <p className="text-2xl font-bold">{stats.withPhoneNumbers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ElevenLabs Agents Section */}
      {elevenLabsAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ElevenLabs Agents</CardTitle>
            <CardDescription>
              Agents available in your ElevenLabs account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {elevenLabsAgents.map((agent: ElevenLabsAgent) => (
                <div
                  key={agent.agent_id}
                  className={cn(
                    "rounded-lg border p-4 transition-all hover:shadow-sm",
                    agent.inDatabase ? "border-green-200 bg-green-50" : "border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{agent.name}</h3>
                      <p className="text-sm text-gray-600">Voice: {agent.voice_id}</p>
                      <p className="text-xs text-gray-500 mt-1">ID: {agent.agent_id}</p>
                    </div>
                    <Badge variant={agent.inDatabase ? "success" : "secondary"}>
                      {agent.inDatabase ? "Synced" : "Available"}
                    </Badge>
                  </div>
                  {agent.prompt && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {agent.prompt.substring(0, 100)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search agents by name, phone number, or ElevenLabs ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            Manage and configure your AI agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(showCreateForm || editingAgent) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg border border-blue-200 bg-blue-50 p-4"
              >
                <h3 className="font-medium text-gray-900 mb-4">
                  {editingAgent ? "Edit Agent" : "Create New Agent"}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Agent name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Phone Number</label>
                    <Input
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">ElevenLabs Agent ID</label>
                    <Input
                      value={formData.elevenLabsAgentId}
                      onChange={(e) => setFormData({ ...formData, elevenLabsAgentId: e.target.value })}
                      placeholder="agent_xxx"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Voice ID</label>
                    <Input
                      value={formData.elevenLabsVoiceId}
                      onChange={(e) => setFormData({ ...formData, elevenLabsVoiceId: e.target.value })}
                      placeholder="voice_xxx"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Persona</label>
                    <textarea
                      value={formData.persona}
                      onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                      placeholder="Describe the agent's personality and role..."
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleSave}
                    disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {editingAgent ? "Update" : "Create"} Agent
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
                {(createMutation.isError || updateMutation.isError) && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600">
                      Failed to {editingAgent ? "update" : "create"} agent. Please try again.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {filteredAgents.map((agent: Agent) => (
              <motion.div
                key={agent.id}
                whileHover={{ scale: 1.01 }}
                className="rounded-lg border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                      <Bot className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{agent.name}</h3>
                        {agent.elevenLabsAgentId ? (
                          <Badge variant="success">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Local Only
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(agent.phoneNumber)}
                        </span>
                        {agent.elevenLabsAgentId && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {agent.elevenLabsAgentId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {formatRelativeTime(agent.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEdit(agent)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(agent)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {agent.persona && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{agent.persona}</p>
                  </div>
                )}
              </motion.div>
            ))}

            {filteredAgents.length === 0 && !showCreateForm && (
              <div className="py-12 text-center">
                <Bot className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No agents found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery
                    ? "Try adjusting your search criteria."
                    : "Create your first AI agent to get started."}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateForm(true)} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}