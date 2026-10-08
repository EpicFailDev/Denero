/**
 * Serviço de dados do Firebase Firestore para o OrganizAI.
 * Implementa persistência total em Firestore com tratamento de erros padronizado.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Profile,
  FamilyGroup,
  FamilyMember,
  Category,
  Transaction,
  Budget,
  Goal,
  PlanningItem,
} from './apiClient';

export const firebaseStore = {
  // ── Profiles ──
  async getProfile(userId: string): Promise<Profile | null> {
    const p = `users/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return null;
      return snap.data() as Profile;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, p);
    }
  },

  async saveProfile(profile: Profile): Promise<void> {
    const p = `users/${profile.id}`;
    try {
      await setDoc(doc(db, 'users', profile.id), profile, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  // ── Family Groups ──
  async getFamily(familyId: string): Promise<FamilyGroup | null> {
    const p = `families/${familyId}`;
    try {
      const snap = await getDoc(doc(db, 'families', familyId));
      if (!snap.exists()) return null;
      return snap.data() as FamilyGroup;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, p);
    }
  },

  async saveFamily(family: FamilyGroup): Promise<void> {
    const p = `families/${family.id}`;
    try {
      await setDoc(doc(db, 'families', family.id), family, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async addFamilyMember(member: FamilyMember): Promise<void> {
    const p = `families/${member.family_id}/members/${member.profile_id}`;
    try {
      await setDoc(doc(db, 'families', member.family_id, 'members', member.profile_id), member, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async listFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    const p = `families/${familyId}/members`;
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'members'));
      return snap.docs.map(d => d.data() as FamilyMember);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, p);
    }
  },

  // ── Categories ──
  async listCategories(familyId: string): Promise<Category[]> {
    const p = `families/${familyId}/categories`;
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'categories'));
      return snap.docs.map(d => d.data() as Category);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, p);
    }
  },

  async saveCategory(category: Category): Promise<void> {
    const p = `families/${category.family_id}/categories/${category.id}`;
    try {
      await setDoc(doc(db, 'families', category.family_id!, 'categories', category.id), category, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async deleteCategory(familyId: string, categoryId: string): Promise<void> {
    const p = `families/${familyId}/categories/${categoryId}`;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'categories', categoryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, p);
    }
  },

  // ── Transactions ──
  async listTransactions(familyId: string, limitCount = 200): Promise<Transaction[]> {
    const p = `families/${familyId}/transactions`;
    try {
      const q = query(
        collection(db, 'families', familyId, 'transactions'),
        orderBy('date', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Transaction);
    } catch (err) {
      // Fallback without orderBy in case composite index is missing
      try {
        const snap = await getDocs(collection(db, 'families', familyId, 'transactions'));
        const items = snap.docs.map(d => d.data() as Transaction);
        return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.LIST, p);
      }
    }
  },

  async saveTransaction(transaction: Transaction): Promise<void> {
    const p = `families/${transaction.family_id}/transactions/${transaction.id}`;
    try {
      await setDoc(doc(db, 'families', transaction.family_id, 'transactions', transaction.id), transaction, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async deleteTransaction(familyId: string, transactionId: string): Promise<void> {
    const p = `families/${familyId}/transactions/${transactionId}`;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'transactions', transactionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, p);
    }
  },

  // ── Budgets ──
  async listBudgets(familyId: string): Promise<Budget[]> {
    const p = `families/${familyId}/budgets`;
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'budgets'));
      return snap.docs.map(d => d.data() as Budget);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, p);
    }
  },

  async saveBudget(budget: Budget): Promise<void> {
    const p = `families/${budget.family_id}/budgets/${budget.id}`;
    try {
      await setDoc(doc(db, 'families', budget.family_id, 'budgets', budget.id), budget, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async deleteBudget(familyId: string, budgetId: string): Promise<void> {
    const p = `families/${familyId}/budgets/${budgetId}`;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'budgets', budgetId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, p);
    }
  },

  // ── Goals ──
  async listGoals(familyId: string): Promise<Goal[]> {
    const p = `families/${familyId}/goals`;
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'goals'));
      return snap.docs.map(d => d.data() as Goal);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, p);
    }
  },

  async saveGoal(goal: Goal): Promise<void> {
    const p = `families/${goal.family_id}/goals/${goal.id}`;
    try {
      await setDoc(doc(db, 'families', goal.family_id, 'goals', goal.id), goal, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async deleteGoal(familyId: string, goalId: string): Promise<void> {
    const p = `families/${familyId}/goals/${goalId}`;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'goals', goalId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, p);
    }
  },

  // ── Planning Items ──
  async listPlanningItems(familyId: string): Promise<PlanningItem[]> {
    const p = `families/${familyId}/planningItems`;
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'planningItems'));
      return snap.docs.map(d => d.data() as PlanningItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, p);
    }
  },

  async savePlanningItem(item: PlanningItem): Promise<void> {
    const p = `families/${item.family_id}/planningItems/${item.id}`;
    try {
      await setDoc(doc(db, 'families', item.family_id, 'planningItems', item.id), item, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, p);
    }
  },

  async deletePlanningItem(familyId: string, itemId: string): Promise<void> {
    const p = `families/${familyId}/planningItems/${itemId}`;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'planningItems', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, p);
    }
  },

  // ── Diagnóstico de Transações ──
  async checkTransactionsStatus(familyId: string): Promise<{
    count: number;
    transactions: Transaction[];
    connected: boolean;
    error?: string;
  }> {
    try {
      const snap = await getDocs(collection(db, 'families', familyId, 'transactions'));
      const items = snap.docs.map(d => d.data() as Transaction);
      return {
        count: items.length,
        transactions: items,
        connected: true,
      };
    } catch (err: any) {
      return {
        count: 0,
        transactions: [],
        connected: false,
        error: err?.message || String(err),
      };
    }
  },
};
