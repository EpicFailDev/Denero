import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient';
import { parseNumber } from '../utils';
import { BarChart3, Plus, Trash2, Check, X, ArrowUpRight, ArrowDownRight, Repeat } from 'lucide-react';
import { useFeedback } from './UIFeedback';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
}

interface PlanningItem {
  id: string;
  family_id: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id?: string | null;
  expected_date: string;
  recurring?: boolean;
  recurring_pattern?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_by?: string;
  created_at?: string;
  categories?: { name: string; color?: string | null } | null;
}

interface PlanejamentoProps {
  familyId: string;
  categories: Category[];
  userId: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const Planejamento: React.FC<PlanejamentoProps> = ({ familyId, categories, userId }) => {
  const { showToast, confirm } = useFeedback();
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRecurring, setNewRecurring] = useState(false);
  const [newPattern, setNewPattern] = useState('monthly');
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!familyId) return;
    const { data } = await api.listPlanningItems(familyId);
    setItems(data || []);
  }, [familyId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);
  const totalIncome = filtered.filter((i) => i.type === 'income' && i.status !== 'cancelled').reduce((s, i) => s + Math.abs(parseNumber(i.amount)), 0);
  const totalExpense = filtered.filter((i) => i.type === 'expense' && i.status !== 'cancelled').reduce((s, i) => s + Math.abs(parseNumber(i.amount)), 0);

  const handleAdd = async () => {
    const parsedAmt = Math.abs(parseNumber(newAmount));
    if (!newDesc || parsedAmt <= 0 || !newDate || !familyId) return;
    setSaving(true);
    const { error } = await api.createPlanningItem({
      family_id: familyId,
      description: newDesc,
      type: newType,
      amount: parsedAmt,
      category_id: newCategoryId || null,
      expected_date: newDate,
      recurring: newRecurring,
      recurring_pattern: newRecurring ? newPattern : null,
      created_by: userId,
    });
    if (!error) {
      setShowAdd(false);
      setNewDesc('');
      setNewAmount('');
      setNewCategoryId('');
      setNewDate(new Date().toISOString().split('T')[0]);
      setNewRecurring(false);
      fetchItems();
    }
    setSaving(false);
  };

  const handleStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    await api.updatePlanningItem(id, { status });
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Planejamento',
      message: 'Deseja realmente remover este item do planejamento financeiro?',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!ok) return;

    await api.deletePlanningItem(id);
    showToast('Item removido do planejamento.', 'info');
    fetchItems();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
            Planejamento
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Projeção de receitas e despesas futuras.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Novo Item
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Projeção de Entradas', value: fmt(totalIncome), color: 'var(--color-income)', icon: <ArrowUpRight size={18} /> },
          { label: 'Projeção de Saídas', value: fmt(totalExpense), color: 'var(--color-expense)', icon: <ArrowDownRight size={18} /> },
          { label: 'Saldo Projetado', value: fmt(totalIncome - totalExpense), color: totalIncome - totalExpense >= 0 ? 'var(--color-income)' : 'var(--color-expense)', icon: <BarChart3 size={18} /> },
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.45rem 1rem', borderRadius: '50px', border: '1px solid',
            borderColor: filter === f ? 'var(--color-primary)' : 'var(--border-color)',
            backgroundColor: filter === f ? 'var(--color-primary-glow)' : 'transparent',
            color: filter === f ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-title)', transition: 'all var(--transition-fast)',
          }}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'confirmed' ? 'Confirmados' : 'Cancelados'}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <BarChart3 size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Nenhum item de planejamento encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((item) => {
              const catColor = item.categories?.color || '#6b7280';
              const isConfirmed = item.status === 'confirmed';
              const isCancelled = item.status === 'cancelled';
              return (
                <div key={item.id} style={{
                  padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  opacity: isCancelled ? 0.5 : 1,
                  backgroundColor: isConfirmed ? 'rgba(16,185,129,0.03)' : 'transparent',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => !isCancelled && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isConfirmed ? 'rgba(16,185,129,0.03)' : 'transparent'; }}
                >
                  {/* Type Icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: item.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                  }}>
                    {item.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                        {item.description}
                      </span>
                      {item.recurring && <Repeat size={12} color="var(--text-muted)" />}
                      {isConfirmed && <Check size={14} color="var(--color-income)" />}
                      {isCancelled && <X size={14} color="var(--color-expense)" />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(item.expected_date).toLocaleDateString('pt-BR')}
                      </span>
                      {item.categories && (
                        <span style={{ fontSize: '0.72rem', color: catColor, fontWeight: 600 }}>
                          {item.categories.name}
                        </span>
                      )}
                      {item.recurring && item.recurring_pattern && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '50px' }}>
                          {item.recurring_pattern === 'weekly' ? 'Semanal' : item.recurring_pattern === 'biweekly' ? 'Quinzenal' : item.recurring_pattern === 'monthly' ? 'Mensal' : 'Anual'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span style={{
                    fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 800,
                    color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                  }}>
                    {item.type === 'income' ? '+' : '-'} {fmt(Number(item.amount))}
                  </span>

                  {/* Actions */}
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => handleStatus(item.id, 'confirmed')} style={{
                        background: 'none', border: 'none', color: 'var(--color-income)', cursor: 'pointer',
                        padding: '0.3rem', borderRadius: '50%', display: 'flex',
                      }} title="Confirmar">
                        <Check size={16} />
                      </button>
                      <button onClick={() => handleStatus(item.id, 'cancelled')} style={{
                        background: 'none', border: 'none', color: 'var(--color-expense)', cursor: 'pointer',
                        padding: '0.3rem', borderRadius: '50%', display: 'flex',
                      }} title="Cancelar">
                        <X size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                        padding: '0.3rem', borderRadius: '50%', display: 'flex',
                      }} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Novo Planejamento</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input className="form-input" placeholder="Ex: Pagamento de aluguel" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={newType} onChange={(e) => setNewType(e.target.value as 'income' | 'expense')}>
                    <option value="income">Entrada</option>
                    <option value="expense">Saída</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" placeholder="0,00" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Categoria</label>
                  <select className="form-select" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {categories.filter((c) => c.type === newType).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Data Prevista</label>
                  <input className="form-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={newRecurring} onChange={(e) => setNewRecurring(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                  Recorrente
                </label>
                {newRecurring && (
                  <select className="form-select" value={newPattern} onChange={(e) => setNewPattern(e.target.value)} style={{ width: 'auto', flex: 1 }}>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                )}
              </div>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || !newDesc || !newAmount}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
