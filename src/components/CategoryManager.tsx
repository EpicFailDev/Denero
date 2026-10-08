import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { Tags, Plus, Trash2, FolderPlus, Tag, X } from 'lucide-react';
import { useFeedback } from './UIFeedback';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  family_id?: string | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface CategoryManagerProps {
  categories: Category[];
  familyId: string;
  onRefreshCategories: () => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  familyId,
  onRefreshCategories
}) => {
  const { showToast, confirm } = useFeedback();
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newSubName, setNewSubName] = useState('');
  
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch subcategories for listing
  const fetchAllSubcategories = async () => {
    try {
      const { data, error } = await api.listSubcategories();

      if (error) throw error;
      setSubcategories(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    fetchAllSubcategories();
  }, [categories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId) {
      setErrorMsg('Você precisa fazer parte de um grupo familiar para criar categorias customizadas.');
      return;
    }
    if (!newCatName) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await api.createCategory({
        name: newCatName,
        type: newCatType,
        color: newCatColor,
        family_id: familyId,
        icon: newCatType === 'income' ? 'payments' : 'shopping_bag'
      });

      if (error) throw error;
      
      setNewCatName('');
      await onRefreshCategories();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !newSubName) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await api.createSubcategory({
        category_id: selectedCategoryId,
        name: newSubName
      });

      if (error) throw error;

      setNewSubName('');
      await fetchAllSubcategories();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar subcategoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Categoria',
      message: 'Tem certeza que deseja excluir esta categoria? Isso também pode impactar os lançamentos vinculados.',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      const { error } = await api.deleteCategory(id);
      if (error) throw error;
      showToast('Categoria excluída.', 'success');
      await onRefreshCategories();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir categoria.', 'error');
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Subcategoria',
      message: 'Deseja realmente remover esta subcategoria?',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      const { error } = await api.deleteSubcategory(id);
      if (error) throw error;
      showToast('Subcategoria excluída.', 'success');
      await fetchAllSubcategories();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir subcategoria.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em' }}>
          Categorias & Subcategorias
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Gerencie e personalize a estrutura de classificação das suas receitas e despesas familiares
        </p>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          color: 'var(--color-expense)',
          fontSize: '0.85rem',
          lineHeight: '1.4'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="grid-2">
        {/* Left Column - Category management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Create Category */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-title)' }}>
              <Plus size={18} color="var(--color-primary)" /> Nova Categoria Customizada
            </h3>

            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div className="form-group">
                <label className="form-label">Nome da Categoria</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Supermercado, Presentes, Pet..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                  >
                    <option value="expense">Despesa (Saída)</option>
                    <option value="income">Receita (Entrada)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cor de Identificação</label>
                  <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      className="form-input"
                      style={{ padding: '0.2rem', width: '48px', height: '40px', cursor: 'pointer' }}
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                    />
                    <code style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{newCatColor.toUpperCase()}</code>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} disabled={loading}>
                Salvar Nova Categoria
              </button>
            </form>
          </div>

          {/* List Categories */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-title)' }}>
              <Tags size={18} color="var(--color-primary)" /> Categorias Cadastradas
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-color)',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: cat.color || '#9ca3af',
                      boxShadow: `0 0 8px ${cat.color || '#9ca3af'}`
                    }} />
                    <div>
                      <p style={{ fontSize: '0.92rem', fontWeight: '700', color: '#ffffff' }}>{cat.name}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {cat.type === 'income' ? 'Entrada (Receita)' : 'Saída (Despesa)'} • {cat.family_id ? 'Customizada' : 'Padrão Sistema'}
                      </p>
                    </div>
                  </div>
                  
                  {cat.family_id && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-expense)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(244, 63, 94, 0.03)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.03)'}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Subcategory management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Create Subcategory */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-title)' }}>
              <FolderPlus size={18} color="var(--color-primary)" /> Nova Subcategoria
            </h3>

            <form onSubmit={handleCreateSubcategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div className="form-group">
                <label className="form-label">Categoria Principal Vinculada</label>
                <select
                  className="form-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  required
                >
                  <option value="">Selecione a categoria pai...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.type === 'income' ? 'Receita' : 'Despesa'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nome da Subcategoria</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Gasolina, Cinema, Assinatura TV..."
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} disabled={loading || !selectedCategoryId}>
                Salvar Subcategoria
              </button>
            </form>
          </div>

          {/* List Subcategories Grouped */}
          <div className="glass-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-title)' }}>
              <Tag size={18} color="var(--color-primary)" /> Estrutura de Subcategorias
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {categories.map(cat => {
                const catSubs = subcategories.filter(s => s.category_id === cat.id);
                if (catSubs.length === 0) return null;
                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: cat.color || '#9ca3af'
                      }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingLeft: '0.75rem' }}>
                      {catSubs.map(sub => (
                        <div
                          key={sub.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.82rem',
                            color: '#ffffff',
                            fontWeight: 500,
                            transition: 'all var(--transition-fast)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                          {sub.name}
                          <button
                            onClick={() => handleDeleteSubcategory(sub.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-expense)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              padding: '0.15rem',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(244, 63, 94, 0.03)',
                              transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.03)'}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
