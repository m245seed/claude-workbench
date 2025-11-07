/**
 * Enhanced Error Handling System with SDK Native Error Types
 *
 * Comprehensive error handling system that provides detailed error classification,
 * recovery strategies, and user-friendly error messages based on Claude SDK errors.
 */

import { APIError } from '@anthropic-ai/sdk/error';

export interface ErrorContext {
  operation: string;
  model?: string;
  projectPath?: string;
  sessionId?: string;
  timestamp: number;
  userAgent?: string;
  retryCount?: number;
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
  destructive?: boolean;
}

export interface ErrorDetails {
  code: string;
  type: ErrorType;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  context?: ErrorContext;
  originalError?: Error;
  actions?: RecoveryAction[];
  documentation?: string;
}

export enum ErrorType {
  // Authentication & Authorization
  AUTH_INVALID_API_KEY = 'AUTH_INVALID_API_KEY',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  AUTH_RATE_LIMITED = 'AUTH_RATE_LIMITED',
  AUTH_QUOTA_EXCEEDED = 'AUTH_QUOTA_EXCEEDED',

  // Network & Connectivity
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_DNS_ERROR = 'NETWORK_DNS_ERROR',

  // API & Request Errors
  API_INVALID_REQUEST = 'API_INVALID_REQUEST',
  API_MODEL_NOT_FOUND = 'API_MODEL_NOT_FOUND',
  API_CONTEXT_TOO_LONG = 'API_CONTEXT_TOO_LONG',
  API_OVERLOADED = 'API_OVERLOADED',

  // SDK & Integration Errors
  SDK_NOT_INITIALIZED = 'SDK_NOT_INITIALIZED',
  SDK_CONFIGURATION_ERROR = 'SDK_CONFIGURATION_ERROR',
  SDK_VERSION_MISMATCH = 'SDK_VERSION_MISMATCH',

  // Application Errors
  APP_SESSION_EXPIRED = 'APP_SESSION_EXPIRED',
  APP_INVALID_STATE = 'APP_INVALID_STATE',
  APP_RESOURCE_NOT_FOUND = 'APP_RESOURCE_NOT_FOUND',

  // Cache & Storage Errors
  CACHE_CORRUPTION = 'CACHE_CORRUPTION',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',

  // Unknown Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ClaudeError extends Error {
  public readonly code: string;
  public readonly type: ErrorType;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly context?: ErrorContext;
  public readonly originalError?: Error;
  public readonly actions?: RecoveryAction[];
  public readonly documentation?: string;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'ClaudeError';
    this.code = details.code;
    this.type = details.type;
    this.userMessage = details.userMessage;
    this.recoverable = details.recoverable;
    this.retryable = details.retryable;
    this.context = details.context;
    this.originalError = details.originalError;
    this.actions = details.actions;
    this.documentation = details.documentation;
  }

  /**
   * Convert error to user-friendly object
   */
  toUserObject() {
    return {
      type: this.type,
      message: this.userMessage,
      recoverable: this.recoverable,
      retryable: this.retryable,
      actions: this.actions,
      documentation: this.documentation,
      timestamp: this.context?.timestamp || Date.now(),
    };
  }

  /**
   * Check if error should trigger retry
   */
  shouldRetry(): boolean {
    return this.retryable && (this.context?.retryCount || 0) < 3;
  }
}

export class ErrorHandler {
  private errorHistory: ClaudeError[] = [];
  private maxHistorySize = 100;

  /**
   * Process and classify an error
   */
  handleError(error: unknown, context?: Partial<ErrorContext>): ClaudeError {
    const fullContext: ErrorContext = {
      operation: 'unknown',
      timestamp: Date.now(),
      retryCount: 0,
      ...context,
    };

    let claudeError: ClaudeError;

    if (error instanceof ClaudeError) {
      claudeError = error;
    } else if (error instanceof APIError) {
      claudeError = this.handleAPIError(error, fullContext);
    } else if (error instanceof Error) {
      claudeError = this.handleGenericError(error, fullContext);
    } else {
      claudeError = this.handleUnknownError(error, fullContext);
    }

    // Add to history
    this.addToHistory(claudeError);

    // Log error for debugging
    console.error(`[ErrorHandler] ${claudeError.type}:`, {
      message: claudeError.message,
      context: claudeError.context,
      originalError: claudeError.originalError,
    });

    return claudeError;
  }

