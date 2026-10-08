import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  Target as TargetIcon,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Eye,
  EyeOff,
  Scale,
} from 'lucide-react';
import { useAppSettings } from '../useAppSettings';
import { api } from '../lib/apiClient';
import { parseNumber, parseLocalDate } from '../utils';
import {
  AreaChart,
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart, 
  Pie, 
  Cell
} from 'recharts';

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  subcategory_id?: string;
  categories?: { name: string; color?: string };
  profiles?: { display_name: string };
}

interface Goal {
  id: string;
  family_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  status: 'active' | 'completed' | 'cancelled';
}

interface DashboardProps {
  transactions: Transaction[];
  onNavigate?: (view: string) => void;
  profession?: string;
  familyId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  onNavigate,
  profession,
  familyId
}) => {
  const { formatCurrency } = useAppSettings();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [showBalance, setShowBalance] = useState(() => {
    return localStorage.getItem('organizai_hide_balance') !== 'true';
  });

  const toggleShowBalance = () => {
    setShowBalance((prev) => {
      const next = !prev;
      localStorage.setItem('organizai_hide_balance', next ? 'false' : 'true');
      return next;
    });
  };

  useEffect(() => {
    if (!familyId) return;
    api.listGoals(familyId).then(({ data }) => {
      setGoals(data || []);
    });
  }, [familyId]);

  const currentMonthTransactions = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return transactions.filter(t => {
      const d = parseLocalDate(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [transactions]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    currentMonthTransactions.forEach(t => {
      const amount = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') income += amount;
      else expense += amount;
    });
    return { income, expense, balance: income - expense };
  }, [currentMonthTransactions]);

  // Saldo TOTAL acumulado (todas as transações, não apenas o mês atual)
  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const amount = Math.abs(parseNumber(t.amount));
      return t.type === 'income' ? acc + amount : acc - amount;
    }, 0);
  }, [transactions]);

  const cashFlowData = useMemo(() => {
    // Início da semana atual (segunda-feira)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = today.getDay(); // 0=dom
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const data = labels.map((name) => ({ name, Receita: 0, Despesa: 0 }));

    transactions.forEach((t) => {
      const d = parseLocalDate(t.date);
      const diffDays = Math.floor((d.getTime() - monday.getTime()) / 86400000);
      if (diffDays < 0 || diffDays > 6) return; // fora da semana atual
      const amt = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') data[diffDays].Receita += amt;
      else data[diffDays].Despesa += amt;
    });

    return data.map((d) => ({
      ...d,
      Receita: Math.round(d.Receita),
      Despesa: Math.round(d.Despesa),
    }));
  }, [transactions]);

  const donutChartData = useMemo(() => {
    const expenseMap: Record<string, { name: string; value: number; color: string }> = {};
    currentMonthTransactions.forEach(t => {
      if (t.type === 'expense') {
        const cat = t.categories?.name || 'Outros';
        const color = t.categories?.color || '#6b7280';
        const amount = Math.abs(parseNumber(t.amount));
        if (expenseMap[cat]) expenseMap[cat].value += amount;
        else expenseMap[cat] = { name: cat, value: amount, color };
      }
    });
    const data = Object.values(expenseMap).sort((a, b) => b.value - a.value);
    return data.slice(0, 5);
  }, [currentMonthTransactions]);

  const totalExpenseSum = useMemo(() => 
    donutChartData.reduce((sum, item) => sum + item.value, 0),
    [donutChartData]
  );

  const recentList = useMemo(() => {
    const list = [...currentMonthTransactions]
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
      .slice(0, 5);
    return list.map(t => ({
      id: t.id,
      description: t.description,
      date: parseLocalDate(t.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
      type: t.type,
      amount: Math.abs(parseNumber(t.amount)),
      color: t.categories?.color || '#8e8e93',
    }));
  }, [currentMonthTransactions]);

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);

  const goalSummary = useMemo(() => {
    if (activeGoals.length === 0) {
      return {
        title: 'Meta do Mês',
        current: 0,
        target: 0,
        percentage: 0,
        hasGoals: false
      };
    }
    const totalCurrent = activeGoals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
    const totalTarget = activeGoals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0);
    const percentage = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;
    const title = activeGoals.length === 1 ? `Meta: ${activeGoals[0].name}` : 'Progresso das Metas';

    return {
      title,
      current: totalCurrent,
      target: totalTarget,
      percentage,
      hasGoals: true
    };
  }, [activeGoals]);

  return (
    <>
      {/* Balance hero */}
      <div
        className="ios-kpi-card primary"
        role="button"
        tabIndex={0}
        onClick={() => onNavigate?.('transactions')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.('transactions'); } }}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div className="ios-kpi-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ios-kpi-label">Saldo Acumulado</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleShowBalance();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
              aria-label="Ocultar ou exibir saldo"
            >
              {showBalance ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>
          <div className="ios-kpi-icon" style={{ background: 'rgba(48, 209, 88, 0.2)' }}>
            <Wallet size={16} color="#30d158" />
          </div>
        </div>
        <div className="ios-kpi-value" style={{ color: totalBalance >= 0 ? '#30d158' : '#ff453a' }}>
          {showBalance ? formatCurrency(totalBalance) : 'R$ ••••••'}
        </div>
        <div className="ios-kpi-trend up" style={{ color: 'var(--text-secondary)' }}>
          Total consolidado de todas as transações
        </div>
      </div>

      {/* KPI Grid */}
      <div className="ios-kpi-grid">
        <div
          className="ios-kpi-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate?.('entradas')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.('entradas');
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="ios-kpi-header">
            <span className="ios-kpi-label">Receitas do Mês</span>
            <ArrowUpRight size={14} color="#30d158" />
          </div>
          <div className="ios-kpi-value" style={{ color: '#30d158', fontSize: '1.25rem' }}>
            {showBalance ? formatCurrency(stats.income) : 'R$ •••••'}
          </div>
          <div className="ios-kpi-trend up" style={{ color: 'var(--text-tertiary)' }}>
            Entradas deste mês
          </div>
        </div>

        <div
          className="ios-kpi-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate?.('saidas')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.('saidas'); } }}
          style={{ cursor: 'pointer' }}
        >
          <div className="ios-kpi-header">
            <span className="ios-kpi-label">Despesas do Mês</span>
            <ArrowDownRight size={14} color="#ff453a" />
          </div>
          <div className="ios-kpi-value" style={{ color: '#ff453a', fontSize: '1.25rem' }}>
            {showBalance ? formatCurrency(stats.expense) : 'R$ •••••'}
          </div>
          <div className="ios-kpi-trend down" style={{ color: 'var(--text-tertiary)' }}>
            Saídas deste mês
          </div>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="ios-chart-card">
        <div className="ios-chart-card-header">
          <h3 className="ios-chart-card-title">Fluxo de Caixa</h3>
          <button className="ios-section-action" onClick={() => onNavigate?.('relatorios')}>
            Ver mais
          </button>
        </div>
        <div style={{ padding: '0 0.5rem 0.75rem' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', padding: '0 0.75rem 0.5rem', fontSize: '0.7rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 2, background: '#30d158', borderRadius: 2 }} />
              Receita Diária
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 2, background: '#ff453a', borderRadius: 2 }} />
              Despesa Diária
            </div>
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#30d158" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff453a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff453a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-quaternary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-quaternary)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value))]}
                  contentStyle={{ 
                    backgroundColor: '#2c2c2e', 
                    border: 'none',
                    borderRadius: 12, 
                    color: '#fff', 
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="Receita" stroke="#30d158" strokeWidth={2} fillOpacity={1} fill="url(#gIncome)" />
                <Area type="monotone" dataKey="Despesa" stroke="#ff453a" strokeWidth={2} fillOpacity={1} fill="url(#gExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="ios-chart-card">
        <div className="ios-chart-card-header">
          <h3 className="ios-chart-card-title">Distribuição de Gastos</h3>
          <button className="ios-section-action" onClick={() => onNavigate?.('relatorios')}>
            Ver mais
          </button>
        </div>
        {donutChartData.length === 0 ? (
          <div style={{ padding: '1.5rem 1rem 2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Nenhuma despesa registrada este mês
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
              Toque no + para adicionar uma transação
            </p>
          </div>
        ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1rem 1rem' }}>
          <div style={{ width: 120, height: 120, position: 'relative', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={donutChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={54}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center',
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                {formatCurrency(totalExpenseSum)}
              </p>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {donutChartData.slice(0, 4).map((item, idx) => {
              const pct = totalExpenseSum > 0 ? Math.round((item.value / totalExpenseSum) * 100) : 0;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.name}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Budget progress */}
      <div className="ios-card">
        <div
          className="ios-card-body"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate?.('metas')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.('metas'); } }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TargetIcon size={16} color="var(--color-meta)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{goalSummary.title}</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{goalSummary.percentage}%</span>
          </div>
          <div style={{
            width: '100%', height: 6, borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden'
          }}>
            <div style={{
              width: `${goalSummary.percentage}%`, height: '100%', borderRadius: 3,
              background: goalSummary.percentage >= 100 ? '#30d158' : 'var(--color-meta)',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              {formatCurrency(goalSummary.current)}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              {goalSummary.hasGoals ? formatCurrency(goalSummary.target) : 'Definir Meta'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="ios-section-header">
        <span className="ios-section-title">Últimas Transações</span>
        <button className="ios-section-action" onClick={() => onNavigate?.('transactions')}>
          Ver todas
        </button>
      </div>

      <div className="ios-grouped-list stagger">
        {recentList.length === 0 ? (
          <div style={{ padding: '1.75rem 1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Nenhuma transação este mês
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
              Suas transações de meses anteriores estão em “Ver todas”.
            </p>
          </div>
        ) : recentList.map((t) => (
          <div
            key={t.id}
            className="ios-list-item"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate?.('transactions')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.('transactions'); } }}
          >
            <div className="ios-list-item-icon" style={{
              background: t.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
              color: t.type === 'income' ? '#30d158' : '#ff453a',
            }}>
              {t.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
            <div className="ios-list-item-content">
              <div className="ios-list-item-title">{t.description}</div>
              <div className="ios-list-item-subtitle">{t.date}</div>
            </div>
            <span className="ios-tx-amount" style={{
              color: t.type === 'income' ? '#30d158' : '#ff453a',
            }}>
              {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
            </span>
            <ChevronRight size={14} color="var(--text-quaternary)" />
          </div>
        ))}
      </div>
    </>
  );
};
