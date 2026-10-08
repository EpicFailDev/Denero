import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react';
import { 
  Search, 
  Trash2, 
  Image as ImageIcon, 
  Filter,
  X,
  FileText,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Circle,
  Tag,
  ListChecks,
} from 'lucide-react';
import { formatCurrency, parseNumber, parseLocalDate } from '../utils';
import { getSignedAttachmentUrl } from '../lib/storage';
import { TransactionDetailModal } from './TransactionDetailModal';
import { SwipeableRow } from './SwipeableRow';

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

interface TransactionUpdate {
  date: string;
  time?: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  subcategory_id?: string | null;
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onUpdateTransaction: (id: string, updates: TransactionUpdate) => Promise<void>;
  presetType?: 'income' | 'expense' | 'all';
  presetSearch?: string;
  userId: string;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({
  transactions,
  categories,
  onDeleteTransaction,
  onUpdateTransaction,
  presetType = 'all',
  presetSearch = '',
  userId
}) => {
  const [searchInput, setSearchInput] = useState(presetSearch);
  const searchTerm = useDeferredValue(searchInput);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState<'income' | 'expense' | 'all'>(presetType);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);

  // ── Modo de seleção (estilo iOS) ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startLongPress = (id: string) => {
    if (selectionMode) return;
    longPressTimer.current = window.setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds(new Set([id]));
      if (navigator.vibrate) navigator.vibrate(10);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openViewer = async (value?: string) => {
    if (!value) return;
    setViewerImage(null);
    const url = await getSignedAttachmentUrl(value);
    setViewerImage(url);
  };

  useEffect(() => {
    setSearchInput(presetSearch);
    setSelectedType(presetType);
  }, [presetSearch, presetType]);