  /**
   * Handle Anthropic API errors
   */
  private handleAPIError(error: APIError, context: ErrorContext): ClaudeError {
    const status = error.status || 500;

    switch (status) {
      case 400:
        if (error.message.includes('context_length_exceeded')) {
          return new ClaudeError({
            code: 'API_CONTEXT_TOO_LONG',
            type: ErrorType.API_CONTEXT_TOO_LONG,
            message: error.message,
            userMessage: 'Conversation is too long. Please use the compression feature or start a new conversation.',
            recoverable: true,
            retryable: false,
            context,
            originalError: error,
            actions: [
              {
                label: 'Auto Compress',
                action: () => {
                  window.dispatchEvent(new CustomEvent('trigger-auto-compact'));
                },
                primary: true,
              },
              {
                label: 'Start New Conversation',
                action: () => {
                  window.dispatchEvent(new CustomEvent('start-new-conversation'));
                },
              },
            ],
            documentation: 'https://docs.anthropic.com/en/api/rate-limits',
          });
        }
        return new ClaudeError({
          code: 'API_INVALID_REQUEST',
          type: ErrorType.API_INVALID_REQUEST,
          message: error.message,
          userMessage: 'Invalid request parameters. Please check your input.',
          recoverable: true,
          retryable: false,
          context,
          originalError: error,
        });

      case 401:
        return new ClaudeError({
          code: 'AUTH_INVALID_API_KEY',
          type: ErrorType.AUTH_INVALID_API_KEY,
          message: error.message,
          userMessage: 'API key is invalid or expired. Please check your configuration.',
          recoverable: true,
          retryable: false,
          context,
          originalError: error,
          actions: [
            {
              label: 'Check API Key',
              action: () => {
                window.dispatchEvent(new CustomEvent('open-provider-settings'));
              },
              primary: true,
            },
          ],
          documentation: 'https://console.anthropic.com/',
        });

      case 403:
        return new ClaudeError({
          code: 'AUTH_PERMISSION_DENIED',
          type: ErrorType.AUTH_PERMISSION_DENIED,
          message: error.message,
          userMessage: 'Access denied. Please check your account permissions and balance.',
          recoverable: true,
          retryable: false,
          context,
          originalError: error,
          actions: [
            {
              label: 'Check Account Status',
              action: () => {
                window.open('https://console.anthropic.com/settings/billing', '_blank');
              },
            },
          ],
        });

      case 404:
        return new ClaudeError({
          code: 'API_MODEL_NOT_FOUND',
          type: ErrorType.API_MODEL_NOT_FOUND,
          message: error.message,
          userMessage: 'The requested model does not exist or is unavailable.',
          recoverable: true,
          retryable: false,
          context,
          originalError: error,
          actions: [
            {
              label: 'Select Another Model',
              action: () => {
                window.dispatchEvent(new CustomEvent('show-model-selector'));
              },
              primary: true,
            },
          ],
        });

      case 429:
        return new ClaudeError({
          code: 'AUTH_RATE_LIMITED',
          type: ErrorType.AUTH_RATE_LIMITED,
          message: error.message,
          userMessage: 'Too many requests. Please try again later.',
          recoverable: true,
          retryable: true,
          context,
          originalError: error,
          actions: [
            {
              label: 'Retry Later',
              action: () => {
                // Auto-retry will be handled by caller
              },
              primary: true,
            },
          ],
        });

      case 500:
      case 502:
      case 503:
      case 504:
        return new ClaudeError({
          code: 'API_OVERLOADED',
          type: ErrorType.API_OVERLOADED,
          message: error.message,
          userMessage: 'Claude service is temporarily unavailable. Please try again later.',
          recoverable: true,
          retryable: true,
          context,
          originalError: error,
          actions: [
            {
              label: 'Auto Retry',
              action: () => {
                // Auto-retry will be handled by caller
              },
              primary: true,
            },
          ],
        });

      default:
        return new ClaudeError({
          code: 'API_UNKNOWN_ERROR',
          type: ErrorType.UNKNOWN_ERROR,
          message: error.message,
          userMessage: `API error (${status}): ${error.message}`,
          recoverable: true,
          retryable: status >= 500,
          context,
          originalError: error,
        });
    }
  }

