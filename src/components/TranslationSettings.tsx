import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { api, type TranslationConfig, type TranslationCacheStats } from '@/lib/api';
import { translationMiddleware } from '@/lib/translationMiddleware';
import { Loader2, RefreshCw, Settings, Languages, Database, AlertTriangle } from 'lucide-react';

interface TranslationSettingsProps {
  onClose?: () => void;
}

export const TranslationSettings: React.FC<TranslationSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<TranslationConfig | null>(null);
  const [cacheStats, setCacheStats] = useState<TranslationCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [configData, statsData] = await Promise.all([
        api.getTranslationConfig(),
        api.getTranslationCacheStats().catch(() => null) // 缓存统计可能失败
      ]);
      
      setConfig(configData);
      setCacheStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load translation settings');
      console.error('Failed to load translation settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await api.updateTranslationConfig(config);
      await translationMiddleware.updateConfig(config);
      
      setSuccess('Translation configuration saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
      console.error('Failed to save translation config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config) return;

    // Check if API key is configured
    if (!config.api_key.trim()) {
      setError('Please enter the API key first');
      return;
    }

    try {
      setTestingConnection(true);
      setError(null);
      
      // 测试翻译功能
      await api.translateText('Hello', 'zh');
      
      setSuccess('Translation service connection test succeeded!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(`Connection test failed: ${errorMessage}`);
      console.error('Translation connection test failed:', err);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      setError(null);
      
      await api.clearTranslationCache();
      await loadData(); // Reload cache stats
      
      setSuccess('Translation cache cleared successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
      console.error('Failed to clear translation cache:', err);
    } finally {
      setClearingCache(false);
    }
  };

  const handleConfigChange = (key: keyof TranslationConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading translation settings...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Unable to load translation configuration</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Languages className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Smart Translation Settings</h2>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Basic Settings</span>
          </CardTitle>
          <CardDescription>
            Configure the smart translation middleware for seamless Chinese-English translation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="translation-enabled" className="text-sm font-medium">
              Enable Smart Translation
            </Label>
            <Switch
              id="translation-enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => handleConfigChange('enabled', enabled)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-base-url">API Base URL</Label>
              <Input
                id="api-base-url"
                value={config.api_base_url}
                onChange={(e) => handleConfigChange('api_base_url', e.target.value)}
                placeholder="https://api.siliconflow.cn/v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Translation Model</Label>
              <Input
                id="model"
                value={config.model}
                onChange={(e) => handleConfigChange('model', e.target.value)}
                placeholder="tencent/Hunyuan-MT-7B"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Request Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={config.timeout_seconds}
                onChange={(e) => handleConfigChange('timeout_seconds', parseInt(e.target.value) || 30)}
                min="5"
                max="300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cache-ttl">Cache TTL (seconds)</Label>
              <Input
                id="cache-ttl"
                type="number"
                value={config.cache_ttl_seconds}
                onChange={(e) => handleConfigChange('cache_ttl_seconds', parseInt(e.target.value) || 3600)}
                min="300"
                max="86400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center space-x-2">
              <span>API Key</span>
              {!config.api_key && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </Label>
            <Input
              id="api-key"
              type="password"
              value={config.api_key}
              onChange={(e) => handleConfigChange('api_key', e.target.value)}
              placeholder="Enter your Silicon Flow API key"
              className={!config.api_key ? "border-red-300" : ""}
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Used to access the Silicon Flow translation API
              </p>
              <p className="text-xs text-blue-600">
                💡 Get API key: Visit <a href="https://cloud.siliconflow.cn" target="_blank" className="underline hover:text-blue-800">https://cloud.siliconflow.cn</a> to register and get a free API key
              </p>
              {!config.api_key && (
                <p className="text-xs text-red-600">
                  ⚠️ Translation will not work without an API key
                </p>
              )}
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !config.enabled || !config.api_key.trim()}
            >
              {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
          </div>
          
          {!config.api_key.trim() && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>API key required:</strong>
                <br />
                1. Visit <a href="https://cloud.siliconflow.cn" target="_blank" className="text-blue-600 underline hover:text-blue-800">Silicon Flow official site</a> to register
                <br />
                2. Create an API key in the console
                <br />
                3. Enter the key in the input above
                <br />
                4. Save configuration and test connection
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Cache Management</span>
          </CardTitle>
          <CardDescription>
            Manage translation result cache to improve response speed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cacheStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {cacheStats.total_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Cache Entries</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {cacheStats.active_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Cache</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {cacheStats.expired_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">Expired Cache</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                Unable to get cache statistics
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Stats
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleClearCache}
                disabled={clearingCache}
              >
                {clearingCache && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Clear Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
          <CardDescription>
            Learn how the smart translation middleware works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Transparent Translation</strong>: User experience is the same as direct Chinese conversation</li>
                <li><strong>Smart Detection</strong>: Automatically detects Chinese and English</li>
                <li><strong>Bidirectional Translation</strong>: Chinese input → English send, English response → Chinese display</li>
                <li><strong>Cache Optimization</strong>: Local cache for identical translation results, improves response speed</li>
                <li><strong>Fallback Protection</strong>: Uses original text if translation fails, ensures functionality</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Workflow</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>User enters a Chinese prompt</li>
                <li>Middleware detects Chinese and automatically translates to English</li>
                <li>Send English to Claude API</li>
                <li>Claude returns English response</li>
                <li>Middleware translates English response to Chinese</li>
                <li>User sees Chinese response</li>
              </ol>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Badge variant="secondary">Version: 1.0.0</Badge>
              <Badge variant="outline">Model: Hunyuan-MT-7B</Badge>
              <Badge variant={config.enabled ? "default" : "secondary"}>
                Status: {config.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
