import React, { useState, useEffect } from "react";
import {
  Bot,
  FolderOpen,
  Plus,
  Package,
  Sparkles,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ClaudeExtensionsManagerProps {
  projectPath?: string;
  className?: string;
  onBack?: () => void;
}

interface PluginInfo {
  name: string;
  description?: string;
  version: string;
  author?: string;
  marketplace?: string;
  path: string;
  enabled: boolean;
  components: {
    commands: number;
    agents: number;
    skills: number;
    hooks: number;
    mcpServers: number;
  };
}

interface AgentFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

interface SkillFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

/**
 * Claude Extensions Manager
 *
 * According to the official docs, manages:
 * - Subagents: Markdown files under .claude/agents/
 * - Agent Skills: SKILL.md files under .claude/skills/
 * - Slash Commands: Managed by a separate manager
 */
export const ClaudeExtensionsManager: React.FC<ClaudeExtensionsManagerProps> = ({
  projectPath,
  className,
  onBack
}) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [agents, setAgents] = useState<AgentFile[]>([]);
  const [skills, setSkills] = useState<SkillFile[]>([]);
  const [activeTab, setActiveTab] = useState("plugins");
  const [loading, setLoading] = useState(false);

  // Load plugins
  const loadPlugins = async () => {
    try {
      setLoading(true);
      const result = await api.listPlugins(projectPath);
      setPlugins(result);
      console.log('[ClaudeExtensions] Loaded', result.length, 'plugins');
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load subagents
  const loadAgents = async () => {
    try {
      setLoading(true);
      const result = await api.listSubagents(projectPath);
      setAgents(result);
      console.log('[ClaudeExtensions] Loaded', result.length, 'subagents');
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Agent Skills
  const loadSkills = async () => {
    try {
      setLoading(true);
      const result = await api.listAgentSkills(projectPath);
      setSkills(result);
      console.log('[ClaudeExtensions] Loaded', result.length, 'skills');
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open plugins directory
  const handleOpenPluginsDir = async () => {
    try {
      const dirPath = await api.openPluginsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open plugins directory:', error);
    }
  };

  const handleOpenAgentsDir = async () => {
    try {
      const dirPath = await api.openAgentsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open agents directory:', error);
    }
  };

  const handleOpenSkillsDir = async () => {
    try {
      const dirPath = await api.openSkillsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open skills directory:', error);
    }
  };

  useEffect(() => {
    loadPlugins();
    loadAgents();
    loadSkills();
  }, [projectPath]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Back button */}
      {onBack && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Claude Extensions Manager</h2>
            <p className="text-sm text-muted-foreground">
              Manage Plugins, Subagents, and Agent Skills
            </p>
          </div>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plugins">
            <Package className="h-4 w-4 mr-2" />
            Plugins
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="h-4 w-4 mr-2" />
            Subagents
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Sparkles className="h-4 w-4 mr-2" />
            Skills
          </TabsTrigger>
        </TabsList>

        {/* Plugins Tab */}
        <TabsContent value="plugins" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Plugins</h3>
              <p className="text-sm text-muted-foreground">
                Installed plugins (may contain commands, agents, skills, hooks, MCP servers)
              </p>
            </div>
          </div>

          {/* Plugin list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : plugins.length > 0 ? (
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <Card key={plugin.path} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{plugin.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            v{plugin.version}
                          </Badge>
                          {plugin.enabled && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Enabled
                            </Badge>
                          )}
                        </div>
                        {plugin.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {plugin.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {plugin.components.commands > 0 && <span>📝 {plugin.components.commands} commands</span>}
                          {plugin.components.agents > 0 && <span>🤖 {plugin.components.agents} agents</span>}
                          {plugin.components.skills > 0 && <span>✨ {plugin.components.skills} skills</span>}
                          {plugin.components.hooks > 0 && <span>🪝 hooks</span>}
                          {plugin.components.mcpServers > 0 && <span>🔌 MCP</span>}
                        </div>
                        {plugin.author && (
                          <p className="text-xs text-muted-foreground mt-1">Author: {plugin.author}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPluginsDir}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">No Plugins Installed</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Plugins are stored in the .claude/plugins/ directory
              </p>
              <div className="text-xs text-muted-foreground mb-4">
                Use the <code className="bg-muted px-1 py-0.5 rounded">/plugin</code> command to manage plugins
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenPluginsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Directory
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Subagents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Subagents</h3>
              <p className="text-sm text-muted-foreground">
                Dedicated agents stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/agents/</code>
              </p>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Subagent
            </Button>
          </div>

          {/* Subagents list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length > 0 ? (
            <div className="space-y-2">
              {agents.map((agent) => (
                <Card 
                  key={agent.path} 
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => api.openFileWithDefaultApp(agent.path)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{agent.name}</h4>
                          <Badge variant={agent.scope === 'project' ? 'default' : 'outline'} className="text-xs">
                            {agent.scope}
                          </Badge>
                        </div>
                        {agent.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {agent.description}
                          </p>
                        )}
                        <code className="text-xs text-muted-foreground mt-2 block truncate">
                          {agent.path}
                        </code>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              
              {/* Open directory button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleOpenAgentsDir}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                Open Subagents Directory
              </Button>
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">No Subagents</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Subagents are stored in the .claude/agents/ directory
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenAgentsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Directory
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Agent Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agent Skills</h3>
              <p className="text-sm text-muted-foreground">
                Dedicated skills stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/skills/</code>
              </p>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Skill
            </Button>
          </div>

          {/* Skills list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : skills.length > 0 ? (
            <div className="space-y-2">
              {skills.map((skill) => (
                <Card 
                  key={skill.path} 
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => api.openFileWithDefaultApp(skill.path)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{skill.name}</h4>
                          <Badge variant={skill.scope === 'project' ? 'default' : 'outline'} className="text-xs">
                            {skill.scope}
                          </Badge>
                        </div>
                        {skill.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {skill.description}
                          </p>
                        )}
                        <code className="text-xs text-muted-foreground mt-2 block truncate">
                          {skill.path}
                        </code>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              
              {/* Open directory button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleOpenSkillsDir}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                Open Skills Directory
              </Button>
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">No Agent Skills</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Agent Skills are stored in the .claude/skills/ directory (filename format: NAME.SKILL.md)
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenSkillsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Directory
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Documentation and resource links */}
      <div className="text-xs text-muted-foreground border-t pt-4 space-y-3">
        <div>
          <p className="mb-2 font-medium">📚 Official Documentation:</p>
          <ul className="space-y-1 ml-4">
            <li>• <a href="https://docs.claude.com/en/docs/claude-code/plugins" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Plugins Docs</a></li>
            <li>• <a href="https://docs.claude.com/en/docs/claude-code/subagents" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Subagents Docs</a></li>
            <li>• <a href="https://docs.claude.com/en/docs/claude-code/agent-skills" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Agent Skills Docs</a></li>
          </ul>
        </div>
        
        <div>
          <p className="mb-2 font-medium">🎯 Official Resources:</p>
          <ul className="space-y-1 ml-4">
            <li>• <a href="https://github.com/anthropics/skills" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
              Anthropic Skills Repository
              <span className="text-muted-foreground">(13.7k ⭐)</span>
            </a></li>
          </ul>
          <p className="text-muted-foreground mt-2 ml-4 text-[11px]">
            Includes official example Skills: document processing, creative design, development tools, etc.
          </p>
        </div>
      </div>
    </div>
  );
};
