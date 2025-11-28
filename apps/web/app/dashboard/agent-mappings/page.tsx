"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  GitBranch,
  Plus,
  Search,
  Edit3,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  X,
  Link2,
  User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentMappingsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import { AgentMapping, ElevenLabsAgent } from "@/types";

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

export default function AgentMappingsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AgentMapping | null>(null);
  const [showAvailableAgents, setShowAvailableAgents] = useState(false);
  
  const [formData, setFormData] = useState({
    agentId: "",
    agentName: "",
    notes: "",
  });

  // Fetch mappings
  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ["agent-mappings"],
    queryFn: async () => {
      const response = await agentMappingsApi.getAll();
      return response.data;
    },
  });

  // Fetch available agents from ElevenLabs
  const { data: availableAgentsData, isLoading: availableAgentsLoading, refetch: refetchAvailable } = useQuery({
    queryKey: ["available-agents"],
    queryFn: async () => {
      const response = await agentMappingsApi.getAvailableAgents();
      return response.data;
    },
    enabled: showAvailableAgents,
  });

  // Create mapping mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => agentMappingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["available-agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      resetForm();
      setShowAddForm(false);
    },
  });

  // Update mapping mutation
  const updateMutation = useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: Partial<typeof formData> }) =>
      agentMappingsApi.update(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setEditingMapping(null);
      resetForm();
    },
  });

  // Delete mapping mutation
  const deleteMutation = useMutation({
    mutationFn: (agentId: string) => agentMappingsApi.delete(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["available-agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const mappings = mappingsData?.mappings || [];
  const availableAgents = availableAgentsData?.agents || [];

  // Filter mappings based on search query
  const filteredMappings = mappings.filter((mapping: AgentMapping) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      mapping.agentId?.toLowerCase().includes(query) ||
      mapping.agentName?.toLowerCase().includes(query) ||
      mapping.notes?.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setFormData({
      agentId: "",
      agentName: "",
      notes: "",
    });
  };

  const handleEdit = (mapping: AgentMapping) => {
    setEditingMapping(mapping);
    setFormData({
      agentId: mapping.agentId,
      agentName: mapping.agentName || "",
      notes: mapping.notes || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMapping) {
      updateMutation.mutate({
        agentId: editingMapping.agentId,
        data: {
          agentName: formData.agentName || undefined,
          notes: formData.notes || undefined,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleQuickMap = (agent: ElevenLabsAgent) => {
    setFormData({
      agentId: agent.agent_id,
      agentName: agent.name,
      notes: "",
    });
    setShowAddForm(true);
    setShowAvailableAgents(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Mappings</h1>
          <p className="text-gray-600 mt-1">
            Map agent IDs to your account
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setShowAvailableAgents(!showAvailableAgents);
              if (!showAvailableAgents) refetchAvailable();
            }}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Browse Available Agents
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) resetForm();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-3"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Link2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{mappings.length}</p>
                  <p className="text-sm text-gray-600">Total Mappings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {availableAgentsData?.mappedToYou || 0}
                  </p>
                  <p className="text-sm text-gray-600">Mapped to You</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <GitBranch className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {availableAgentsData?.available || 0}
                  </p>
                  <p className="text-sm text-gray-600">Available to Map</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Available Agents Panel */}
      {showAvailableAgents && (
        <Card>
          <CardHeader>
            <CardTitle>Available Agents</CardTitle>
            <CardDescription>
              Click on an agent to map it to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableAgentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : availableAgents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No agents found
              </div>
            ) : (
              <div className="space-y-2">
                {availableAgents.map((agent: ElevenLabsAgent) => (
                  <div
                    key={agent.agent_id}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg",
                      agent.isMappedToCurrentTenant
                        ? "bg-green-50 border-green-200"
                        : agent.isMappedToOtherTenant
                        ? "bg-gray-50 border-gray-200 opacity-60"
                        : "bg-white border-gray-200 hover:border-blue-300 cursor-pointer"
                    )}
                    onClick={() => {
                      if (!agent.isMapped) {
                        handleQuickMap(agent);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{agent.agent_id}</p>
                    </div>
                    <div>
                      {agent.isMappedToCurrentTenant ? (
                        <Badge variant="success">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Mapped to You
                        </Badge>
                      ) : agent.isMappedToOtherTenant ? (
                        <Badge variant="secondary">Mapped to Another Account</Badge>
                      ) : (
                        <Button size="sm" onClick={() => handleQuickMap(agent)}>
                          <Plus className="mr-1 h-3 w-3" />
                          Map
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingMapping) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingMapping ? "Edit" : "Add"} Agent Mapping</CardTitle>
            <CardDescription>
              {editingMapping
                ? "Update the agent mapping details"
                : "Map an agent_id to your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Agent ID</label>
                <Input
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  placeholder="agent_2601k805rvfwe34vxtn6z4ds63x7"
                  disabled={!!editingMapping}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  The agent_id from your agent configuration
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Agent Name (Optional)</label>
                <Input
                  value={formData.agentName}
                  onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                  placeholder="Sales Agent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this agent..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  {editingMapping ? "Update" : "Create"} Mapping
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingMapping(null);
                    resetForm();
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mappings List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Agent Mappings</CardTitle>
              <CardDescription>
                Manage which agents are mapped to your account
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search mappings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No agent mappings</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first agent mapping.
              </p>
              <div className="mt-6">
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Mapping
                </Button>
              </div>
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
              {filteredMappings.map((mapping: AgentMapping) => (
                <motion.div
                  key={mapping.id}
                  variants={item}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {mapping.agentName || "Unnamed Agent"}
                      </h4>
                      <Badge variant="outline">
                        <User className="mr-1 h-3 w-3" />
                        {mapping.user?.email}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 font-mono mb-1">{mapping.agentId}</p>
                    {mapping.notes && (
                      <p className="text-sm text-gray-600 mt-2">{mapping.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Created {formatRelativeTime(mapping.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(mapping)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete the mapping for ${mapping.agentId}?`)) {
                          deleteMutation.mutate(mapping.agentId);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
