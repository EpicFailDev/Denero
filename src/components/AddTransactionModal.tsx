import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { api } from '../lib/apiClient';
import { parseNumber } from '../utils';
import { useFeedback } from './UIFeedback';
import {
  X,
  Upload,
  Loader2,
  Calendar,
  Check,
  FileText,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Paperclip,
  Trash2,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  usage_count?: number | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  familyId: string;
  userId: string;
  onSuccess: () => Promise<void>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  categories,
  familyId,
  userId,
  onSuccess,
}) => {
  const { showToast, haptic } = useFeedback();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sugestões rápidas de descrição para finanças domésticas
  const quickExpenseTags = ['Supermercado', 'Farmácia', 'Aluguel', 'Energia Elétrica', 'Internet', 'Combustível', 'Restaurante', 'Lazer'];
  const quickIncomeTags = ['Salário', 'Adiantamento', 'Renda Extra', 'Rendimentos', 'Reembolso'];

  const filteredCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === type)
      .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0));
  }, [categories, type]);

  useEffect(() => {
    setCategoryId('');
    setSubcategoryId('');
  }, [type]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryId('');
      return;
    }
    api.listSubcategories(categoryId).then(({ data }) => {
      setSubcategories(data || []);
    });
  }, [categoryId]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite digitação natural de valores com vírgula ou ponto
    const val = e.target.value.replace(/[^\d.,]/g, '');
    setAmount(val);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('O comprovante deve ser menor que 5MB.', 'error');
        return;
      }
      setAttachment(file);
      showToast('Comprovante anexado.', 'info');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsed = parseNumber(amount);
    if (!parsed || parsed <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.');
      haptic([30, 50, 30]);
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Informe uma descrição para o lançamento.');
      haptic([30, 50, 30]);
      return;
    }

    setLoading(true);
    haptic(15);

    try {
      let attachmentUrl = '';
      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${familyId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, attachment);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
          attachmentUrl = urlData.publicUrl;
        }
      }

      const { error: txError } = await api.createTransaction({
        family_id: familyId,
        date,
        description: description.trim(),
        type,
        amount: parsed,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
        created_by: userId,
        attachment_url: attachmentUrl || undefined,
      });

      if (txError) throw txError;

      if (categoryId) {
        api.updateCategoryUsage(categoryId, subcategoryId || undefined).catch(() => {});
      }

      showToast(type === 'income' ? 'Receita adicionada!' : 'Despesa registrada!', 'success');
      haptic([20, 30, 20]);

      // Reset
      setDescription('');
      setAmount('');
      setCategoryId('');
      setSubcategoryId('');
      setAttachment(null);

      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar o lançamento.');
      showToast(err.message || 'Erro ao salvar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const setToday = () => setDate(new Date().toISOString().split('T')[0]);
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          backgroundColor: '#1c1c1e',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '0.5px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber Bar iOS */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
          <div style={{ width: '36px', height: '4.5px', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Novo Lançamento
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(235, 235, 245, 0.6)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body com scroll */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 69, 58, 0.15)',
                border: '1px solid rgba(255, 69, 58, 0.3)',
                color: '#ff453a',
                fontSize: '0.85rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Segmented Control Tipo (Despesa / Receita) */}
          <div
            style={{
              display: 'flex',
              padding: '4px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '14px',
              border: '0.5px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setType('expense');
                haptic(10);
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '11px',
                border: 'none',
                backgroundColor: type === 'expense' ? '#ff453a' : 'transparent',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowDownCircle size={16} />
              Despesa (Saída)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                haptic(10);
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '11px',
                border: 'none',
                backgroundColor: type === 'income' ? '#30d158' : 'transparent',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowUpCircle size={16} />
              Receita (Entrada)
            </button>
          </div>

          {/* Valor com Input Grande Estilo iOS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '1.25rem 1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '18px',
              border: '0.5px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(235, 235, 245, 0.4)', marginBottom: '4px' }}>
              Valor do Lançamento
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: type === 'income' ? '#30d158' : '#ff453a' }}>
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  width: '180px',
                  textAlign: 'left',
                }}
              />
            </div>

            {/* Atalhos de valores rápidos */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[20, 50, 100, 250, 500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAmount(String(v));
                    haptic(10);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '0.5px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(235, 235, 245, 0.8)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(235, 235, 245, 0.7)' }}>
              Descrição
            </label>
            <input
              type="text"
              placeholder={type === 'expense' ? 'Ex: Compras no Supermercado' : 'Ex: Salário da Empresa'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />

            {/* Chips rápidos de sugestão */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginTop: '2px' }}>
              {(type === 'expense' ? quickExpenseTags : quickIncomeTags).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setDescription(tag);
                    haptic(10);
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: description === tag ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: description === tag ? '0.5px solid #0a84ff' : '0.5px solid rgba(255, 255, 255, 0.08)',
                    color: description === tag ? '#409cff' : 'rgba(235, 235, 245, 0.7)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria e Subcategoria */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(235, 235, 245, 0.7)' }}>
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  haptic(10);
                }}
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '0.5px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="" style={{ backgroundColor: '#1c1c1e' }}>Selecione...</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: '#1c1c1e' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(235, 235, 245, 0.7)' }}>
                Subcategoria (opcional)
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={subcategories.length === 0}
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '0.5px solid rgba(255, 255, 255, 0.12)',
                  color: subcategories.length === 0 ? 'rgba(235, 235, 245, 0.3)' : '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="" style={{ backgroundColor: '#1c1c1e' }}>Geral</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: '#1c1c1e' }}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data e Atalhos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(235, 235, 245, 0.7)' }}>
                Data do Pagamento / Recebimento
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={setToday}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    color: '#0a84ff',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={setYesterday}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    color: 'rgba(235, 235, 245, 0.6)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Ontem
                </button>
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '0.5px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Comprovante / Anexo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(235, 235, 245, 0.7)' }}>
              Comprovante / Recibo (opcional)
            </label>
            {attachment ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(48, 209, 88, 0.12)',
                  border: '0.5px solid rgba(48, 209, 88, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Paperclip size={16} color="#30d158" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {attachment.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  color: 'rgba(235, 235, 245, 0.6)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Upload size={16} />
                <span>Toque para anexar foto ou PDF</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* Botão de Salvar Principal */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: type === 'income' ? '#30d158' : '#0a84ff',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: type === 'income' ? '0 4px 18px rgba(48, 209, 88, 0.35)' : '0 4px 18px rgba(10, 132, 255, 0.35)',
              marginTop: '0.5rem',
            }}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            <span>Salvar {type === 'income' ? 'Receita' : 'Despesa'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
