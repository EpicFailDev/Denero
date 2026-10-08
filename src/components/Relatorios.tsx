import React, { useMemo, useState } from 'react';
import { formatCurrency, parseNumber, parseLocalDate } from '../utils';
import {
  BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Calendar,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';

// Parse 'YYYY-MM-DD' como data LOCAL (new Date(str) é UTC e desloca o dia no BR)

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  categories?: { name: string; color?: string };
}

interface RelatoriosProps {
  transactions: Transaction[];
}

const fmt = (v: number) => formatCurrency(v);

export const Relatorios: React.FC<RelatoriosProps> = ({ transactions }) => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const filteredTx = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const d = parseLocalDate(t.date);
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
      }
      return d.getFullYear() === now.getFullYear();
    });
  }, [transactions, period]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTx.forEach((t) => {
      const amt = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return { income, expense, balance: income - expense };
  }, [filteredTx]);

  // Monthly evolution (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const data: { name: string; Entradas: number; Saídas: number; Saldo: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      data.push({
        name: d.toLocaleString('pt-BR', { month: 'short' }),
        Entradas: 0, Saídas: 0, Saldo: 0,
      });
    }
    transactions.forEach((t) => {
      const d = parseLocalDate(t.date);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diff < 0 || diff > 11) return;
      const idx = 11 - diff;
      const amt = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') data[idx].Entradas += amt;
      else data[idx].Saídas += amt;
    });
    let running = 0;
    return data.map((d) => {
      running += d.Entradas - d.Saídas;
      return { ...d, Entradas: Math.round(d.Entradas), Saídas: Math.round(d.Saídas), Saldo: Math.round(running) };
    });
  }, [transactions]);

  // Category breakdown (expenses)
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredTx.forEach((t) => {
      if (t.type !== 'expense') return;
      const name = t.categories?.name || 'Outros';
      const color = t.categories?.color || '#6b7280';
      const amt = Math.abs(parseNumber(t.amount));
      map[name] = { name, value: (map[name]?.value || 0) + amt, color };
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  const totalExpense = categoryBreakdown.reduce((s, c) => s + c.value, 0) || 1;

  // Top income categories
  const incomeBreakdown = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredTx.forEach((t) => {
      if (t.type !== 'income') return;
      const name = t.categories?.name || 'Outros';
      const color = t.categories?.color || '#10b981';
      const amt = Math.abs(parseNumber(t.amount));
      map[name] = { name, value: (map[name]?.value || 0) + amt, color };
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  const totalIncome = incomeBreakdown.reduce((s, c) => s + c.value, 0) || 1;

  // Daily average
  const daysInPeriod = (() => {
    const now = new Date();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const startMonth = q * 3;
      return new Date(now.getFullYear(), startMonth + 3, 0).getDate() // days in 3rd month of quarter
        + new Date(now.getFullYear(), startMonth + 2, 0).getDate() // days in 2nd month
        + new Date(now.getFullYear(), startMonth + 1, 0).getDate(); // days in 1st month
    }
    // year: check leap year
    return now.getFullYear() % 4 === 0 && (now.getFullYear() % 100 !== 0 || now.getFullYear() % 400 === 0) ? 366 : 365;
  })();
  const avgDaily = totals.balance / daysInPeriod;

  // Best/worst days
  const dailySums = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTx.forEach((t) => {
      const key = String(t.date).slice(0, 10);
      const amt = Math.abs(parseNumber(t.amount));
      map[key] = (map[key] || 0) + (t.type === 'income' ? amt : -amt);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredTx]);

  // Melhor = maior saldo positivo; Pior = menor saldo negativo.
  // Só faz sentido mostrar os dois quando são dias diferentes.
  const bestDay = dailySums.length > 0 && dailySums[0][1] > 0 ? dailySums[0] : null;
  const worstCandidate = dailySums.length > 0 ? dailySums[dailySums.length - 1] : null;
  const worstDay =
    worstCandidate && worstCandidate[1] < 0 && worstCandidate[0] !== bestDay?.[0]
      ? worstCandidate
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Relatórios
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Análise detalhada das suas finanças.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['month', 'quarter', 'year'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '0.45rem 1rem', borderRadius: '50px', border: '1px solid',
              borderColor: period === p ? 'var(--color-primary)' : 'var(--border-color)',
              backgroundColor: period === p ? 'var(--color-primary-glow)' : 'transparent',
              color: period === p ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-title)', transition: 'all var(--transition-fast)',
            }}>
              {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Entradas', value: fmt(totals.income), color: 'var(--color-income)', icon: <ArrowUpRight size={16} /> },
          { label: 'Saídas', value: fmt(totals.expense), color: 'var(--color-expense)', icon: <ArrowDownRight size={16} /> },
          { label: 'Saldo', value: fmt(totals.balance), color: totals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)', icon: <BarChart3 size={16} /> },
          { label: 'Média Diária', value: fmt(avgDaily), color: avgDaily >= 0 ? 'var(--color-income)' : 'var(--color-expense)', icon: <Calendar size={16} /> },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
            padding: '1.25rem', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{kpi.label}</span>
              <div style={{ color: kpi.color }}>{kpi.icon}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Evolution Chart */}
      <div style={{
        background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
        padding: '1.5rem', boxShadow: 'var(--shadow-md)',
      }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Evolução Mensal
        </h3>
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', fontSize: '0.72rem' }}>
          {[
            { label: 'Entradas', color: '#10b981' },
            { label: 'Saídas', color: '#ef4444' },
            { label: 'Saldo', color: 'var(--text-primary)' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: '16px', height: '2px', backgroundColor: l.color, borderRadius: '2px' }} />
              {l.label}
            </div>
          ))}
        </div>
        <div style={{ width: '100%', height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="relGradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="relGradExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip
                formatter={(value) => [fmt(Number(value)), '']}
                contentStyle={{ backgroundColor: 'var(--bg-card-solid)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
                labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#relGradIncome)" />
              <Area type="monotone" dataKey="Saídas" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#relGradExpense)" />
              <Area type="monotone" dataKey="Saldo" stroke="var(--text-primary)" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Expense Donut */}
        <div style={{
          background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', boxShadow: 'var(--shadow-md)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Despesas por Categoria
          </h3>
          {categoryBreakdown.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem dados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {categoryBreakdown.map((c, i) => {
                const pct = Math.round((c.value / totalExpense) * 100);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.name}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(c.value)}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Income Donut */}
        <div style={{
          background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', boxShadow: 'var(--shadow-md)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Receitas por Categoria
          </h3>
          {incomeBreakdown.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem dados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {incomeBreakdown.map((c, i) => {
                const pct = Math.round((c.value / totalIncome) * 100);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.name}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(c.value)}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Best/Worst Days */}
      {(bestDay || worstDay) && (
        <div style={{ display: 'grid', gridTemplateColumns: bestDay && worstDay ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
          {bestDay && (
          <div style={{
            background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
            padding: '1.5rem', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <TrendingUp size={16} color="var(--color-income)" />
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Melhor Dia</h3>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {parseLocalDate(bestDay[0]).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-income)' }}>
              {fmt(bestDay[1])}
            </div>
          </div>
          )}
          {worstDay && (
          <div style={{
            background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
            padding: '1.5rem', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <TrendingDown size={16} color="var(--color-expense)" />
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pior Dia</h3>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {parseLocalDate(worstDay[0]).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-expense)' }}>
              {fmt(worstDay[1])}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
