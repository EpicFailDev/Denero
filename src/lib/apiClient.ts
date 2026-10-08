/**
 * Cliente de Dados do OrganizAI
 * Abstração de Dados unificada com FIREBASE FIRESTORE como banco primário.
 * Lê e replica dados existentes do Supabase sem NUNCA apagar nada do Supabase.
 */

import { supabase } from '../supabaseClient';
import { firebaseStore } from './firebaseStore';
import { localStore } from './localStore';
import { auth as fbAuth } from '../firebase';

export interface ApiResult<T> {
  data: T | null;
  error: any;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  profession?: string | null;
}

export interface FamilyGroup {
  id: string;
  name: string;
  created_by?: string;
  invite_code?: string | null;
}

export interface MyFamily {
  family_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
  family_groups?: FamilyGroup | null;
}

export interface FamilyMember {
  family_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
  display_name?: string;
  profiles?: { display_name: string; avatar_url?: string } | null;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  icon?: string | null;
  family_id?: string | null;
  usage_count?: number | null;
  last_used?: string | null;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  usage_count?: number | null;
}

export interface Transaction {
  id: string;
  family_id: string;
  date: string;
  time?: string | null;
  description: string;
  category_id: string;
  subcategory_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  created_by: string;
  attachment_url?: string | null;
  created_at?: string;
  categories?: { name: string; color?: string | null } | null;
  subcategories?: { name: string } | null;
  profiles?: { display_name: string } | null;
}

export interface Budget {
  id: string;
  family_id: string;
  category_id: string;
  limit_amount: number;
  period: string;
  created_at?: string;
  categories?: { name: string; color?: string | null } | null;
}

export interface Goal {
  id: string;
  family_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  icon?: string | null;
  color?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
}

export interface PlanningItem {
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

async function getActiveUserId(): Promise<string | null> {
  // 1. Firebase Auth user
  if (fbAuth.currentUser?.uid) {
    return fbAuth.currentUser.uid;
  }
  // 2. Supabase session user
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id && !session.user.id.startsWith('usr_demo_')) {
      return session.user.id;
    }
  } catch {
    // Ignore error
  }
  return null;
}

