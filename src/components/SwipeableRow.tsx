import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onEdit,
  onDelete,
  disabled = false,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 75;
  const MAX_SWIPE = onEdit && onDelete ? ACTION_WIDTH * 2 : ACTION_WIDTH;
  const THRESHOLD = 50;

  // Register non-passive touchmove listener to allow preventDefault
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchMoveNative = (e: TouchEvent) => {
      if (disabled || !isSwiping) return;

      const deltaX = e.touches[0].clientX - startXRef.current;
      const deltaY = e.touches[0].clientY - startYRef.current;

      if (isHorizontalSwipeRef.current === null) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      if (!isHorizontalSwipeRef.current) return;

      e.preventDefault();

      const newOffset = Math.min(0, Math.max(-MAX_SWIPE - 20, deltaX));
      setOffsetX(newOffset);
    };

    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMoveNative);
  }, [disabled, isSwiping, MAX_SWIPE]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      isHorizontalSwipeRef.current = null;
      setIsSwiping(true);
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    setIsSwiping(false);

    if (offsetX < -THRESHOLD) {
      setOffsetX(-MAX_SWIPE);
      setIsSwipeOpen(true);
    } else {
      setOffsetX(0);
      setIsSwipeOpen(false);
    }
  }, [disabled, offsetX, MAX_SWIPE]);

  const resetSwipe = useCallback(() => {
    setOffsetX(0);
    setIsSwipeOpen(false);
  }, []);

  const handleEdit = () => {
    resetSwipe();
    onEdit?.();
  };

  const handleDelete = () => {
    resetSwipe();
    onDelete?.();
  };

  // Click on content — close swipe if open, but DON'T propagate to child onClick
  const handleContentClick = (e: React.MouseEvent) => {
    if (isSwipeOpen) {
      e.stopPropagation();
      e.preventDefault();
      resetSwipe();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {/* Action buttons behind the content */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          display: 'flex',
          zIndex: 0,
        }}
      >
        {onEdit && (
          <button
            onClick={handleEdit}
            style={{
              width: `${ACTION_WIDTH}px`,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '4px',
              background: '#0a84ff',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
            }}
          >
            <Pencil size={16} />
            Editar
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            style={{
              width: `${ACTION_WIDTH}px`,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '4px',
              background: '#ff453a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
            }}
          >
            <Trash2 size={16} />
            Apagar
          </button>
        )}
      </div>

      {/* Swipeable content */}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleContentClick}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--bg-card-solid)',
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
          willChange: 'transform',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
};