  /**
   * Handle generic JavaScript errors
   */
  private handleGenericError(error: Error, context: ErrorContext): ClaudeError {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
      return new ClaudeError({
        code: 'NETWORK_CONNECTION_FAILED',
        type: ErrorType.NETWORK_CONNECTION_FAILED,
        message: error.message,
        userMessage: 'Network connection failed. Please check your connection and try again.',
        recoverable: true,
        retryable: true,
        context,
        originalError: error,
        actions: [
          {
            label: 'Check Network Connection',
            action: () => {
              window.open('https://www.google.com', '_blank');
            },
          },
          {
            label: 'Retry',
            action: () => {
              // Auto-retry will be handled by caller
            },
            primary: true,
          },
        ],
      });
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted')) {
      return new ClaudeError({
        code: 'NETWORK_TIMEOUT',
        type: ErrorType.NETWORK_TIMEOUT,
        message: error.message,
        userMessage: 'Request timed out. Please retry or check your network.',
        recoverable: true,
        retryable: true,
        context,
        originalError: error,
      });
    }

    // Storage errors
    if (message.includes('quota') || message.includes('storage')) {
      return new ClaudeError({
        code: 'STORAGE_QUOTA_EXCEEDED',
        type: ErrorType.STORAGE_QUOTA_EXCEEDED,
        message: error.message,
        userMessage: 'Insufficient storage space. Please clear cache or free up space.',
        recoverable: true,
        retryable: false,
        context,
        originalError: error,
        actions: [
          {
            label: 'Clear Cache',
            action: () => {
              window.dispatchEvent(new CustomEvent('clear-cache'));
            },
            primary: true,
          },
        ],
      });
    }

    // Configuration errors
    if (message.includes('config') || message.includes('initialization')) {
      return new ClaudeError({
        code: 'SDK_CONFIGURATION_ERROR',
        type: ErrorType.SDK_CONFIGURATION_ERROR,
        message: error.message,
        userMessage: 'Configuration error. Please check your settings.',
        recoverable: true,
        retryable: false,
        context,
        originalError: error,
        actions: [
          {
            label: 'Check Settings',
            action: () => {
              window.dispatchEvent(new CustomEvent('open-settings'));
            },
            primary: true,
          },
        ],
      });
    }

    // Generic error
    return new ClaudeError({
      code: 'UNKNOWN_ERROR',
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message,
      userMessage: `Unknown error occurred: ${error.message}`,
      recoverable: true,
      retryable: false,
      context,
      originalError: error,
    });
  }

  /**
   * Handle completely unknown errors
   */
  private handleUnknownError(error: unknown, context: ErrorContext): ClaudeError {
    return new ClaudeError({
      code: 'UNKNOWN_ERROR',
      type: ErrorType.UNKNOWN_ERROR,
      message: String(error),
      userMessage: 'An unknown error occurred. Please retry or contact support.',
      recoverable: true,
      retryable: true,
      context,
      originalError: error instanceof Error ? error : new Error(String(error)),
    });
  }

  /**
   * Add error to history
   */
  private addToHistory(error: ClaudeError): void {
    this.errorHistory.unshift(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    recentErrors: ClaudeError[];
    mostCommonError: ErrorType | null;
  } {
    const errorsByType = this.errorHistory.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<ErrorType, number>);

    const mostCommonError = Object.entries(errorsByType).reduce((a, b) =>
      errorsByType[a[0] as ErrorType] > errorsByType[b[0] as ErrorType] ? a : b,
      ['', 0]
    )[0] as ErrorType | null;

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors: this.errorHistory.slice(0, 10),
      mostCommonError: mostCommonError || null,
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if error is retryable with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: ClaudeError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error, {
          operation: operation.name || 'retry_operation',
          retryCount: attempt,
        });

        if (attempt === maxRetries || !lastError.retryable) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Utility function to handle errors in async operations
 */
export async function handleAsync<T>(
  promise: Promise<T>,
  context?: Partial<ErrorContext>
): Promise<[T | null, ClaudeError | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const claudeError = errorHandler.handleError(error, context);
    return [null, claudeError];
  }
}

/**
 * Decorator for error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw errorHandler.handleError(error, {
        operation: fn.name,
        ...context,
      });
    }
  }) as T;
}