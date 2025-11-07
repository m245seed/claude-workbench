import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Settings,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Save,
  Info,
  Terminal,
  Layers
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type {
  HookEvent,
  EnhancedHooksConfiguration,
  HookChainResult,
  HookContext
} from '@/types/enhanced-hooks';
import { convertToEnhanced, convertFromEnhanced } from '@/lib/hooksConverter';

interface EnhancedHooksManagerProps {
  onBack: () => void;
  projectPath?: string;
}

export function EnhancedHooksManager({ onBack, projectPath }: EnhancedHooksManagerProps) {
  const [hooksConfig, setHooksConfig] = useState<EnhancedHooksConfiguration>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);

  const [testEvent, setTestEvent] = useState<HookEvent | null>(null);
  const [testContext, setTestContext] = useState<HookContext>({
    event: '',
    session_id: 'test-session',
    project_path: projectPath || '/test/project',
    data: {}
  });
  const [testResult, setTestResult] = useState<HookChainResult | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadHooksConfig();
  }, [projectPath]);

  // Load hooks configuration and convert to Enhanced format
  const loadHooksConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = projectPath
        ? await api.getMergedHooksConfig(projectPath)
        : await api.getHooksConfig('user');

      const enhancedConfig = convertToEnhanced(config);
      setHooksConfig(enhancedConfig);
    } catch (err) {
      console.error('Failed to load hooks config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hooks configuration');
    } finally {
      setLoading(false);
    }
  };

  // Save hooks configuration after converting back to original format
  const saveHooksConfig = async () => {
    if (!modified) return;

    try {
      setSaving(true);
      setError(null);

      const originalConfig = convertFromEnhanced(hooksConfig);
      const scope = projectPath ? 'local' : 'user';
      await api.updateHooksConfig(scope, originalConfig, projectPath);

      setModified(false);
    } catch (err) {
      console.error('Failed to save hooks config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save hooks configuration');
    } finally {
      setSaving(false);
    }
  };

  const testHookEvent = async () => {
    if (!testEvent) return;

    try {
      setTesting(true);
      setError(null);

      const context: HookContext = {
        ...testContext,
        event: testEvent,
      };

      const result = await api.triggerHookEvent(testEvent, context);
      setTestResult(result);
    } catch (err) {
      console.error('Failed to test hook event:', err);
      setError(err instanceof Error ? err.message : 'Failed to test hook event');
    } finally {
      setTesting(false);
    }
  };

  const renderOverview = () => {
    const stats = {
      totalEvents: Object.keys(hooksConfig).length,
      totalHooks: Object.values(hooksConfig).reduce((sum, hooks) => sum + (hooks?.length || 0), 0),
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                  <p className="text-xs text-muted-foreground">Active Event Types</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalHooks}</p>
                  <p className="text-xs text-muted-foreground">Configured Hooks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{projectPath ? 'Project' : 'User'}</p>
                  <p className="text-xs text-muted-foreground">Configuration Scope</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common Hook management operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => setActiveTab('testing')}
                className="h-auto p-4 justify-start"
              >
                <Play className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Test Hooks</div>
                  <div className="text-xs text-muted-foreground">Execute Hook event tests</div>
                </div>
              </Button>

              <Button
                variant="outline"
                disabled
                className="h-auto p-4 justify-start opacity-50"
              >
                <Settings className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Edit Configuration</div>
                  <div className="text-xs text-muted-foreground">Feature in development</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTesting = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="h-5 w-5" />
            <span>Hook Event Testing</span>
          </CardTitle>
          <CardDescription>
            Test the execution and chaining of Hook events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Event Type</Label>
              <Select
                value={testEvent || undefined}
                onValueChange={(value) => setTestEvent(value as HookEvent)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a Hook event to test" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PreToolUse">PreToolUse – Before tool use</SelectItem>
                  <SelectItem value="PostToolUse">PostToolUse – After tool use</SelectItem>
                  <SelectItem value="OnContextCompact">OnContextCompact – Context compression</SelectItem>
                  <SelectItem value="OnSessionStart">OnSessionStart – Session start</SelectItem>
                  <SelectItem value="OnSessionEnd">OnSessionEnd – Session end</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Session ID</Label>
              <Input
                value={testContext.session_id}
                onChange={(e) => setTestContext({
                  ...testContext,
                  session_id: e.target.value
                })}
                placeholder="Test session ID"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project Path</Label>
            <Input
              value={testContext.project_path}
              onChange={(e) => setTestContext({
                ...testContext,
                project_path: e.target.value
              })}
              placeholder="Project path"
            />
          </div>

          <Button
            onClick={testHookEvent}
            disabled={!testEvent || testing}
            className="w-full"
          >
            {testing ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Test
          </Button>

          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="border-t my-4" />

                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Terminal className="h-5 w-5" />
                      <span>Execution Result</span>
                      <Badge variant={testResult.should_continue ? "default" : "destructive"}>
                        {testResult.should_continue ? 'Continue Allowed' : 'Operation Blocked'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{testResult.successful}</p>
                        <p className="text-xs text-muted-foreground">Success</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{testResult.failed}</p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{testResult.total_hooks}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>

                    {testResult.results.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Execution Details</Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {testResult.results.map((result, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded border text-sm ${
                                result.success
                                  ? 'border-green-200 bg-green-50'
                                  : 'border-red-200 bg-red-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-xs">{result.hook_command}</span>
                                <div className="flex items-center space-x-2">
                                  {result.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {result.execution_time_ms}ms
                                  </span>
                                </div>
                              </div>
                              {result.output && (
                                <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
                                  {result.output}
                                </pre>
                              )}
                              {result.error && (
                                <p className="text-xs text-red-600 mt-1">{result.error}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading Hooks configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto p-6 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {modified && (
              <Button onClick={saveHooksConfig} disabled={saving}>
                {saving ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Configuration
              </Button>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Enhanced Hooks Automation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure event‑driven intelligent automation workflows with chaining and conditional triggers
            </p>
          </div>
        </motion.div>

        {error && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Info className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center space-x-2">
              <Play className="h-4 w-4" />
              <span>Testing</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">{renderOverview()}</TabsContent>
          <TabsContent value="testing">{renderTesting()}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
