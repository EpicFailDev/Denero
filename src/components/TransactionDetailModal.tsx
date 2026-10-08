import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/apiClient';
import { X, Edit3, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react';
import { formatCurrency, parseNumber, parseLocalDate } from '../utils';
import { useSignedAttachmentUrl } from '../lib/storage';

interface Transaction {
  id: string;
  date: string;
  time?: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  subcategory_id?: string;
  created_by: string;
  attachment_url?: string;
  odometer_km?: number | null;
  categories?: { name: string; color?: string };
  subcategories?: { name: string };
  profiles?: { display_name: string };
  receipt_items?: ReceiptItem[];
}

interface ReceiptItem {
  id: string;
  transaction_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  line_number?: number;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface TransactionUpdate {
  date: string;
  time?: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  subcategory_id?: string | null;
  odometer_km?: number | null;
}

interface TransactionDetailModalProps {
  transaction: Transaction;
  categories: Category[];
  userId?: string;
  onClose: () => void;
  onUpdate: (id: string, updates: TransactionUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  categories,
  userId,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Dispara a classe .open num frame APÓS o mount, para a transição de subida
  // do sheet pegar (senão o conteúdo fica em translateY(100%) e nunca aparece).
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const [date, setDate] = useState(transaction.date || '');
  const [time, setTime] = useState(transaction.time || '');
  const [type, setType] = useState<'income' | 'expense'>(transaction.type || 'expense');
  const [description, setDescription] = useState(transaction.description || '');
  const [categoryId, setCategoryId] = useState(transaction.category_id || '');
  const [subcategoryId, setSubcategoryId] = useState(transaction.subcategory_id || '');
  const [amount, setAmount] = useState(String(Math.abs(parseNumber(transaction.amount))).replace('.', ','));
  const [odometer, setOdometer] = useState(transaction.odometer_km ? String(transaction.odometer_km) : '');
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const attachmentUrl = useSignedAttachmentUrl(transaction.attachment_url);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => c.type === type);
  }, [categories, type]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryId('');
      return;
    }
    const fetchSubcategories = async () => {
      const { data } = await api.listSubcategories(categoryId);
      setSubcategories(data || []);
    };
    fetchSubcategories();
    setSubcategoryId('');
  }, [categoryId]);

  useEffect(() => {
    if (!isEditing && subcategories.length > 0 && transaction.subcategory_id) {
      setSubcategoryId(transaction.subcategory_id);
    }
  }, [isEditing, subcategories.length, transaction.subcategory_id]);

  const handleCancelEdit = () => {
    setDate(transaction.date || '');
    setTime(transaction.time || '');
    setType(transaction.type || 'expense');
    setDescription(transaction.description || '');
    setCategoryId(transaction.category_id || '');
    setSubcategoryId(transaction.subcategory_id || '');
    setAmount(String(Math.abs(parseNumber(transaction.amount))).replace('.', ','));
    setOdometer(transaction.odometer_km ? String(transaction.odometer_km) : '');
    setErrorMsg('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!categoryId) { setErrorMsg('Selecione uma categoria.'); return; }
    const cleanAmount = Math.abs(parseNumber(amount));
    if (!amount || cleanAmount <= 0) { setErrorMsg('Valor inválido.'); return; }
    if (!description.trim()) { setErrorMsg('Descrição obrigatória.'); return; }

    setLoading(true);
    setErrorMsg('');
    try {
      await onUpdate(transaction.id, {
        date,
        time: time || undefined,
        description: description.trim(),
        type,
        amount: cleanAmount,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        odometer_km: odometer ? Math.round(parseNumber(odometer)) : null,
      });
      setIsEditing(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    try {
      await onDelete(transaction.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir.');
      setLoading(false);
    }
  };

  const isOwner = !userId || transaction.created_by === userId;

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="ios-list-item" style={{ cursor: 'default' }}>
      <div className="ios-list-item-content">
        <div className="ios-list-item-title" style={{ fontSize: '0.88rem' }}>{label}</div>
      </div>
      <span className="ios-list-item-value">{value}</span>
    </div>
  );

  return createPortal(
    <div className={`ios-sheet-overlay ${mounted ? 'open' : ''}`} onClick={onClose}>
      <div
        className="ios-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Handle */}
        <div className="ios-sheet-handle">
          <div className="ios-sheet-handle-bar" />
        </div>

        {/* Header */}
        <div className="ios-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`ios-pill ${type === 'income' ? 'green' : 'red'}`}>
              {type === 'income' ? 'Entrada' : 'Saída'}
            </span>
            {transaction.categories && (
              <span className="ios-pill blue">
                {transaction.categories.name}
              </span>
            )}
          </div>
          <button className="ios-sheet-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="ios-sheet-body" style={{ paddingTop: '0.75rem' }}>
          {errorMsg && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 58, 0.12)',
              borderRadius: 'var(--radius-xs)',
              padding: '0.65rem 0.85rem',
              color: '#ff453a',
              fontSize: '0.82rem',
              marginBottom: '1rem',
              lineHeight: 1.4,
            }}>
              {errorMsg}
            </div>
          )}

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Type toggle */}
              <div className="ios-segment">
                <button
                  type="button"
                  className={`ios-segment-btn ${type === 'expense' ? 'active' : ''}`}
                  onClick={() => setType('expense')}
                  style={type === 'expense' ? { color: '#ff453a' } : {}}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  className={`ios-segment-btn ${type === 'income' ? 'active' : ''}`}
                  onClick={() => setType('income')}
                  style={type === 'income' ? { color: '#30d158' } : {}}
                >
                  Receita
                </button>
              </div>

              {/* Amount */}
              <div className="ios-input-group">
                <label className="ios-input-label">Valor</label>
                <input type="text" className="ios-input" value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-title)' }} />
              </div>

              {/* Description */}
              <div className="ios-input-group">
                <label className="ios-input-label">Descrição</label>
                <input type="text" className="ios-input" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              {/* Date & Time */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="ios-input-group" style={{ flex: 1 }}>
                  <label className="ios-input-label">Data</label>
                  <input type="date" className="ios-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="ios-input-group" style={{ flex: 1 }}>
                  <label className="ios-input-label">Horário</label>
                  <input type="time" className="ios-input" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>

              {/* Category */}
              <div className="ios-input-group">
                <label className="ios-input-label">Categoria</label>
                <select className="ios-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {filteredCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <div className="ios-input-group">
                  <label className="ios-input-label">Subcategoria</label>
                  <select className="ios-select" value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {subcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Odômetro */}
              <div className="ios-input-group">
                <label className="ios-input-label">Odômetro (km)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="ios-input"
                  placeholder="Ex: 124.500"
                  value={odometer}
                  onChange={e => setOdometer(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="ios-btn ios-btn-secondary" onClick={handleCancelEdit} disabled={loading} style={{ flex: 1 }}>
                  <ArrowLeft size={16} /> Cancelar
                </button>
                <button className="ios-btn ios-btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1 }}>
                  {loading ? <><Loader2 size={16} className="ios-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Salvando...</> : <><Save size={16} /> Salvar</>}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Amount hero */}
              <div style={{ textAlign: 'center', padding: '0.75rem 0 1rem' }}>
                <div style={{
                  fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-title)',
                  color: type === 'income' ? '#30d158' : '#ff453a',
                  letterSpacing: '-0.02em',
                }}>
                  {type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(parseNumber(transaction.amount)))}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', marginTop: '0.25rem' }}>
                  {transaction.description}
                </div>
              </div>

              {/* Info rows */}
              <div className="ios-grouped-list" style={{ marginBottom: '1rem' }}>
                {infoRow('Data', parseLocalDate(transaction.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }))}
                {infoRow('Horário', transaction.time || '—')}
                {infoRow('Categoria', (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {transaction.categories?.color && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: transaction.categories.color }} />
                    )}
                    {transaction.categories?.name || 'Sem categoria'}
                  </span>
                ))}
                {infoRow('Subcategoria', transaction.subcategories?.name || '—')}
                {infoRow('Odômetro', transaction.odometer_km ? `${Number(transaction.odometer_km).toLocaleString('pt-BR')} km` : '—')}
                {infoRow('Membro', (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {transaction.profiles?.display_name?.split(' ')[0] || 'Membro'}
                  </span>
                ))}
              </div>

              {/* Receipt items */}
              {transaction.receipt_items && transaction.receipt_items.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="ios-section-header">
                    <span className="ios-section-title">Itens da Nota ({transaction.receipt_items.length})</span>
                  </div>
                  <div className="ios-grouped-list">
                    {transaction.receipt_items.map(item => (
                      <div key={item.id} className="ios-list-item" style={{ cursor: 'default' }}>
                        <div className="ios-list-item-content">
                          <div className="ios-list-item-title" style={{ fontSize: '0.88rem' }}>{item.item_name}</div>
                          <div className="ios-list-item-subtitle">
                            {item.quantity}x {formatCurrency(Number(item.unit_price))}
                          </div>
                        </div>
                        <span className="ios-list-item-value" style={{ color: '#ff453a' }}>
                          {formatCurrency(Number(item.total_price))}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem',
                    background: 'var(--bg-card-solid)', borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                    borderTop: '0.5px solid var(--separator)',
                  }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: '0.95rem', color: '#30d158', fontWeight: 800 }}>
                      {formatCurrency(transaction.receipt_items.reduce((sum, i) => sum + Number(i.total_price), 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Attachment */}
              {transaction.attachment_url && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="ios-section-header">
                    <span className="ios-section-title">Comprovante</span>
                  </div>
                  {attachmentUrl ? (
                    <>
                      <img
                        src={attachmentUrl}
                        alt="Comprovante"
                        style={{
                          width: '100%',
                          maxHeight: 200,
                          borderRadius: 'var(--radius-md)',
                          objectFit: 'contain',
                          background: 'rgba(0,0,0,0.2)',
                          border: '0.5px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowLightbox(true)}
                      />
                      {showLightbox && (
                        <div
                          style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 99999,
                            background: 'rgba(0,0,0,0.92)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem',
                          }}
                          onClick={() => setShowLightbox(false)}
                        >
                          <button
                            type="button"
                            onClick={() => setShowLightbox(false)}
                            style={{
                              position: 'absolute',
                              top: 'calc(var(--safe-top, 0px) + 1rem)',
                              right: '1rem',
                              background: 'rgba(255,255,255,0.15)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <X size={20} />
                          </button>
                          <img
                            src={attachmentUrl}
                            alt="Comprovante ampliado"
                            style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: '0.5rem' }}>Carregando...</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '0.5px solid var(--separator)', paddingTop: '1rem' }}>
                {isOwner && (
                  <button className="ios-btn ios-btn-secondary" onClick={() => setIsEditing(true)} style={{ flex: 1 }}>
                    <Edit3 size={16} /> Editar
                  </button>
                )}
                {isOwner && (
                  <button
                    className={`ios-btn ${confirmDelete ? 'ios-btn-destructive' : 'ios-btn-secondary'}`}
                    onClick={handleDelete}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? (
                      <><Loader2 size={16} className="ios-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Excluindo...</>
                    ) : confirmDelete ? (
                      'Confirmar'
                    ) : (
                      <><Trash2 size={16} /> Excluir</>
                    )}
                  </button>
                )}
                {confirmDelete && !loading && (
                  <button className="ios-btn ios-btn-secondary" onClick={() => setConfirmDelete(false)} style={{ flex: 1 }}>
                    Cancelar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
