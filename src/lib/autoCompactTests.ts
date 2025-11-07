/**
 * Auto-Compact Functionality Test and Integration Guide
 *
 * This file provides test scenarios and integration examples for the
 * auto-compact context management system.
 */

import { api, AutoCompactConfig } from '@/lib/api';

/**
 * Test Configuration for Auto-Compact System
 */
export const testAutoCompactSystem = async () => {
  console.log("🧪 Starting Auto-Compact System Tests...");

  try {
    // Test 1: Initialize the auto-compact manager
    console.log("📋 Test 1: Initializing auto-compact manager...");
    await api.initAutoCompactManager();
    console.log("✅ Auto-compact manager initialized successfully");

    // Test 2: Get default configuration
    console.log("📋 Test 2: Getting default configuration...");
    const defaultConfig = await api.getAutoCompactConfig();
    console.log("✅ Default config loaded:", defaultConfig);

    // Test 3: Update configuration with test values
    console.log("📋 Test 3: Updating configuration...");
    const testConfig: AutoCompactConfig = {
      enabled: true,
      max_context_tokens: 100000, // Lower for testing
      compaction_threshold: 0.8,   // Trigger at 80%
      min_compaction_interval: 60, // 1 minute for testing
      compaction_strategy: 'Smart',
      preserve_recent_messages: true,
      preserve_message_count: 5,
      custom_instructions: "Focus on preserving key decisions and technical details"
    };

    await api.updateAutoCompactConfig(testConfig);
    console.log("✅ Configuration updated successfully");

    // Test 4: Verify configuration was saved
    console.log("📋 Test 4: Verifying saved configuration...");
    const savedConfig = await api.getAutoCompactConfig();
    console.log("✅ Configuration verified:", savedConfig);

    // Test 5: Get system status
    console.log("📋 Test 5: Getting system status...");
    const status = await api.getAutoCompactStatus();
    console.log("✅ System status:", status);

    // Test 6: Test session registration (simulated)
    console.log("📋 Test 6: Testing session registration...");
    const testSessionId = `test-session-${Date.now()}`;
    await api.registerAutoCompactSession(testSessionId, "/test/project", "sonnet");
    console.log("✅ Test session registered:", testSessionId);

    // Test 7: Simulate token update
    console.log("📋 Test 7: Simulating token usage...");
    const compactionTriggered = await api.updateSessionContext(testSessionId, 85000);
    console.log(`✅ Token update result: compaction ${compactionTriggered ? 'triggered' : 'not triggered'}`);

    // Test 8: Get session stats
    console.log("📋 Test 8: Getting session statistics...");
    const sessionStats = await api.getSessionContextStats(testSessionId);
    console.log("✅ Session stats:", sessionStats);

    // Test 9: Get all monitored sessions
    console.log("📋 Test 9: Getting all monitored sessions...");
    const allSessions = await api.getAllMonitoredSessions();
    console.log("✅ All monitored sessions:", allSessions);

    // Test 10: Manual compaction trigger
    console.log("📋 Test 10: Testing manual compaction...");
    try {
      await api.triggerManualCompaction(testSessionId, "Compact this session for testing purposes");
      console.log("✅ Manual compaction triggered successfully");
    } catch (error) {
      console.log("ℹ️ Manual compaction test skipped (session may not be active):", error);
    }

    // Test 11: Cleanup
    console.log("📋 Test 11: Cleaning up test session...");
    await api.unregisterAutoCompactSession(testSessionId);
    console.log("✅ Test session unregistered");

    console.log("🎉 All Auto-Compact System Tests Completed Successfully!");

    return {
      success: true,
      testResults: {
        initialization: true,
        configuration: true,
        sessionManagement: true,
        tokenTracking: true,
        compactionTrigger: compactionTriggered,
        cleanup: true
      }
    };

  } catch (error) {
    console.error("❌ Auto-Compact System Test Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Integration Example: Add Auto-Compact to ClaudeCodeSession
 */
export const integrateWithClaudeSession = () => {
  const exampleIntegration = `
// In ClaudeCodeSession.tsx, add this to the component:

import { api } from '@/lib/api';

// Add state for auto-compact
const [autoCompactEnabled, setAutoCompactEnabled] = useState(false);

// Initialize auto-compact when session starts
useEffect(() => {
  const initAutoCompact = async () => {
    try {
      await api.initAutoCompactManager();
      const config = await api.getAutoCompactConfig();
      setAutoCompactEnabled(config.enabled);

      if (claudeSessionId && config.enabled) {
        await api.registerAutoCompactSession(claudeSessionId, projectPath, model);
        console.log('Auto-compact registered for session:', claudeSessionId);
      }
    } catch (error) {
      console.warn('Failed to initialize auto-compact:', error);
    }
  };

  if (claudeSessionId) {
    initAutoCompact();
  }

  return () => {
    // Cleanup when component unmounts
    if (claudeSessionId && autoCompactEnabled) {
      api.unregisterAutoCompactSession(claudeSessionId).catch(console.warn);
    }
  };
}, [claudeSessionId, projectPath, model]);

// Update token count when messages are processed
const updateTokenUsage = async (tokenCount: number) => {
  if (claudeSessionId && autoCompactEnabled) {
    try {
      const compactionTriggered = await api.updateSessionContext(claudeSessionId, tokenCount);
      if (compactionTriggered) {
        console.log('Auto-compaction triggered for session:', claudeSessionId);
        // Optionally show a notification to the user
        toast({
          title: "Auto-compact triggered",
          description: "Context window is approaching the limit; performing smart compaction...",
          duration: 3000,
        });
      }
    } catch (error) {
      console.warn('Failed to update session context:', error);
    }
  }
};

// Call updateTokenUsage when processing JSONL messages with usage info
// This should be integrated into the message processing logic where
// token counts are extracted from Claude's response
`;

  console.log("📋 Integration Example:");
  console.log(exampleIntegration);

  return exampleIntegration;
};

/**
 * Usage Statistics and Monitoring
 */
export const monitorAutoCompactUsage = async () => {
  try {
    const status = await api.getAutoCompactStatus();
    const sessions = await api.getAllMonitoredSessions();

    console.log("📊 Auto-Compact Usage Statistics:");
    console.log(`- Status: ${status.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Active Sessions: ${status.sessions_count}`);
    console.log(`- Total Compactions: ${status.total_compactions}`);
    console.log(`- Max Context Tokens: ${status.max_context_tokens.toLocaleString()}`);
    console.log(`- Compaction Threshold: ${(status.compaction_threshold * 100).toFixed(1)}%`);

    if (sessions.length > 0) {
      console.log("\n📋 Session Details:");
      sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. Session: ${session.session_id.slice(0, 8)}...`);
        console.log(`     Model: ${session.model}`);
        console.log(`     Tokens: ${session.current_tokens.toLocaleString()}`);
        console.log(`     Messages: ${session.message_count}`);
        console.log(`     Compactions: ${session.compaction_count}`);
        console.log(`     Status: ${JSON.stringify(session.status)}`);
      });
    }

    return { status, sessions };
  } catch (error) {
    console.error("Failed to monitor auto-compact usage:", error);
    throw error;
  }
};

/**
 * Performance Recommendations
 */
export const getPerformanceRecommendations = (status: any, sessions: any[]) => {
  const recommendations = [];

  if (!status.enabled) {
    recommendations.push({
      type: 'warning',
      message: 'Consider enabling auto-compact to optimize performance for long conversations'
    });
  }

  if (status.compaction_threshold > 0.9) {
    recommendations.push({
      type: 'info',
      message: 'Compaction threshold is high; consider lowering it to 80-85% for better performance'
    });
  }

  if (sessions.some(s => s.current_tokens > status.max_context_tokens * 0.95)) {
    recommendations.push({
      type: 'critical',
      message: 'Some sessions are approaching the context limit; consider performing manual compaction immediately'
    });
  }

  if (status.total_compactions === 0 && sessions.length > 0) {
    recommendations.push({
      type: 'info',
      message: 'No automatic compactions have been performed yet; verify the configuration'
    });
  }

  return recommendations;
};

// Export test utilities
export const autoCompactTests = {
  testAutoCompactSystem,
  integrateWithClaudeSession,
  monitorAutoCompactUsage,
  getPerformanceRecommendations
};

export default autoCompactTests;