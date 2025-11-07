/**
 * Smart Auto Scroll Hook
 *
 * Extracted from ClaudeCodeSession (original 166-170 state, 305-435 logic)
 * Provides intelligent scroll management: user manual scroll detection, auto-scroll to bottom, streaming output scroll
 */

import { useRef, useState, useEffect } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface SmartAutoScrollConfig {
  /** Displayable message list (used to trigger scrolling) */
  displayableMessages: ClaudeStreamMessage[];
  /** Whether it is loading (during streaming output) */
  isLoading: boolean;
}

interface SmartAutoScrollReturn {
  /** Scroll container ref */
  parentRef: React.RefObject<HTMLDivElement>;
  /** Whether the user has manually scrolled away from the bottom */
  userScrolled: boolean;
  /** Set user scroll state */
  setUserScrolled: (scrolled: boolean) => void;
  /** Set auto-scroll state */
  setShouldAutoScroll: (should: boolean) => void;
}

/**
 * Smart Auto Scroll Hook
 *
 * @param config - Configuration object
 * @returns Scroll management object
 *
 * @example
 * const { parentRef, userScrolled, setUserScrolled, shouldAutoScroll, setShouldAutoScroll } =
 *   useSmartAutoScroll({
 *     displayableMessages,
 *     isLoading
 *   });
 */
export function useSmartAutoScroll(config: SmartAutoScrollConfig): SmartAutoScrollReturn {
  const { displayableMessages, isLoading } = config;

  // Scroll state
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPositionRef = useRef(0);
  const shouldAutoScrollRef = useRef(shouldAutoScroll);

  // Keep ref in sync with state
  useEffect(() => {
    shouldAutoScrollRef.current = shouldAutoScroll;
  }, [shouldAutoScroll]);

  // Smart scroll detection - detect when user manually scrolls
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const currentScrollPosition = scrollTop;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold

      // Detect if this was a user-initiated scroll
      const scrollDifference = Math.abs(currentScrollPosition - lastScrollPositionRef.current);
      if (scrollDifference > 5) { // Only count significant scroll movements
        const wasUserScroll = !shouldAutoScrollRef.current || scrollDifference > 100;

        if (wasUserScroll) {
          setUserScrolled(!isAtBottom);
          setShouldAutoScroll(isAtBottom);
        }
      }

      lastScrollPositionRef.current = currentScrollPosition;

      // Reset user scroll state after inactivity
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (isAtBottom) {
          setUserScrolled(false);
          setShouldAutoScroll(true);
        }
      }, 2000);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []); // Empty deps - event listener only needs to be registered once

  // Smart auto-scroll for new messages
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [displayableMessages.length, shouldAutoScroll, userScrolled]);

  // Enhanced streaming scroll - only when user hasn't manually scrolled away
  useEffect(() => {
    if (isLoading && displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const scrollToBottom = () => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      };

      // More frequent updates during streaming for better UX
      const intervalId = setInterval(scrollToBottom, 300);

      return () => clearInterval(intervalId);
    }
  }, [isLoading, displayableMessages.length, shouldAutoScroll, userScrolled]);

  return {
    parentRef,
    userScrolled,
    setUserScrolled,
    setShouldAutoScroll
  };
}
