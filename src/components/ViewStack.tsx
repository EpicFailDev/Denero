import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';

interface ExitingPane {
  view: string;
  dir: 'forward' | 'back';
  node: React.ReactNode;
}

interface PopState {
  progress: number;
  phase: 'drag' | 'finish' | 'snap';
  view: string | null;
}

interface ViewStackProps {
  view: string;
  direction: 'forward' | 'back';
  children: React.ReactNode;
  onBack?: (prevView: string) => void;
}

const EXIT_DURATION_MS = 400;
const EDGE_LEFT = 28; // px from the left edge that starts the back gesture
const ARM_DX = 10; // horizontal px before the gesture takes over from scroll
const COMMIT_PROGRESS = 0.3; // fraction of screen width needed to commit
const COMMIT_VELOCITY = 0.5; // px/ms flick speed that also commits
const POP_FINISH_MS = 240; // duration of the finish/snap transition

/**
 * iOS-style directional screen transition (push/pop).
 * - 'forward': new screen slides in from the right, old screen slides out to the left.
 * - 'back':    new screen slides in from the left, old screen slides out to the right.
 *
 * Also supports an interactive edge-swipe back gesture (when `onBack` is provided):
 * dragging from the left edge follows the finger in real time, revealing the
 * previous screen; releasing past the threshold completes the pop, otherwise it
 * snaps back. The exiting pane reuses the previously rendered React node (no
 * fresh mount / duplicate fetches) and is removed after EXIT_DURATION_MS.
 */
export const ViewStack: React.FC<ViewStackProps> = ({ view, direction, children, onBack }) => {
  const [exiting, setExiting] = useState<ExitingPane | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [backView, setBackView] = useState<string | null>(null);
  const [pop, setPop] = useState<PopState | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevViewRef = useRef(view);
  const prevNodeRef = useRef<React.ReactNode>(children);
  const backNodeRef = useRef<React.ReactNode>(null);
  const popCommitRef = useRef(false);
  const suppressEnterRef = useRef(false);
  const gestureRef = useRef({
    tracking: false,
    armed: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    lastProgress: 0,
  });

  // Detect navigation synchronously (before paint) so the exit snapshot and the
  // entering animation land in the same frame — no flash of the new screen.
  useLayoutEffect(() => {
    if (view === prevViewRef.current) return;
    const oldView = prevViewRef.current;

    if (popCommitRef.current) {
      // Interactive pop already animated the swap — swap silently, no re-animation.
      popCommitRef.current = false;
      prevViewRef.current = view;
      setBackView(null);
      backNodeRef.current = null;
      setHasNavigated(true);
      return;
    }

    // Real navigation: re-enable the enter animation for the freshly keyed pane.
    suppressEnterRef.current = false;
    prevViewRef.current = view;
    setBackView(oldView);
    backNodeRef.current = prevNodeRef.current; // last rendered node = old view's node
    setHasNavigated(true);
    setExiting({ view: oldView, dir: direction, node: prevNodeRef.current });
    const t = window.setTimeout(() => setExiting(null), EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [view, direction]);

  // Remember the latest rendered node so the exit snapshot matches what was on
  // screen. Declared AFTER the navigation effect so it never clobbers the old
  // node before the exit pane captures it.
  useEffect(() => {
    prevNodeRef.current = children;
  }, [children]);

  const canGoBack = Boolean(onBack) && backView !== null;

  // Drive the finish/snap transition, then navigate on commit.
  useEffect(() => {
    if (!pop || pop.phase === 'drag') return;
    const target = pop.phase === 'finish' ? 1 : 0;
    const raf = requestAnimationFrame(() => {
      setPop((p) =>
        p && p.phase === pop.phase && p.progress !== target ? { ...p, progress: target } : p
      );
    });
    const t = window.setTimeout(() => {
      if (pop.phase === 'finish') {
        const targetView = pop.view;
        popCommitRef.current = true;
        suppressEnterRef.current = true;
        setPop(null);
        if (targetView) onBack?.(targetView);
      } else {
        setPop(null);
      }
    }, POP_FINISH_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [pop, onBack]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canGoBack || exiting || pop) return;
    if (e.clientX > EDGE_LEFT) return;
    const g = gestureRef.current;
    g.tracking = true;
    g.armed = false;
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.lastX = e.clientX;
    g.lastTime = e.timeStamp;
    g.velocity = 0;
    g.lastProgress = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g.tracking) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.armed) {
      // Wait for clear horizontal intent so vertical scrolling still works.
      if (dx < ARM_DX || dx <= Math.abs(dy)) return;
      g.armed = true;
      try {
        containerRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture already held elsewhere — ignore */
      }
    }
    const width = containerRef.current?.clientWidth || window.innerWidth;
    const progress = Math.min(Math.max(dx / width, 0), 1);
    const dt = Math.max(e.timeStamp - g.lastTime, 1);
    g.velocity = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastTime = e.timeStamp;
    g.lastProgress = progress;
    setPop({ progress, phase: 'drag', view: backView });
  };

  const finishGesture = () => {
    const g = gestureRef.current;
    if (!g.tracking) return;
    g.tracking = false;
    if (!g.armed) return;
    const progress = g.lastProgress;
    const commit = progress >= COMMIT_PROGRESS || g.velocity >= COMMIT_VELOCITY;
    // Keep the enter animation class off after any gesture so a snap-back never
    // replays the screen's entrance on the same DOM element.
    suppressEnterRef.current = true;
    setPop({ progress, phase: commit ? 'finish' : 'snap', view: backView });
  };

  const inPop = pop !== null;
  const progress = pop?.progress ?? 0;
  const peekShown = inPop && backNodeRef.current !== null;
  const enterTransform = inPop ? `translateX(${progress * 100}%)` : undefined;
  const peekTransform = inPop ? `translateX(calc(-30% + ${progress * 30}%))` : undefined;
  const popTransition =
    pop && pop.phase !== 'drag'
      ? `transform ${POP_FINISH_MS}ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow ${POP_FINISH_MS}ms ease`
      : undefined;
  const enterClass =
    hasNavigated && !suppressEnterRef.current && !inPop ? `ios-enter-${direction}` : '';

  return (
    <div
      className="ios-view-stack"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      {exiting && (
        <div
          key={`exit-${exiting.view}`}
          className={`ios-content-inner ios-view-pane ios-view-exit ios-exit-${exiting.dir}`}
          aria-hidden="true"
        >
          {exiting.node}
        </div>
      )}
      {peekShown && (
        <div
          key={`back-${backView}`}
          className="ios-content-inner ios-view-pane ios-view-peek"
          aria-hidden="true"
          style={{ transform: peekTransform, transition: popTransition }}
        >
          {backNodeRef.current}
        </div>
      )}
      <div
        key={`enter-${view}`}
        className={`ios-content-inner ios-view-pane ios-view-enter ${enterClass}`}
        style={{
          transform: enterTransform,
          transition: popTransition,
          boxShadow: inPop ? '-24px 0 48px rgba(0, 0, 0, 0.55)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
