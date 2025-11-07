import { Zap, Brain, Sparkles } from "lucide-react";
import { ModelConfig, ThinkingModeConfig } from "./types";

/**
 * Available models
 */
export const MODELS: ModelConfig[] = [
  {
    id: "sonnet",
    name: "Claude 4.5 Sonnet",
    description: "Faster, efficient for most tasks",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "sonnet1m",
    name: "Claude 4.5 Sonnet 1M",
    description: "Sonnet with 1 million token context",
    icon: <Brain className="h-4 w-4" />
  },
  {
    id: "opus",
    name: "Claude 4.1 Opus",
    description: "Latest model with enhanced coding & reasoning capabilities",
    icon: <Sparkles className="h-4 w-4" />
  }
];

/**
 * Thinking modes configuration
 * Simplified to on/off toggle (conforming to official Claude Code standard)
 * Default tokens when enabled: 10000 (balanced for most use cases)
 */
export const THINKING_MODES: ThinkingModeConfig[] = [
  {
    id: "off",
    name: "Thinking Mode: Off",
    description: "Normal response speed",
    level: 0,
    tokens: undefined // No extended thinking
  },
  {
    id: "on",
    name: "Thinking Mode: On",
    description: "Enable deep thinking (10K tokens)",
    level: 1,
    tokens: 10000 // Default thinking tokens
  }
];

/**
 * Default thinking tokens when enabled
 * Can be adjusted via environment variable MAX_THINKING_TOKENS
 */
export const DEFAULT_THINKING_TOKENS = 10000;
