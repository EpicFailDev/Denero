import React from 'react';
import {
  Receipt,
  Plus,
  Target,
  Home,
  PieChart,
  Wallet,
} from 'lucide-react';
import { InteractiveMenu, type InteractiveMenuItem } from './InteractiveMenu';

interface MobileTabBarProps {
  currentView: string;
  setView: (view: string) => void;
  onAddTransactionClick: () => void;
  profession?: string;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentView,
  setView,
  onAddTransactionClick,
}) => {
  const getTabs = (): InteractiveMenuItem[] => {
    return [
      { id: 'dashboard', label: 'Início', icon: Home },
      { id: 'transactions', label: 'Extrato', icon: Receipt },
      { id: 'orcamentos', label: 'Orçamentos', icon: Wallet },
      { id: 'metas', label: 'Metas', icon: Target },
      { id: 'relatorios', label: 'Relatórios', icon: PieChart },
    ];
  };

  const tabs = getTabs();

  const getActiveTab = () => {
    if (currentView === 'dashboard') return 'dashboard';
    if (currentView === 'transactions' || currentView.startsWith('transactions-')) return 'transactions';
    if (currentView === 'orcamentos') return 'orcamentos';
    if (currentView === 'metas') return 'metas';
    if (currentView === 'relatorios') return 'relatorios';
    return 'dashboard';
  };

  const activeId = getActiveTab();

  return (
    <>
      <nav className="ios-tab-bar">
        <InteractiveMenu
          items={tabs}
          activeId={activeId}
          onItemChange={(id) => setView(id)}
          accentColor="var(--color-secondary, #0a84ff)"
        />
      </nav>

      {/* Floating Action Button (bottom-right) */}
      <button
        className="ios-fab-floating"
        onClick={onAddTransactionClick}
        aria-label="Nova transação"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </>
  );
};
