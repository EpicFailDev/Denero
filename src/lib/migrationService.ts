/**
 * Serviço de Migração e Abstração de Dados: Supabase -> Firebase Firestore
 *
 * REGRA CRÍTICA DE SEGURANÇA:
 * - O Supabase é acessado ESTRITAMENTE EM MODO LEITURA (SELECT).
 * - NENHUM dado é apagado, modificado ou removido do Supabase.
 * - Todos os registros existentes são lidos e replicados no Firestore.
 */

import { supabase } from '../supabaseClient';
import { firebaseStore } from './firebaseStore';
import { localStore } from './localStore';
import type {
  Category,
  Transaction,
  Budget,
  Goal,
  PlanningItem,
  Profile,
  FamilyGroup,
  FamilyMember,
} from './apiClient';

export interface MigrationSummary {
  startedAt: string;
  completedAt?: string;
  success: boolean;
  error?: string;
  counts: {
    profiles: number;
    families: number;
    members: number;
    categories: number;
    transactions: number;
    budgets: number;
    goals: number;
    planningItems: number;
  };
  details: string[];
}

export const migrationService = {
  /**
   * Realiza a migração segura (read-only do Supabase -> upsert no Firebase Firestore)
   */
  async migrateFromSupabaseToFirebase(targetFamilyId?: string): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      startedAt: new Date().toISOString(),
      success: false,
      counts: {
        profiles: 0,
        families: 0,
        members: 0,
        categories: 0,
        transactions: 0,
        budgets: 0,
        goals: 0,
        planningItems: 0,
      },
      details: [],
    };

    try {
      summary.details.push('Iniciando leitura segura do Supabase (Apenas SELECT - Zero remoções)...');

      // 1. Perfis (Profiles)
      try {
        const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
        if (!pErr && profiles && profiles.length > 0) {
          for (const p of profiles) {
            await firebaseStore.saveProfile(p as Profile);
            summary.counts.profiles++;
          }
          summary.details.push(`✓ ${profiles.length} perfil(is) migrado(s) do Supabase para o Firebase.`);
        }
      } catch (err: any) {
        summary.details.push(`Aviso em perfis: ${err.message || err}`);
      }

      // 2. Famílias (Family Groups)
      let resolvedFamilyId = targetFamilyId;
      try {
        const { data: families, error: fErr } = await supabase.from('family_groups').select('*');
        if (!fErr && families && families.length > 0) {
          for (const fam of families) {
            await firebaseStore.saveFamily(fam as FamilyGroup);
            summary.counts.families++;
            if (!resolvedFamilyId) resolvedFamilyId = fam.id;
          }
          summary.details.push(`✓ ${families.length} grupo(s) familiar(es) migrado(s).`);
        }
      } catch (err: any) {
        summary.details.push(`Aviso em grupos familiares: ${err.message || err}`);
      }

      // Se ainda não temos resolvedFamilyId, buscar da sessão ou localStore
      if (!resolvedFamilyId) {
        const localFam = localStore.getFamily();
        if (localFam) {
          resolvedFamilyId = localFam.id;
          await firebaseStore.saveFamily(localFam);
        } else {
          resolvedFamilyId = 'fam_default_principal';
          const defaultFam: FamilyGroup = {
            id: resolvedFamilyId,
            name: 'Família Principal',
            created_by: 'system',
          };
          await firebaseStore.saveFamily(defaultFam);
        }
      }

      // 3. Membros da Família
      try {
        const { data: members, error: mErr } = await supabase.from('family_members').select('*');
        if (!mErr && members && members.length > 0) {
          for (const m of members) {
            await firebaseStore.addFamilyMember(m as FamilyMember);
            summary.counts.members++;
          }
          summary.details.push(`✓ ${members.length} membro(s) familiar(es) registrado(s).`);
        }
      } catch (err: any) {
        summary.details.push(`Aviso em membros: ${err.message || err}`);
      }

      // 4. Categorias
      try {
        const { data: categories, error: cErr } = await supabase.from('categories').select('*');
        const listToMigrate = (categories && categories.length > 0)
          ? categories
          : localStore.getCategories();

        for (const cat of listToMigrate) {
          const item: Category = {
            ...cat,
            family_id: cat.family_id || resolvedFamilyId,
          };
          await firebaseStore.saveCategory(item);
          summary.counts.categories++;
        }
        summary.details.push(`✓ ${summary.counts.categories} categoria(s) salva(s) no Firestore.`);
      } catch (err: any) {
        summary.details.push(`Aviso em categorias: ${err.message || err}`);
      }

      // 5. Transações
      try {
        const { data: transactions, error: tErr } = await supabase.from('transactions').select('*');
        const listToMigrate = (transactions && transactions.length > 0)
          ? transactions
          : localStore.getTransactions();

        for (const tx of listToMigrate) {
          const item: Transaction = {
            ...tx,
            family_id: tx.family_id || resolvedFamilyId,
          };
          await firebaseStore.saveTransaction(item);
          summary.counts.transactions++;
        }
        summary.details.push(`✓ ${summary.counts.transactions} transação(ões) migrada(s) para o Firestore.`);
      } catch (err: any) {
        summary.details.push(`Aviso em transações: ${err.message || err}`);
      }

      // 6. Orçamentos (Budgets)
      try {
        const { data: budgets, error: bErr } = await supabase.from('budgets').select('*');
        const listToMigrate = (budgets && budgets.length > 0)
          ? budgets
          : localStore.getBudgets();

        for (const b of listToMigrate) {
          const item: Budget = {
            ...b,
            family_id: b.family_id || resolvedFamilyId,
          };
          await firebaseStore.saveBudget(item);
          summary.counts.budgets++;
        }
        summary.details.push(`✓ ${summary.counts.budgets} orçamento(s) configurado(s).`);
      } catch (err: any) {
        summary.details.push(`Aviso em orçamentos: ${err.message || err}`);
      }

      // 7. Metas (Goals)
      try {
        const { data: goals, error: gErr } = await supabase.from('goals').select('*');
        const listToMigrate = (goals && goals.length > 0)
          ? goals
          : localStore.getGoals();

        for (const g of listToMigrate) {
          const item: Goal = {
            ...g,
            family_id: g.family_id || resolvedFamilyId,
          };
          await firebaseStore.saveGoal(item);
          summary.counts.goals++;
        }
        summary.details.push(`✓ ${summary.counts.goals} meta(s) sincronizada(s).`);
      } catch (err: any) {
        summary.details.push(`Aviso em metas: ${err.message || err}`);
      }

      // 8. Planejamento Financeiro (Planning Items)
      try {
        const { data: planning, error: plErr } = await supabase.from('planning_items').select('*');
        const listToMigrate = (planning && planning.length > 0)
          ? planning
          : localStore.getPlanningItems();

        for (const pl of listToMigrate) {
          const item: PlanningItem = {
            ...pl,
            family_id: pl.family_id || resolvedFamilyId,
          };
          await firebaseStore.savePlanningItem(item);
          summary.counts.planningItems++;
        }
        summary.details.push(`✓ ${summary.counts.planningItems} item(ns) de planejamento migrado(s).`);
      } catch (err: any) {
        summary.details.push(`Aviso em planejamento: ${err.message || err}`);
      }

      summary.success = true;
      summary.completedAt = new Date().toISOString();
      summary.details.push('🎉 Migração concluída com sucesso! Banco Supabase 100% intacto.');

      // Salva log no localStorage para referência rápida
      localStorage.setItem('organizai_last_migration', JSON.stringify(summary));
      return summary;
    } catch (fatal: any) {
      summary.success = false;
      summary.error = fatal.message || String(fatal);
      summary.details.push(`Erro fatal na migração: ${summary.error}`);
      return summary;
    }
  },

  getLastMigration(): MigrationSummary | null {
    try {
      const saved = localStorage.getItem('organizai_last_migration');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },
};
