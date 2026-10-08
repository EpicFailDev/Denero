import React, { useState, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { parseNumber, parseLocalDate } from '../utils';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  categories?: { name: string; color?: string };
  profiles?: { display_name: string };
}

interface CalendarioProps {
  transactions: Transaction[];
  categories: Category[];
  familyId: string;
  userId: string;
  onRefresh: () => Promise<void>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const Calendario: React.FC<CalendarioProps> = ({ transactions, categories, familyId, userId, onRefresh }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Transactions grouped by date
  const txByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach((t) => {
      const key = t.date;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [transactions]);

  // Summary for current month
  const monthSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let count = 0;
    transactions.forEach((t) => {
      const d = parseLocalDate(t.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        count++;
        const amt = Math.abs(parseNumber(t.amount));
        if (t.type === 'income') income += amt;
        else expense += amt;
      }
    });
    return { income, expense, balance: income - expense, count };
  }, [transactions, month, year]);

  // Selected day transactions
  const selectedDayTx = useMemo(() => {
    if (!selectedDay) return [];
    const key = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`;
    return txByDate[key] || [];
  }, [selectedDay, txByDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  const handleAdd = async () => {
    const parsedAmt = Math.abs(parseNumber(newAmount));
    if (!newDesc || parsedAmt <= 0 || !familyId) return;
    const dateStr = selectedDay
      ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`
      : today.toISOString().split('T')[0];
    setSaving(true);
    const { error } = await api.createTransaction({
      family_id: familyId,
      description: newDesc,
      type: newType,
      amount: parsedAmt,
      category_id: newCategoryId || categories[0]?.id || '',
      date: dateStr,
      created_by: userId,
    });
    if (!error) {
      setShowAdd(false);
      setNewDesc('');
      setNewAmount('');
      setNewCategoryId('');
      onRefresh();
    }
    setSaving(false);
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
            Calendário
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Visualize suas transações por dia.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={goToday} style={{ padding: '0.5rem 1rem' }}>
            <Clock size={14} /> Hoje
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Nova Transação
          </button>
        </div>
      </div>

      {/* Month Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Entradas', value: fmt(monthSummary.income), color: 'var(--color-income)' },
          { label: 'Saídas', value: fmt(monthSummary.expense), color: 'var(--color-expense)' },
          { label: 'Saldo', value: fmt(monthSummary.balance), color: monthSummary.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' },
          { label: 'Transações', value: monthSummary.count.toString(), color: 'var(--color-meta)' },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: '1rem',
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{kpi.label}</span>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, color: kpi.color, marginTop: '0.25rem' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 340px' : '1fr', gap: '1.25rem' }}>
        {/* Calendar Grid */}
        <div style={{
          background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', boxShadow: 'var(--shadow-md)',
        }}>
          {/* Month Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <button onClick={prevMonth} style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '0.5rem', borderRadius: '50%', display: 'flex',
            }}>
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '0.5rem', borderRadius: '50%', display: 'flex',
            }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.5rem' }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '70px' }} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTx = txByDate[key] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDay(date)}
                  aria-label={`Dia ${day}`}
                  style={{
                  aspectRatio: '1', minHeight: '70px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isSelected ? 'var(--color-primary)' : isToday ? 'rgba(255,255,255,0.12)' : 'var(--border-color)'}`,
                  backgroundColor: isSelected ? 'var(--color-primary-glow)' : isToday ? 'rgba(255,255,255,0.03)' : 'transparent',
                  padding: '0.35rem', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '0.15rem',
                  transition: 'all var(--transition-fast)',
                  fontFamily: 'var(--font-body)', textAlign: 'left',
                  }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isToday ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
                >
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    color: isToday ? '#fff' : isSelected ? '#fff' : 'var(--text-secondary)',
                    width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: isToday ? 'var(--color-primary)' : 'transparent',
                  }}>
                    {day}
                  </span>

                  {/* Transaction dots */}
                  {dayTx.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: 'auto' }}>
                      {dayTx.slice(0, 3).map((t, ti) => (
                        <div key={ti} style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          backgroundColor: t.type === 'income' ? '#10b981' : '#ef4444',
                        }} />
                      ))}
                      {dayTx.length > 3 && (
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>+{dayTx.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Panel */}
        {selectedDay && (
          <div style={{
            background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
            padding: '1.5rem', boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                padding: '0.25rem', borderRadius: '50%', display: 'flex',
              }}>
                <X size={16} />
              </button>
            </div>

            {selectedDayTx.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
                <Calendar size={32} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '0.82rem' }}>Sem transações neste dia</span>
                <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', marginTop: '0.5rem' }} onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
                {selectedDayTx.map((t) => (
                  <div key={t.id} style={{
                    padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: t.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: t.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)', flexShrink: 0,
                    }}>
                      {t.type === 'income' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {t.categories?.name}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.82rem', fontWeight: 800, flexShrink: 0,
                      color: t.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                    }}>
                      {t.type === 'income' ? '+' : '-'} {fmt(Math.abs(parseNumber(t.amount)))}
                    </span>
                  </div>
                ))}

                {/* Day total */}
                <div style={{
                  marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Saldo do dia</span>
                  <span style={{
                    fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-title)',
                    color: selectedDayTx.reduce((s, t) => s + (t.type === 'income' ? Math.abs(parseNumber(t.amount)) : -Math.abs(parseNumber(t.amount))), 0) >= 0
                      ? 'var(--color-income)' : 'var(--color-expense)',
                  }}>
                    {fmt(selectedDayTx.reduce((s, t) => s + (t.type === 'income' ? Math.abs(parseNumber(t.amount)) : -Math.abs(parseNumber(t.amount))), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                Nova Transação {selectedDay ? `— ${selectedDay.toLocaleDateString('pt-BR')}` : ''}
              </h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input className="form-input" placeholder="Ex: Supermercado, Salário, Internet" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
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
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {(newType === 'income' ? incomeCategories : expenseCategories).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || !newDesc || !newAmount}>
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
