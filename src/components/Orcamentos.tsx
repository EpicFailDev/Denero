import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { parseNumber, parseLocalDate } from '../utils';
import { Receipt, Plus, Trash2, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useFeedback } from './UIFeedback';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
}

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  categories?: { name: string; color?: string };
}

interface Budget {
  id: string;
  family_id: string;
  category_id: string;
  limit_amount: number;
  period: string;
  created_at?: string;
  categories?: { name: string; color?: string | null } | null;
}

interface OrcamentosProps {
  familyId: string;
  categories: Category[];
  transactions: Transaction[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const Orcamentos: React.FC<OrcamentosProps> = ({ familyId, categories, transactions }) => {
  const { showToast, confirm } = useFeedback();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const fetchBudgets = useCallback(async () => {
    if (!familyId) return;
    const { data } = await api.listBudgets(familyId);
    setBudgets(data || []);
  }, [familyId]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Calculate spent per category this month
  const spentByCategory = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      const d = parseLocalDate(t.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
      map[t.category_id] = (map[t.category_id] || 0) + Math.abs(parseNumber(t.amount));
    });
    return map;
  }, [transactions]);

  const handleAdd = async () => {
    const limit = Math.abs(parseNumber(newLimit));
    if (!newCategoryId || limit <= 0 || !familyId) return;
    setSaving(true);
    const { error } = await api.createBudget({
      family_id: familyId,
      category_id: newCategoryId,
      limit_amount: limit,
      period: 'monthly',
    });
    if (!error) {
      setShowAdd(false);
      setNewCategoryId('');
      setNewLimit('');
      fetchBudgets();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Orçamento',
      message: 'Tem certeza que deseja apagar este orçamento por categoria?',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!ok) return;

    await api.deleteBudget(id);
    showToast('Orçamento excluído.', 'info');
    fetchBudgets();
  };

  const totalBudget = budgets.reduce((s, b) => s + b.limit_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentByCategory[b.category_id] || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
            Orçamentos
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Defina e acompanhe os limites de gasto por categoria.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Novo Orçamento
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total Orçado', value: fmt(totalBudget), color: 'var(--color-meta)', icon: <Receipt size={18} /> },
          { label: 'Total Gasto', value: fmt(totalSpent), color: totalSpent > totalBudget ? 'var(--color-expense)' : 'var(--color-income)', icon: <TrendingUp size={18} /> },
          { label: 'Saldo', value: fmt(totalBudget - totalSpent), color: totalBudget - totalSpent >= 0 ? 'var(--color-income)' : 'var(--color-expense)', icon: <TrendingDown size={18} /> },
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
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Budget List */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {budgets.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Receipt size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Nenhum orçamento configurado. Clique em "Novo Orçamento" para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {budgets.map((b) => {
              const spent = spentByCategory[b.category_id] || 0;
              const pct = b.limit_amount > 0 ? Math.min(Math.round((spent / b.limit_amount) * 100), 100) : 0;
              const exceeded = spent > b.limit_amount;
              const catColor = b.categories?.color || '#6b7280';

              return (
                <div key={b.id} style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: `${catColor}20`, border: `1px solid ${catColor}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: catColor, fontSize: '0.85rem', fontWeight: 800, flexShrink: 0,
                  }}>
                    {(b.categories?.name || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>{b.categories?.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {fmt(spent)} / {fmt(b.limit_amount)}
                        </span>
                        <button onClick={() => handleDelete(b.id)} style={{
                          background: 'none', border: 'none', color: 'var(--color-expense)',
                          cursor: 'pointer', padding: '0.25rem', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '50px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: '50px',
                          background: exceeded
                            ? 'linear-gradient(90deg, var(--color-expense), #fb7185)'
                            : pct > 80
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : `linear-gradient(90deg, ${catColor}, ${catColor}cc)`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, minWidth: '35px', textAlign: 'right',
                        color: exceeded ? 'var(--color-expense)' : pct > 80 ? '#f59e0b' : catColor,
                      }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Novo Orçamento</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Limite Mensal (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || !newCategoryId || !newLimit}>
                {saving ? 'Salvando...' : 'Criar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