  const filteredTransactions = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return transactions.filter(t => {
      const matchSearch = !searchTerm || t.description.toLowerCase().includes(lowerSearch) ||
                          t.categories?.name?.toLowerCase().includes(lowerSearch) ||
                          t.subcategories?.name?.toLowerCase().includes(lowerSearch);
      const matchCategory = selectedCategory === '' || t.category_id === selectedCategory;
      const matchType = selectedType === 'all' || t.type === selectedType;
      let matchDate = true;
      const tDate = t.date ? t.date.split('T')[0] : '';
      if (startDate) matchDate = tDate >= startDate;
      if (matchDate && endDate) matchDate = tDate <= endDate;
      return matchSearch && matchCategory && matchType && matchDate;
    }).sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  }, [transactions, searchTerm, selectedCategory, selectedType, startDate, endDate]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(t => {
      const amt = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      const dateKey = parseLocalDate(t.date).toLocaleDateString('pt-BR', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  const handleClearFilters = () => {
    setSearchInput('');
    setSelectedCategory('');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = searchInput || selectedCategory || selectedType !== 'all' || startDate || endDate;

  // ── Derivados / ações da seleção ──
  const allVisibleIds = useMemo(
    () => filteredTransactions.map((t) => t.id),
    [filteredTransactions]
  );
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  const selectedTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      if (!selectedIds.has(t.id)) return;
      const amt = Math.abs(parseNumber(t.amount));
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  }, [filteredTransactions, selectedIds]);

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allVisibleIds));
  };

  // Só oferece categorias compatíveis: se a seleção mistura entrada e saída, nenhuma serve.
  const bulkCategoryOptions = useMemo(() => {
    const types = new Set(
      filteredTransactions.filter((t) => selectedIds.has(t.id)).map((t) => t.type)
    );
    if (types.size !== 1) return [];
    const [only] = Array.from(types);
    return categories.filter((c) => c.type === only);
  }, [categories, filteredTransactions, selectedIds]);

  const handleBulkDelete = async () => {
    setBulkBusy(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await onDeleteTransaction(id);
      }
      setConfirmBulkDelete(false);
      exitSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkCategory = async (categoryId: string) => {
    setBulkBusy(true);
    try {
      for (const id of Array.from(selectedIds)) {
        const t = transactions.find((tx) => tx.id === id);
        if (!t) continue;
        // onUpdateTransaction exige o objeto completo: preserva tudo e troca só a categoria
        await onUpdateTransaction(id, {
          date: t.date,
          time: t.time,
          description: t.description,
          type: t.type,
          amount: Number(t.amount),
          category_id: categoryId,
          subcategory_id: null, // subcategoria antiga não pertence à nova categoria
        });
      }
      setBulkCategoryOpen(false);
      exitSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <>
      {/* ── Barra do modo de seleção (iOS) ── */}
      {selectionMode && (
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.75rem', padding: '0.7rem 0.9rem', marginBottom: '0.5rem',
            background: 'rgba(28,28,30,0.92)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--border-color)',
          }}
        >
          <button
            onClick={toggleSelectAll}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '0.88rem', fontWeight: 600,
              padding: 0,
            }}
          >
            <ListChecks size={16} />
            {allSelected ? 'Limpar' : 'Todos'}
          </button>

          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'selecionada' : 'selecionadas'}
            </div>
            {selectedIds.size > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {selectedTotals.net >= 0 ? '+' : '-'} {formatCurrency(Math.abs(selectedTotals.net))}
              </div>
            )}
          </div>

          <button
            onClick={exitSelection}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '0.88rem', fontWeight: 600,
              padding: 0,
            }}
          >
            Concluir
          </button>
        </div>
      )}

      {/* Botão para entrar no modo seleção */}
      {!selectionMode && filteredTransactions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
          <button
            onClick={() => setSelectionMode(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 600,
              padding: '0.25rem 0.1rem',
            }}
          >
            <ListChecks size={15} /> Selecionar
          </button>
        </div>
      )}

      {/* Summary bar */}
      {filteredTransactions.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
          background: 'var(--bg-card-solid)', borderRadius: 'var(--radius-md)',
          border: '0.5px solid var(--border-color)',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Entradas</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#30d158' }}>
              {formatCurrency(totals.income)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--separator)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Saídas</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ff453a' }}>
              {formatCurrency(totals.expense)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--separator)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Saldo</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: totals.balance >= 0 ? '#30d158' : '#ff453a' }}>
              {formatCurrency(totals.balance)}
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="ios-search-bar">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar transações..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            background: hasActiveFilters ? 'var(--color-primary)' : 'none',
            border: 'none',
            color: hasActiveFilters ? '#000' : 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="ios-card animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.85rem' }}>
          {/* Type filter pills */}
          <div className="ios-segment">
            <button
              className={`ios-segment-btn ${selectedType === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedType('all')}
            >
              Todos
            </button>
            <button
              className={`ios-segment-btn ${selectedType === 'income' ? 'active' : ''}`}
              onClick={() => setSelectedType('income')}
            >
              Entradas
            </button>
            <button
              className={`ios-segment-btn ${selectedType === 'expense' ? 'active' : ''}`}
              onClick={() => setSelectedType('expense')}
            >
              Saídas
            </button>
          </div>

          {/* Category filter */}
          <select
            className="ios-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Date range */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="date" className="ios-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
            <input type="date" className="ios-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
          </div>

          {hasActiveFilters && (
            <button onClick={handleClearFilters} style={{
              background: 'none', border: 'none', color: '#ff453a', fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', textAlign: 'center', padding: '0.25rem',
            }}>
              Limpar Filtros
            </button>
          )}
        </div>
      )}

      {/* Transaction list */}
      {filteredTransactions.length === 0 ? (
        <div className="ios-empty">
          <div className="ios-empty-icon">
            <Search size={28} />
          </div>
          <h3 className="ios-empty-title">Nenhuma transação</h3>
          <p className="ios-empty-desc">
            Nenhum lançamento encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        Object.entries(groupedTransactions).map(([dateLabel, txs]) => (
          <div key={dateLabel}>
            <div className="ios-section-header">
              <span className="ios-section-title" style={{ textTransform: 'none' }}>{dateLabel}</span>
            </div>
            <div className="ios-grouped-list stagger">
              {txs.map((t) => {
                const isSelected = selectedIds.has(t.id);
                const row = (
                <div
                  className="ios-list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (selectionMode) toggleSelected(t.id);
                    else setSelectedTransaction(t);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (selectionMode) toggleSelected(t.id);
                      else setSelectedTransaction(t);
                    }
                  }}
                  onTouchStart={() => startLongPress(t.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onMouseDown={() => startLongPress(t.id)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  style={{
                    background: isSelected ? 'var(--color-primary-glow)' : undefined,
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  {selectionMode && (
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: '0.1rem' }}>
                      {isSelected
                        ? <CheckCircle2 size={22} color="var(--color-primary)" />
                        : <Circle size={22} color="var(--text-quaternary)" />}
                    </div>
                  )}
                  <div className="ios-list-item-icon" style={{
                    background: t.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                    color: t.type === 'income' ? '#30d158' : '#ff453a',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {t.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                  <div className="ios-list-item-content" style={{ minWidth: 0 }}>
                    <div className="ios-list-item-title" style={{ fontSize: '0.95rem' }}>
                      {t.description}
                    </div>
                    <div className="ios-list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {t.time && <span>{t.time}</span>}
                      {t.categories?.name && (
                        <>
                          {t.time && <span>·</span>}
                          <span style={{ color: t.categories?.color || 'var(--text-secondary)' }}>{t.categories.name}</span>
                        </>
                      )}
                      {t.attachment_url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openViewer(t.attachment_url); }}
                          aria-label="Ver comprovante"
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            display: 'inline-flex', marginLeft: 2,
                          }}
                        >
                          <ImageIcon size={11} color="#30d158" />
                        </button>
                      )}
                      {t.receipt_items && t.receipt_items.length > 0 && (
                        <FileText size={11} color="#007aff" style={{ marginLeft: 2 }} />
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: t.type === 'income' ? '#30d158' : 'var(--text-primary)',
                    }}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(parseNumber(t.amount)))}
                    </span>
                    {t.profiles?.display_name && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-quaternary)' }}>
                        {t.profiles.display_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
                );

                return selectionMode ? (
                  <div key={t.id}>{row}</div>
                ) : (
                  <SwipeableRow
                    key={t.id}
                    onEdit={() => setSelectedTransaction(t)}
                    onDelete={() => setConfirmDelete(t)}
                  >
                    {row}
                  </SwipeableRow>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ── Barra de ações em lote (flutua acima da tab bar) ── */}
      {selectionMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(var(--tab-bar-height, 96px) + 0.5rem)',
            zIndex: 60, width: 'min(94vw, 460px)',
            display: 'flex', gap: '0.6rem', padding: '0.7rem',
            background: 'rgba(28,28,30,0.95)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-lg, 16px)',
            border: '0.5px solid var(--border-color)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          <button
            onClick={() => setBulkCategoryOpen(true)}
            disabled={bulkBusy}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.4rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
              border: '0.5px solid var(--border-color)', background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.86rem',
              cursor: bulkBusy ? 'default' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
            }}
          >
            <Tag size={16} /> Categoria
          </button>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkBusy}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.4rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
              border: '0.5px solid rgba(255,69,58,0.3)', background: 'rgba(255,69,58,0.14)',
              color: '#ff453a', fontWeight: 700, fontSize: '0.86rem',
              cursor: bulkBusy ? 'default' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
            }}
          >
            <Trash2 size={16} /> Excluir ({selectedIds.size})
          </button>
        </div>
      )}

      {/* ── Sheet: mudar categoria em lote ── */}
      {bulkCategoryOpen && (
        <div className="ios-sheet-overlay open" onClick={() => !bulkBusy && setBulkCategoryOpen(false)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ios-sheet-handle"><div className="ios-sheet-handle-bar" /></div>
            <div style={{ padding: '0.5rem 1.25rem 0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Mudar categoria
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {selectedIds.size} {selectedIds.size === 1 ? 'transação' : 'transações'} serão atualizadas.
              </p>
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '0 1rem 1.5rem' }}>
              {bulkCategoryOptions.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
                  Você selecionou entradas e saídas juntas. Selecione só de um tipo para trocar a categoria.
                </p>
              ) : bulkCategoryOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleBulkCategory(c.id)}
                  disabled={bulkBusy}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
                    padding: '0.85rem 0.75rem', marginBottom: '0.35rem',
                    borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-color)',
                    background: 'var(--bg-tertiary)', cursor: bulkBusy ? 'default' : 'pointer',
                    textAlign: 'left', opacity: bulkBusy ? 0.6 : 1,
                  }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: c.type === 'income' ? '#30d158' : '#ff453a', flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {c.name}
                  </span>
                  <ChevronRight size={15} color="var(--text-quaternary)" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação de exclusão em lote ── */}
      {confirmBulkDelete && (
        <div className="ios-sheet-overlay open" onClick={() => !bulkBusy && setConfirmBulkDelete(false)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'auto' }}>
            <div className="ios-sheet-handle"><div className="ios-sheet-handle-bar" /></div>
            <div style={{ padding: '1.25rem 1.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,69,58,0.15)', color: '#ff453a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.85rem',
              }}>
                <Trash2 size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Excluir {selectedIds.size} {selectedIds.size === 1 ? 'transação' : 'transações'}?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0 1.25rem' }}>
                Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkBusy}
                  style={{
                    flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-sm)',
                    border: '0.5px solid var(--border-color)', background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem',
                    cursor: bulkBusy ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  style={{
                    flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-sm)',
                    border: 'none', background: '#ff453a', color: '#fff',
                    fontWeight: 700, fontSize: '0.9rem',
                    cursor: bulkBusy ? 'default' : 'pointer', opacity: bulkBusy ? 0.7 : 1,
                  }}
                >
                  {bulkBusy ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onDelete={onDeleteTransaction}
          onUpdate={onUpdateTransaction}
          categories={categories}
          userId={userId}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="ios-sheet-overlay open" onClick={() => setConfirmDelete(null)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'auto' }}>
            <div className="ios-sheet-handle"><div className="ios-sheet-handle-bar" /></div>
            <div style={{ padding: '1.25rem 1.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255, 69, 58, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Trash2 size={22} color="#ff453a" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
                Excluir transação?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                "{confirmDelete.description}" — Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-xs)',
                    border: 'none', background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-title)',
                    fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await onDeleteTransaction(confirmDelete.id);
                    setConfirmDelete(null);
                  }}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-xs)',
                    border: 'none', background: '#ff453a',
                    color: '#fff', fontFamily: 'var(--font-title)',
                    fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer',
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {viewerImage && (
        <div className="ios-sheet-overlay open" onClick={() => setViewerImage(null)} style={{ alignItems: 'center' }}>
          <div className="ios-sheet" style={{ maxWidth: '90vw', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="ios-sheet-handle">
              <div className="ios-sheet-handle-bar" />
            </div>
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <img src={viewerImage} alt="Comprovante" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
