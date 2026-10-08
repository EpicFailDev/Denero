import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Home, Receipt, PieChart, Target, Users } from 'lucide-react';

type IconComponentType = React.ElementType<{ className?: string }>;

export interface InteractiveMenuItem {
  id?: string;
  label: string;
  icon: IconComponentType;
}

export interface InteractiveMenuProps {
  items?: InteractiveMenuItem[];
  accentColor?: string;
  activeId?: string;
  onItemChange?: (id: string, index: number) => void;
}

const defaultItems: InteractiveMenuItem[] = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'transactions', label: 'Extrato', icon: Receipt },
  { id: 'relatorios', label: 'Relatórios', icon: PieChart },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'family', label: 'Perfil', icon: Users },
];

const defaultAccentColor = 'var(--component-active-color-default, #0a84ff)';

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ 
  items, 
  accentColor,
  activeId,
  onItemChange 
}) => {
  const finalItems = useMemo(() => {
    const isValid = items && Array.isArray(items) && items.length >= 2 && items.length <= 5;
    if (!isValid) {
      if (items && Array.isArray(items) && items.length > 0) {
        console.warn("InteractiveMenu: 'items' prop is invalid or missing. Using default items.", items);
      }
      return defaultItems;
    }
    return items;
  }, [items]);

  const [internalActiveIndex, setInternalActiveIndex] = useState(0);

  // Sync activeIndex if activeId is provided externally
  const activeIndex = useMemo(() => {
    if (activeId !== undefined) {
      const idx = finalItems.findIndex(
        (item) => 
          (item.id && item.id === activeId) ||
          item.label.toLowerCase() === activeId.toLowerCase() ||
          (activeId.startsWith('transactions') && item.id?.startsWith('transactions'))
      );
      if (idx !== -1) return idx;
    }
    return internalActiveIndex;
  }, [activeId, finalItems, internalActiveIndex]);

  useEffect(() => {
    if (activeIndex >= finalItems.length) {
      setInternalActiveIndex(0);
    }
  }, [finalItems, activeIndex]);

  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const setLineWidth = () => {
      const activeItemElement = itemRefs.current[activeIndex];
      const activeTextElement = textRefs.current[activeIndex];

      if (activeItemElement && activeTextElement) {
        // Use scrollWidth to measure full intrinsic text width even if overflow/max-width is 0
        const textWidth = activeTextElement.scrollWidth || activeTextElement.offsetWidth || 60;
        activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`);
      }
    };

    setLineWidth();

    let timer: number;
    const raf = requestAnimationFrame(() => {
      setLineWidth();
      timer = window.setTimeout(setLineWidth, 50);
    });

    window.addEventListener('resize', setLineWidth);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', setLineWidth);
    };
  }, [activeIndex, finalItems]);

  const handleItemClick = (index: number) => {
    setInternalActiveIndex(index);
    const item = finalItems[index];
    if (onItemChange) {
      onItemChange(item.id || item.label, index);
    }
  };

  const navStyle = useMemo(() => {
    const activeColor = accentColor || defaultAccentColor;
    return { '--component-active-color': activeColor } as React.CSSProperties;
  }, [accentColor]);

  return (
    <nav
      className="menu"
      role="navigation"
      style={navStyle}
    >
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex;
        const isTextActive = isActive;

        const IconComponent = item.icon;

        return (
          <button
            key={item.id || item.label}
            className={`menu__item ${isActive ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(index);
            }}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
          >
            <div className="menu__icon">
              <IconComponent className="icon" />
            </div>
            <strong
              className={`menu__text ${isTextActive ? 'active' : ''}`}
              ref={(el) => {
                textRefs.current[index] = el;
              }}
            >
              {item.label}
            </strong>
          </button>
        );
      })}
    </nav>
  );
};

export { InteractiveMenu };
