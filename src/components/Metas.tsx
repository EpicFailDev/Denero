import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient';
import { Target, Plus, Trash2, CheckCircle, X, TrendingUp, Trophy } from 'lucide-react';
import { useFeedback } from './UIFeedback';

interface Goal {
  id: string;
  family_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  icon?: string;
  color?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
}

interface MetasProps {
  familyId: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

/** Estima quando a meta será alcançada com base na taxa de economia atual. */
function forecastGoal(g: Goal): string | null {
  if (!g.created_at || g.current_amount <= 0 || g.target_amount <= g.current_amount) return null;
  const created = new Date(g.created_at);
  const now = new Date();
  const daysElapsed = Math.max(1, Math.floor((now.getTime() - created.getTime()) / 86400000));
  const ratePerDay = g.current_amount / daysElapsed; // R$/dia
  const remaining = g.target_amount - g.current_amount;
  const daysRemaining = Math.ceil(remaining / ratePerDay);
  if (!Number.isFinite(daysRemaining) || daysRemaining <= 0) return null;
  if (daysRemaining > 365 * 10) return 'Mais de 10 anos';
  const target = new Date(now.getTime() + daysRemaining * 86400000);
  return target.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

export const Metas: React.FC<MetasProps> = ({ familyId }) => {
  const { showToast, confirm } = useFeedback();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showContribute, setShowContribute] = useState<Goal | null>(null);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [contributeAmount, setContributeAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!familyId) return;
    const { data } = await api.listGoals(familyId);
    setGoals((data || []) as Goal[]);
  }, [familyId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  const handleAdd = async () => {
    if (!newName || !newTarget || !familyId) return;
    setSaving(true);
    const { error } = await api.createGoal({
      family_id: familyId,
      name: newName,
      target_amount: Number(newTarget),
      deadline: newDeadline || null,
      color: newColor,
    });
    if (!error) {
      setShowAdd(false);
      setNewName('');
      setNewTarget('');
      setNewDeadline('');
      fetchGoals();
    }
    setSaving(false);
  };

  const handleContribute = async () => {
    if (!showContribute || !contributeAmount) return;
    setSaving(true);
    const newAmount = showContribute.current_amount + Number(contributeAmount);
    const completed = newAmount >= showContribute.target_amount;
    const { error } = await api.updateGoal(showContribute.id, {
      current_amount: newAmount,
      status: completed ? 'completed' : 'active',
    });
    if (!error) {
      setShowContribute(null);
      setContributeAmount('');
      fetchGoals();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Meta',
      message: 'Tem certeza que deseja apagar esta meta financeira?',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!ok) return;

    await api.deleteGoal(id);
    showToast('Meta excluída.', 'info');
    fetchGoals();
  };

  const handleReset = async (id: string) => {
    await api.updateGoal(id, { current_amount: 0, status: 'active' });
    fetchGoals();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
            Metas Financeiras
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Crie e acompanhe suas metas de economia.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Metas Ativas', value: activeGoals.length.toString(), icon: <Target size={18} />, color: 'var(--color-primary)' },
          { label: 'Total Acumulado', value: fmt(activeGoals.reduce((s, g) => s + g.current_amount, 0)), icon: <TrendingUp size={18} />, color: '#3b82f6' },
          { label: 'Concluídas', value: completedGoals.length.toString(), icon: <Trophy size={18} />, color: '#f59e0b' },
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
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Goals Grid */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Target size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Nenhuma meta criada. Clique em "Nova Meta" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {activeGoals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100) : 0;
            const reached = pct >= 100;
            return (
              <div key={g.id} style={{
                background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
                border: `1px solid ${reached ? g.color + '40' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-lg)', padding: '1.5rem',
                boxShadow: reached ? `0 0 20px ${g.color}15` : 'var(--shadow-sm)',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: `${g.color}20`, border: `1px solid ${g.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: g.color,
                    }}>
                      <Target size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>{g.name}</h3>
                      {g.deadline && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Prazo: {new Date(g.deadline).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => handleReset(g.id)} style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                      padding: '0.25rem', borderRadius: '50%', display: 'flex',
                    }} title="Reiniciar">
                      <Target size={14} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} style={{
                      background: 'none', border: 'none', color: 'var(--color-expense)', cursor: 'pointer',
                      padding: '0.25rem', borderRadius: '50%', display: 'flex',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Values */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                    {fmt(g.current_amount)}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    de {fmt(g.target_amount)}
                  </span>
                </div>

                {/* Progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '50px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: '50px',
                      background: `linear-gradient(90deg, ${g.color}, ${g.color}cc)`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: g.color, minWidth: '35px', textAlign: 'right' }}>
                    {pct}%
                  </span>
                </div>

                {/* Forecast */}
                {(() => {
                  const forecast = forecastGoal(g);
                  if (!forecast) return null;
                  const remaining = g.target_amount - g.current_amount;
                  return (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Previsão: <strong style={{ color: g.color }}>{forecast}</strong></span>
                      <span>Faltam {fmt(remaining)}</span>
                    </div>
                  );
                })()}

                {/* Contribute Button */}
                <button className="btn-primary" style={{ width: '100%', padding: '0.65rem' }} onClick={() => { setShowContribute(g); setContributeAmount(''); }}>
                  Adicionar Valor
                </button>
              </div>
            );
          })}

          {/* Completed */}
          {completedGoals.map((g) => (
            <div key={g.id} style={{
              background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 'var(--radius-lg)', padding: '1.5rem', opacity: 0.7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <CheckCircle size={20} color="#10b981" />
                <span style={{ fontWeight: 700, color: '#fff' }}>{g.name}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {fmt(g.current_amount)} / {fmt(g.target_amount)} — Concluída!
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Nova Meta</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nome da Meta</label>
                <input className="form-input" placeholder="Ex: Viagem, Emergência..." value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Alvo (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Prazo (opcional)</label>
                <input className="form-input" type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} style={{
                      width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c,
                      border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', transition: 'border var(--transition-fast)',
                    }} />
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || !newName || !newTarget}>
                {saving ? 'Salvando...' : 'Criar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContribute && (
        <div className="modal-overlay" onClick={() => setShowContribute(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Adicionar a "{showContribute.name}"</h3>
              <button className="modal-close" onClick={() => setShowContribute(null)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Atual: {fmt(showContribute.current_amount)} / {fmt(showContribute.target_amount)}
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input className="form-input" type="number" placeholder="0,00" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} autoFocus />
            </div>
            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={handleContribute} disabled={saving || !contributeAmount}>
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
