'use client';

import { useEffect, useRef } from 'react';

interface StaffSessionTrackerProps {
  timeoutMinutes?: number;
}

/**
 * Client-Side Inactivity Tracker for Staff and Admin:
 * Detects user inactivity on shared school workstations.
 * - Monitors DOM interaction events (clicks, keypresses, mouse movement, touches, scroll).
 * - Immediately invalidates and redirects to staff login upon reaching 15 minutes of inactivity.
 * - Handles tab refocus and laptop sleep/wake (visibilitychange/focus).
 * - Periodically syncs active presence to slide the server-side inactivity window.
 * - Defense-in-depth: Server-side validation via getSession() is the primary security boundary.
 */
export function StaffSessionTracker({ timeoutMinutes = 15 }: StaffSessionTrackerProps) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const lastActivityRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(Date.now());
  const isLoggedOutRef = useRef<boolean>(false);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();

    function triggerTimeoutSignOut() {
      if (isLoggedOutRef.current) return;
      isLoggedOutRef.current = true;

      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Accept: 'application/json' },
        }).finally(() => {
          window.location.href = '/auth/staff-login?reason=timeout';
        });
      } catch {
        window.location.href = '/auth/staff-login?reason=timeout';
      }
    }

    // Record user activity
    function handleUserActivity() {
      if (isLoggedOutRef.current) return;
      const now = Date.now();
      lastActivityRef.current = now;

      // Heartbeat: if user is active and more than 4 minutes have passed since last touch,
      // ping /api/auth/session to ensure the server-side sliding window is extended
      if (now - lastHeartbeatRef.current > 4 * 60 * 1000) {
        lastHeartbeatRef.current = now;
        fetch('/api/auth/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }).then((res) => {
          if (res.status === 401) {
            triggerTimeoutSignOut();
          } else if (res.ok) {
            res.json().then((data) => {
              if (data && data.authenticated === false) {
                triggerTimeoutSignOut();
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    // Check inactivity periodically and on visibility / focus change
    function checkInactivity() {
      if (isLoggedOutRef.current) return;
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= timeoutMs) {
        triggerTimeoutSignOut();
      }
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Throttled mousemove listener
    let mouseThrottle = 0;
    function onMouseMove() {
      const now = Date.now();
      if (now - mouseThrottle > 5000) {
        mouseThrottle = now;
        handleUserActivity();
      }
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Handle tab refocus or laptop lid opening
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', checkInactivity);

    // Periodic check every 10 seconds
    const intervalId = window.setInterval(checkInactivity, 10_000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', checkInactivity);
      window.clearInterval(intervalId);
    };
  }, [timeoutMs]);

  return null;
}