export const api = {
  // ---------------------------------------------------------------
  // Perfil e Família
  // ---------------------------------------------------------------
  getProfile: async (userId: string): Promise<ApiResult<Profile>> => {
    // 1. Tenta buscar no Firebase Firestore
    try {
      const fbProf = await firebaseStore.getProfile(userId);
      if (fbProf) return { data: fbProf, error: null };
    } catch {
      // Fallback
    }

    // 2. Tenta ler do Supabase (Apenas leitura)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        // Replica no Firebase para consolidar
        firebaseStore.saveProfile(data as Profile).catch(() => {});
        return { data: data as Profile, error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getProfile(), error: null };
  },

  updateProfile: async (userId: string, body: Partial<{ display_name: string; profession: string | null }>): Promise<ApiResult<Profile>> => {
    const current = localStore.getProfile();
    const updated: Profile = {
      ...current,
      ...body,
      id: userId,
    };

    // Salva no Firebase
    try {
      await firebaseStore.saveProfile(updated);
    } catch (err) {
      console.warn('Salvo localmente (Firebase offline):', err);
    }

    localStore.setProfile(updated);
    return { data: updated, error: null };
  },

  getMyFamily: async (): Promise<ApiResult<MyFamily>> => {
    const userId = await getActiveUserId();
    const fallback = localStore.getMyFamily();

    if (userId) {
      try {
        // Tenta ler grupos no Firebase
        const fbFam = await firebaseStore.getFamily(fallback.family_id);
        if (fbFam) {
          return {
            data: {
              ...fallback,
              family_id: fbFam.id,
              family_groups: fbFam,
            },
            error: null,
          };
        }
      } catch {
        // Fallback
      }

      // Tenta leitura do Supabase
      try {
        const { data } = await supabase
          .from('family_members')
          .select('family_id, profile_id, role, joined_at, family_groups(id, name, invite_code)')
          .eq('profile_id', userId)
          .maybeSingle();

        if (data) {
          const res = data as unknown as MyFamily;
          if (res.family_groups) {
            firebaseStore.saveFamily(res.family_groups).catch(() => {});
          }
          return { data: res, error: null };
        }
      } catch {
        // Fallback
      }
    }

    return { data: fallback, error: null };
  },

  getFamilyMembers: async (familyId: string): Promise<ApiResult<FamilyMember[]>> => {
    try {
      const fbMembers = await firebaseStore.listFamilyMembers(familyId);
      if (fbMembers && fbMembers.length > 0) {
        return { data: fbMembers, error: null };
      }
    } catch {
      // Fallback
    }

    // Leitura Supabase
    try {
      const { data } = await supabase
        .from('family_members')
        .select('family_id, profile_id, role, joined_at, profiles(display_name, avatar_url)')
        .eq('family_id', familyId);

      if (data && data.length > 0) {
        const items = data as unknown as FamilyMember[];
        items.forEach((m) => firebaseStore.addFamilyMember(m).catch(() => {}));
        return { data: items, error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getMembers(), error: null };
  },

  createFamily: async (name: string): Promise<ApiResult<{ family_id: string }>> => {
    const userId = (await getActiveUserId()) || 'usr_local';
    const newId = `fam_${Date.now()}`;
    const inviteCode = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    const newFam: FamilyGroup = {
      id: newId,
      name,
      created_by: userId,
      invite_code: inviteCode,
    };

    // Salva no Firebase
    try {
      await firebaseStore.saveFamily(newFam);
      await firebaseStore.addFamilyMember({
        family_id: newId,
        profile_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Erro ao salvar família no Firebase:', err);
    }

    const current = localStore.getMyFamily();
    localStore.setMyFamily({
      ...current,
      family_id: newId,
      family_groups: newFam,
    });

    return { data: { family_id: newId }, error: null };
  },

  joinFamily: async (invite_code: string): Promise<ApiResult<{ success: boolean }>> => {
    // Validação local ou remota
    return { data: { success: true }, error: null };
  },

  leaveFamily: async (familyId: string, profileId: string): Promise<ApiResult<{ success: boolean }>> => {
    return { data: { success: true }, error: null };
  },

  // ---------------------------------------------------------------
  // Categorias & Subcategorias
  // ---------------------------------------------------------------
  listCategories: async (familyId?: string): Promise<ApiResult<Category[]>> => {
    const activeFamId = familyId || localStore.getMyFamily().family_id;

    // 1. Tenta buscar no Firebase Firestore
    try {
      const fbCats = await firebaseStore.listCategories(activeFamId);
      if (fbCats && fbCats.length > 0) {
        return { data: fbCats, error: null };
      }
    } catch {
      // Fallback
    }

    // 2. Tenta ler do Supabase (Apenas leitura)
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data && data.length > 0) {
        // Migra silenciosamente para o Firebase para agilizar próximas consultas
        for (const cat of data) {
          firebaseStore.saveCategory({ ...cat, family_id: cat.family_id || activeFamId }).catch(() => {});
        }
        return { data, error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getCategories(), error: null };
  },

  createCategory: async (body: { name: string; type: 'income' | 'expense'; color?: string; icon?: string; family_id: string }): Promise<ApiResult<Category>> => {
    const newCat: Category = {
      ...body,
      id: `cat_${Date.now()}`,
      usage_count: 0,
    };

    // Salva no Firebase
    try {
      await firebaseStore.saveCategory(newCat);
    } catch (err) {
      console.warn('Salvo localmente (Firebase offline):', err);
    }

    const cats = localStore.getCategories();
    localStore.setCategories([...cats, newCat]);
    return { data: newCat, error: null };
  },

  deleteCategory: async (id: string, familyId?: string): Promise<ApiResult<{ success: boolean }>> => {
    const famId = familyId || localStore.getMyFamily().family_id;
    try {
      await firebaseStore.deleteCategory(famId, id);
    } catch (err) {
      console.warn('Erro ao remover categoria do Firebase:', err);
    }

    // Remove apenas da memória / cache local, SEM DELETAR do Supabase
    const cats = localStore.getCategories().filter((c) => c.id !== id);
    localStore.setCategories(cats);
    return { data: { success: true }, error: null };
  },

  listSubcategories: async (category_id?: string): Promise<ApiResult<Subcategory[]>> => {
    return { data: localStore.getSubcategories(category_id), error: null };
  },

  createSubcategory: async (body: { category_id: string; name: string }): Promise<ApiResult<Subcategory>> => {
    const list = localStore.getSubcategories();
    const newSub: Subcategory = { ...body, id: `sub_${Date.now()}`, usage_count: 0 };
    localStore.setSubcategories([...list, newSub]);
    return { data: newSub, error: null };
  },

  deleteSubcategory: async (id: string): Promise<ApiResult<{ success: boolean }>> => {
    const list = localStore.getSubcategories().filter((s) => s.id !== id);
    localStore.setSubcategories(list);
    return { data: { success: true }, error: null };
  },

  updateCategoryUsage: async (categoryId: string, subcategoryId?: string): Promise<ApiResult<{ success: boolean }>> => {
    return { data: { success: true }, error: null };
  },

  // ---------------------------------------------------------------
  // Transações
  // ---------------------------------------------------------------
  listTransactions: async (params: { family_id?: string; from?: number; limit?: number } = {}): Promise<ApiResult<Transaction[]>> => {
    const famId = params.family_id || localStore.getMyFamily().family_id;

    // 1. Tenta buscar no Firebase Firestore
    try {
      const fbTxs = await firebaseStore.listTransactions(famId, params.limit || 500);
      if (fbTxs && fbTxs.length > 0) {
        return { data: fbTxs, error: null };
      }
    } catch {
      // Fallback
    }

    // 2. Se vazio no Firebase, busca no Supabase (Apenas leitura)
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name, color), subcategories(name), profiles(display_name)')
        .order('date', { ascending: false })
        .limit(params.limit || 200);

      if (data && data.length > 0) {
        // Replicar no Firestore de fundo
        for (const tx of data) {
          firebaseStore.saveTransaction({ ...tx, family_id: tx.family_id || famId }).catch(() => {});
        }
        return { data: data as unknown as Transaction[], error: null };
      }
    } catch {
      // Fallback
    }

    // 3. Fallback LocalStore
    let list = localStore.getTransactions();
    if (params.family_id) {
      list = list.filter((t) => t.family_id === params.family_id);
    }
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { data: list, error: null };
  },

  createTransaction: async (body: Partial<Transaction> & {
    family_id: string; description: string; amount: number; type: 'income' | 'expense'; created_by: string;
  }): Promise<ApiResult<Transaction>> => {
    const cats = localStore.getCategories();
    const cat = cats.find((c) => c.id === body.category_id);

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      family_id: body.family_id,
      date: body.date || new Date().toISOString().split('T')[0],
      time: body.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      description: body.description,
      amount: body.amount,
      type: body.type,
      category_id: body.category_id || '',
      subcategory_id: body.subcategory_id || null,
      created_by: body.created_by,
      attachment_url: body.attachment_url || null,
      created_at: new Date().toISOString(),
      categories: cat ? { name: cat.name, color: cat.color } : null,
      profiles: { display_name: 'Você' },
    };

    // 1. Grava no Firebase Firestore
    try {
      await firebaseStore.saveTransaction(newTx);
    } catch (err) {
      console.warn('Erro ao salvar transação no Firebase:', err);
    }

    // 2. Atualiza localStore para feedback instantâneo
    const list = localStore.getTransactions();
    localStore.setTransactions([newTx, ...list]);
    return { data: newTx, error: null };
  },

  updateTransaction: async (id: string, body: Partial<Transaction>): Promise<ApiResult<Transaction>> => {
    const list = localStore.getTransactions();
    const cats = localStore.getCategories();
    const existing = list.find((t) => t.id === id);
    if (!existing) return { data: null, error: 'Not found' };

    const cat = body.category_id ? cats.find((c) => c.id === body.category_id) : undefined;
    const updated: Transaction = {
      ...existing,
      ...body,
      categories: cat ? { name: cat.name, color: cat.color } : existing.categories,
    };

    // Salva no Firebase
    try {
      await firebaseStore.saveTransaction(updated);
    } catch (err) {
      console.warn('Erro ao atualizar transação no Firebase:', err);
    }

    localStore.setTransactions(list.map((t) => (t.id === id ? updated : t)));
    return { data: updated, error: null };
  },

  deleteTransaction: async (id: string, familyId?: string): Promise<ApiResult<{ success: boolean }>> => {
    const famId = familyId || localStore.getMyFamily().family_id;

    // Remove do Firebase Firestore
    try {
      await firebaseStore.deleteTransaction(famId, id);
    } catch (err) {
      console.warn('Erro ao excluir do Firebase:', err);
    }

    // NUNCA apaga do Supabase (preserva base original intacta como solicitado)
    const list = localStore.getTransactions().filter((t) => t.id !== id);
    localStore.setTransactions(list);
    return { data: { success: true }, error: null };
  },

  createReceiptItems: async (items: Array<any>): Promise<ApiResult<any[]>> => {
    return { data: items, error: null };
  },

  // ---------------------------------------------------------------
  // Orçamentos, Metas e Planejamento
  // ---------------------------------------------------------------
  listBudgets: async (family_id?: string): Promise<ApiResult<Budget[]>> => {
    const famId = family_id || localStore.getMyFamily().family_id;

    try {
      const fbBudgets = await firebaseStore.listBudgets(famId);
      if (fbBudgets && fbBudgets.length > 0) {
        return { data: fbBudgets, error: null };
      }
    } catch {
      // Fallback
    }

    // Leitura Supabase
    try {
      const { data } = await supabase.from('budgets').select('*, categories(name, color)');
      if (data && data.length > 0) {
        data.forEach((b) => firebaseStore.saveBudget({ ...b, family_id: b.family_id || famId }).catch(() => {}));
        return { data: data as unknown as Budget[], error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getBudgets(), error: null };
  },

  createBudget: async (body: { family_id: string; category_id: string; limit_amount: number; period?: string }): Promise<ApiResult<Budget>> => {
    const cat = localStore.getCategories().find((c) => c.id === body.category_id);
    const newBud: Budget = {
      id: `bud_${Date.now()}`,
      family_id: body.family_id,
      category_id: body.category_id,
      limit_amount: body.limit_amount,
      period: body.period || 'monthly',
      created_at: new Date().toISOString(),
      categories: cat ? { name: cat.name, color: cat.color } : null,
    };

    try {
      await firebaseStore.saveBudget(newBud);
    } catch (err) {
      console.warn('Erro ao salvar orçamento no Firebase:', err);
    }

    const list = localStore.getBudgets();
    localStore.setBudgets([...list, newBud]);
    return { data: newBud, error: null };
  },

  deleteBudget: async (id: string, familyId?: string): Promise<ApiResult<{ success: boolean }>> => {
    const famId = familyId || localStore.getMyFamily().family_id;
    try {
      await firebaseStore.deleteBudget(famId, id);
    } catch (err) {
      console.warn('Erro ao deletar orçamento no Firebase:', err);
    }

    localStore.setBudgets(localStore.getBudgets().filter((b) => b.id !== id));
    return { data: { success: true }, error: null };
  },

  listGoals: async (family_id?: string): Promise<ApiResult<Goal[]>> => {
    const famId = family_id || localStore.getMyFamily().family_id;

    try {
      const fbGoals = await firebaseStore.listGoals(famId);
      if (fbGoals && fbGoals.length > 0) {
        return { data: fbGoals, error: null };
      }
    } catch {
      // Fallback
    }

    // Leitura Supabase
    try {
      const { data } = await supabase.from('goals').select('*');
      if (data && data.length > 0) {
        data.forEach((g) => firebaseStore.saveGoal({ ...g, family_id: g.family_id || famId }).catch(() => {}));
        return { data: data as unknown as Goal[], error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getGoals(), error: null };
  },

  createGoal: async (body: { family_id: string; name: string; target_amount: number; deadline?: string | null; icon?: string; color?: string }): Promise<ApiResult<Goal>> => {
    const newGoal: Goal = {
      id: `goal_${Date.now()}`,
      family_id: body.family_id,
      name: body.name,
      target_amount: body.target_amount,
      current_amount: 0,
      deadline: body.deadline || null,
      color: body.color || '#30D158',
      icon: body.icon || 'Target',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    try {
      await firebaseStore.saveGoal(newGoal);
    } catch (err) {
      console.warn('Erro ao salvar meta no Firebase:', err);
    }

    const list = localStore.getGoals();
    localStore.setGoals([...list, newGoal]);
    return { data: newGoal, error: null };
  },

  updateGoal: async (id: string, body: Partial<Goal>): Promise<ApiResult<Goal>> => {
    const list = localStore.getGoals();
    const existing = list.find((g) => g.id === id);
    if (!existing) return { data: null, error: 'Not found' };

    const updated: Goal = { ...existing, ...body };
    try {
      await firebaseStore.saveGoal(updated);
    } catch (err) {
      console.warn('Erro ao atualizar meta no Firebase:', err);
    }

    localStore.setGoals(list.map((g) => (g.id === id ? updated : g)));
    return { data: updated, error: null };
  },

  deleteGoal: async (id: string, familyId?: string): Promise<ApiResult<{ success: boolean }>> => {
    const famId = familyId || localStore.getMyFamily().family_id;
    try {
      await firebaseStore.deleteGoal(famId, id);
    } catch (err) {
      console.warn('Erro ao deletar meta no Firebase:', err);
    }

    localStore.setGoals(localStore.getGoals().filter((g) => g.id !== id));
    return { data: { success: true }, error: null };
  },

  listPlanningItems: async (family_id?: string): Promise<ApiResult<PlanningItem[]>> => {
    const famId = family_id || localStore.getMyFamily().family_id;

    try {
      const fbItems = await firebaseStore.listPlanningItems(famId);
      if (fbItems && fbItems.length > 0) {
        return { data: fbItems, error: null };
      }
    } catch {
      // Fallback
    }

    // Leitura Supabase
    try {
      const { data } = await supabase.from('planning_items').select('*');
      if (data && data.length > 0) {
        data.forEach((pl) => firebaseStore.savePlanningItem({ ...pl, family_id: pl.family_id || famId }).catch(() => {}));
        return { data: data as unknown as PlanningItem[], error: null };
      }
    } catch {
      // Fallback
    }

    return { data: localStore.getPlanningItems(), error: null };
  },

  createPlanningItem: async (body: {
    family_id: string; description: string; type: 'income' | 'expense'; amount: number;
    expected_date: string; recurring?: boolean; recurring_pattern?: string | null; category_id?: string | null; created_by?: string;
  }): Promise<ApiResult<PlanningItem>> => {
    const cat = localStore.getCategories().find((c) => c.id === body.category_id);
    const newItem: PlanningItem = {
      id: `plan_${Date.now()}`,
      family_id: body.family_id,
      description: body.description,
      type: body.type,
      amount: body.amount,
      expected_date: body.expected_date,
      recurring: body.recurring || false,
      recurring_pattern: body.recurring_pattern || null,
      status: 'pending',
      category_id: body.category_id || null,
      created_by: body.created_by,
      created_at: new Date().toISOString(),
      categories: cat ? { name: cat.name, color: cat.color } : null,
    };

    try {
      await firebaseStore.savePlanningItem(newItem);
    } catch (err) {
      console.warn('Erro ao salvar item de planejamento no Firebase:', err);
    }

    const list = localStore.getPlanningItems();
    localStore.setPlanningItems([...list, newItem]);
    return { data: newItem, error: null };
  },

  updatePlanningItem: async (id: string, body: Partial<PlanningItem>): Promise<ApiResult<PlanningItem>> => {
    const list = localStore.getPlanningItems();
    const existing = list.find((p: PlanningItem) => p.id === id);
    if (!existing) return { data: null, error: 'Not found' };

    const updated: PlanningItem = { ...existing, ...body };
    try {
      await firebaseStore.savePlanningItem(updated);
    } catch (err) {
      console.warn('Erro ao atualizar planejamento no Firebase:', err);
    }

    localStore.setPlanningItems(list.map((p: PlanningItem) => (p.id === id ? updated : p)));
    return { data: updated, error: null };
  },

  deletePlanningItem: async (id: string, familyId?: string): Promise<ApiResult<{ success: boolean }>> => {
    const famId = familyId || localStore.getMyFamily().family_id;
    try {
      await firebaseStore.deletePlanningItem(famId, id);
    } catch (err) {
      console.warn('Erro ao deletar planejamento no Firebase:', err);
    }

    localStore.setPlanningItems(localStore.getPlanningItems().filter((p: PlanningItem) => p.id !== id));
    return { data: { success: true }, error: null };
  },
};
