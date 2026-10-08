import React from 'react';
import { Settings } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onSettingsClick?: () => void;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  onSettingsClick,
  rightAction,
}) => {
  return (
    <header className="ios-header">
      <div className="ios-header-content">
        <div className="ios-header-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 key={title} className="ios-header-large-title ios-title-anim">{title}</h1>
            {subtitle && <p className="ios-header-subtitle">{subtitle}</p>}
          </div>
          <div className="ios-header-actions">
            {rightAction}
            {onSettingsClick && (
              <button className="ios-header-btn" onClick={onSettingsClick}>
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
