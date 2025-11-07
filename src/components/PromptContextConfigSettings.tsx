import React, { useState, useEffect } from "react";
import { Settings, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  loadContextConfig,
  saveContextConfig,
  resetContextConfig,
  applyPreset,
  CONTEXT_PRESETS,
  type PromptContextConfig,
} from "@/lib/promptContextConfig";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptContextConfigSettingsProps {
  className?: string;
}

export const PromptContextConfigSettings: React.FC<PromptContextConfigSettingsProps> = ({
  className,
}) => {
  const [config, setConfig] = useState<PromptContextConfig>(loadContextConfig());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loaded = loadContextConfig();
    setConfig(loaded);
  }, []);

  const handleChange = (updates: Partial<PromptContextConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveContextConfig(config);
    setHasChanges(false);
  };

  const handleReset = () => {
    resetContextConfig();
    setConfig(loadContextConfig());
    setHasChanges(false);
  };

  const handleApplyPreset = (presetKey: keyof typeof CONTEXT_PRESETS) => {
    applyPreset(presetKey);
    setConfig(loadContextConfig());
    setHasChanges(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Context Extraction Settings
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure session context parameters extracted during prompt optimization
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Unsaved
            </Badge>
          )}
          <Button onClick={handleReset} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} size="sm" disabled={!hasChanges}>
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Quick Presets */}
      <Card className="p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">Quick Presets:</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CONTEXT_PRESETS).map(([key, preset]) => (
            <TooltipProvider key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset(key as keyof typeof CONTEXT_PRESETS)}
                  >
                    {preset.name}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{preset.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </Card>

      {/* Configuration Items */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Maximum Message Count */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Maximum Message Count</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Number of recent messages to extract; more provides fuller context but
                        consumes more tokens
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxMessages} messages</Badge>
            </div>
            <Slider
              value={[config.maxMessages]}
              onValueChange={(values: number[]) => handleChange({ maxMessages: values[0] })}
              min={3}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3 messages (minimum)</span>
              <span>50 messages (maximum)</span>
            </div>
          </div>

          {/* Maximum Assistant Message Length */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Maximum Assistant Message Length</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Maximum characters per assistant reply; excess will be truncated
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxAssistantMessageLength} characters</Badge>
            </div>
            <Slider
              value={[config.maxAssistantMessageLength]}
              onValueChange={(values: number[]) =>
                handleChange({ maxAssistantMessageLength: values[0] })
              }
              min={200}
              max={10000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>200 characters</span>
              <span>10,000 characters</span>
            </div>
          </div>

          {/* Maximum User Message Length */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Maximum User Message Length</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Maximum characters per user query; excess will be truncated
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Badge variant="secondary">{config.maxUserMessageLength} characters</Badge>
            </div>
            <Slider
              value={[config.maxUserMessageLength]}
              onValueChange={(values: number[]) =>
                handleChange({ maxUserMessageLength: values[0] })
              }
              min={200}
              max={5000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>200 characters</span>
              <span>5,000 characters</span>
            </div>
          </div>

          {/* Include Execution Results */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Label>Include Execution Results</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Whether to include command execution results in the context</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              checked={config.includeExecutionResults}
              onCheckedChange={(checked) => handleChange({ includeExecutionResults: checked })}
            />
          </div>

          {/* Execution Result Length (shown only when enabled) */}
          {config.includeExecutionResults && (
            <div className="space-y-3 pl-6 border-l-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Maximum Execution Result Length</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Maximum characters per execution result; excess will be truncated
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Badge variant="secondary">{config.maxExecutionResultLength} characters</Badge>
              </div>
              <Slider
                value={[config.maxExecutionResultLength]}
                onValueChange={(values: number[]) =>
                  handleChange({ maxExecutionResultLength: values[0] })
                }
                min={100}
                max={2000}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>100 characters</span>
                <span>2,000 characters</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Configuration Notes */}
      <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Configuration Recommendations:
            </p>
            <ul className="space-y-1 text-blue-800 dark:text-blue-200 list-disc list-inside">
              <li>
                <strong>Simple tasks</strong>: 5‑10 messages, 500‑1000 characters
              </li>
              <li>
                <strong>General tasks</strong>: 10‑20 messages, 1000‑2000 characters (recommended)
              </li>
              <li>
                <strong>Complex tasks</strong>: 20‑50 messages, 2000‑5000 characters
              </li>
              <li>
                More context improves optimization quality but also increases API usage cost
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
