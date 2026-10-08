/**
 * Armazenamento Local Inteligente & Seed para OrganizAI
 * 100% Focado em Controle Financeiro Familiar & Casal.
 */

import type {
  Profile,
  FamilyGroup,
  FamilyMember,
  MyFamily,
  Category,
  Subcategory,
  Transaction,
  Budget,
  Goal,
  PlanningItem,
} from './apiClient';

const STORAGE_PREFIX = 'organizai_db_';

function getStored<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (err) {
    console.error('Erro ao salvar no localStorage:', err);
  }
}

// Helpers de data relativa ao mês atual
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (day: number) => `${currentYear}-${currentMonth}-${pad(Math.min(day, 28))}`;

const INITIAL_PROFILE: Profile = {
  id: 'usr_demo_guilherme',
  display_name: 'Guilherme & Família',
  profession: 'geral',
  avatar_url: '',
};

const INITIAL_FAMILY: MyFamily = {
  family_id: 'fam_demo_organizai',
  profile_id: 'usr_demo_guilherme',
  role: 'admin',
  joined_at: `${currentYear}-01-01T00:00:00Z`,
  family_groups: {
    id: 'fam_demo_organizai',
    name: 'Finanças do Casal 🪙',
    invite_code: 'ORGA-2026',
  },
};

const INITIAL_MEMBERS: FamilyMember[] = [
  {
    family_id: 'fam_demo_organizai',
    profile_id: 'usr_demo_guilherme',
    role: 'admin',
    joined_at: `${currentYear}-01-01T00:00:00Z`,
    profiles: { display_name: 'Guilherme', avatar_url: '' },
  },
  {
    family_id: 'fam_demo_organizai',
    profile_id: 'usr_demo_esposa',
    role: 'admin',
    joined_at: `${currentYear}-01-01T00:00:00Z`,
    profiles: { display_name: 'Esposa', avatar_url: '' },
  },
];

const INITIAL_CATEGORIES: Category[] = [
  // Entradas (Receitas)
  { id: 'cat_salario_1', name: 'Salário Guilherme', type: 'income', color: '#30D158', icon: 'Briefcase', family_id: 'fam_demo_organizai', usage_count: 10 },
  { id: 'cat_salario_2', name: 'Salário Esposa', type: 'income', color: '#34C759', icon: 'Briefcase', family_id: 'fam_demo_organizai', usage_count: 10 },
  { id: 'cat_renda_extra', name: 'Renda Extra & Bônus', type: 'income', color: '#64D2FF', icon: 'TrendingUp', family_id: 'fam_demo_organizai', usage_count: 5 },
  { id: 'cat_rendimentos', name: 'Rendimentos & Invest.', type: 'income', color: '#5E5CE6', icon: 'Percent', family_id: 'fam_demo_organizai', usage_count: 3 },

  // Saídas (Despesas)
  { id: 'cat_moradia', name: 'Moradia & Contas', type: 'expense', color: '#AF52DE', icon: 'Home', family_id: 'fam_demo_organizai', usage_count: 15 },
  { id: 'cat_alimentacao', name: 'Alimentação & Feira', type: 'expense', color: '#FF9500', icon: 'Utensils', family_id: 'fam_demo_organizai', usage_count: 25 },
  { id: 'cat_transporte', name: 'Transporte & Carro', type: 'expense', color: '#0A84FF', icon: 'Car', family_id: 'fam_demo_organizai', usage_count: 12 },
  { id: 'cat_saude', name: 'Saúde & Farmácia', type: 'expense', color: '#FF3B30', icon: 'Heart', family_id: 'fam_demo_organizai', usage_count: 8 },
  { id: 'cat_lazer', name: 'Lazer & Passeios', type: 'expense', color: '#FF2D55', icon: 'Smile', family_id: 'fam_demo_organizai', usage_count: 9 },
  { id: 'cat_educacao', name: 'Educação & Livros', type: 'expense', color: '#BF5AF2', icon: 'BookOpen', family_id: 'fam_demo_organizai', usage_count: 4 },
  { id: 'cat_cartao', name: 'Cartão de Crédito', type: 'expense', color: '#FF9F0A', icon: 'CreditCard', family_id: 'fam_demo_organizai', usage_count: 11 },
];

const INITIAL_SUBCATEGORIES: Subcategory[] = [
  { id: 'sub_1', category_id: 'cat_alimentacao', name: 'Supermercado', usage_count: 14 },
  { id: 'sub_2', category_id: 'cat_alimentacao', name: 'Restaurante & Delivery', usage_count: 7 },
  { id: 'sub_3', category_id: 'cat_alimentacao', name: 'Feira & Hortifruti', usage_count: 4 },
  { id: 'sub_4', category_id: 'cat_moradia', name: 'Aluguel / Condomínio', usage_count: 2 },
  { id: 'sub_5', category_id: 'cat_moradia', name: 'Energia Elétrica', usage_count: 2 },
  { id: 'sub_6', category_id: 'cat_moradia', name: 'Internet Fibra', usage_count: 2 },
  { id: 'sub_7', category_id: 'cat_moradia', name: 'Água e Gás', usage_count: 2 },
  { id: 'sub_8', category_id: 'cat_transporte', name: 'Combustível', usage_count: 8 },
  { id: 'sub_9', category_id: 'cat_transporte', name: 'Manutenção Preventiva', usage_count: 2 },
  { id: 'sub_10', category_id: 'cat_saude', name: 'Farmácia & Vitaminas', usage_count: 5 },
  { id: 'sub_11', category_id: 'cat_lazer', name: 'Cinema & Passeio', usage_count: 4 },
  { id: 'sub_12', category_id: 'cat_lazer', name: 'Assinaturas & Streaming', usage_count: 3 },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_1',
    family_id: 'fam_demo_organizai',
    date: fmtDate(2),
    description: 'Salário Mensal - Guilherme',
    category_id: 'cat_salario_1',
    type: 'income',
    amount: 4500.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Salário Guilherme', color: '#30D158' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_2',
    family_id: 'fam_demo_organizai',
    date: fmtDate(5),
    description: 'Salário Mensal - Esposa',
    category_id: 'cat_salario_2',
    type: 'income',
    amount: 3800.0,
    created_by: 'usr_demo_esposa',
    categories: { name: 'Salário Esposa', color: '#34C759' },
    profiles: { display_name: 'Esposa' },
  },
  {
    id: 'tx_3',
    family_id: 'fam_demo_organizai',
    date: fmtDate(5),
    description: 'Aluguel do Apartamento',
    category_id: 'cat_moradia',
    subcategory_id: 'sub_4',
    type: 'expense',
    amount: 1950.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Moradia & Contas', color: '#AF52DE' },
    subcategories: { name: 'Aluguel / Condomínio' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_4',
    family_id: 'fam_demo_organizai',
    date: fmtDate(6),
    description: 'Compras do Mês - Atacadão',
    category_id: 'cat_alimentacao',
    subcategory_id: 'sub_1',
    type: 'expense',
    amount: 785.4,
    created_by: 'usr_demo_esposa',
    categories: { name: 'Alimentação & Feira', color: '#FF9500' },
    subcategories: { name: 'Supermercado' },
    profiles: { display_name: 'Esposa' },
  },
  {
    id: 'tx_5',
    family_id: 'fam_demo_organizai',
    date: fmtDate(7),
    description: 'Energia Elétrica (Enel)',
    category_id: 'cat_moradia',
    subcategory_id: 'sub_5',
    type: 'expense',
    amount: 168.9,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Moradia & Contas', color: '#AF52DE' },
    subcategories: { name: 'Energia Elétrica' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_6',
    family_id: 'fam_demo_organizai',
    date: fmtDate(8),
    description: 'Abastecimento Carro Familiar (Gasolina)',
    category_id: 'cat_transporte',
    subcategory_id: 'sub_8',
    type: 'expense',
    amount: 195.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Transporte & Carro', color: '#0A84FF' },
    subcategories: { name: 'Combustível' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_7',
    family_id: 'fam_demo_organizai',
    date: fmtDate(9),
    description: 'Internet Fibra 600MB',
    category_id: 'cat_moradia',
    subcategory_id: 'sub_6',
    type: 'expense',
    amount: 129.9,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Moradia & Contas', color: '#AF52DE' },
    subcategories: { name: 'Internet Fibra' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_8',
    family_id: 'fam_demo_organizai',
    date: fmtDate(10),
    description: 'Rendimento CDB / Tesouro Direto',
    category_id: 'cat_rendimentos',
    type: 'income',
    amount: 240.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Rendimentos & Invest.', color: '#5E5CE6' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_9',
    family_id: 'fam_demo_organizai',
    date: fmtDate(11),
    description: 'Farmácia Drogasil - Remédios e Itens de Higiene',
    category_id: 'cat_saude',
    subcategory_id: 'sub_10',
    type: 'expense',
    amount: 94.5,
    created_by: 'usr_demo_esposa',
    categories: { name: 'Saúde & Farmácia', color: '#FF3B30' },
    subcategories: { name: 'Farmácia & Vitaminas' },
    profiles: { display_name: 'Esposa' },
  },
  {
    id: 'tx_10',
    family_id: 'fam_demo_organizai',
    date: fmtDate(12),
    description: 'Jantar em Família no Restaurante',
    category_id: 'cat_alimentacao',
    subcategory_id: 'sub_2',
    type: 'expense',
    amount: 165.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Alimentação & Feira', color: '#FF9500' },
    subcategories: { name: 'Restaurante & Delivery' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_11',
    family_id: 'fam_demo_organizai',
    date: fmtDate(13),
    description: 'Consultoria / Trabalho Extra',
    category_id: 'cat_renda_extra',
    type: 'income',
    amount: 650.0,
    created_by: 'usr_demo_guilherme',
    categories: { name: 'Renda Extra & Bônus', color: '#64D2FF' },
    profiles: { display_name: 'Guilherme' },
  },
  {
    id: 'tx_12',
    family_id: 'fam_demo_organizai',
    date: fmtDate(14),
    description: 'Feira Semanal Frutas e Legumes',
    category_id: 'cat_alimentacao',
    subcategory_id: 'sub_3',
    type: 'expense',
    amount: 82.0,
    created_by: 'usr_demo_esposa',
    categories: { name: 'Alimentação & Feira', color: '#FF9500' },
    subcategories: { name: 'Feira & Hortifruti' },
    profiles: { display_name: 'Esposa' },
  },
];

const INITIAL_BUDGETS: Budget[] = [
  {
    id: 'bud_1',
    family_id: 'fam_demo_organizai',
    category_id: 'cat_alimentacao',
    limit_amount: 1400.0,
    period: 'monthly',
    categories: { name: 'Alimentação & Feira', color: '#FF9500' },
  },
  {
    id: 'bud_2',
    family_id: 'fam_demo_organizai',
    category_id: 'cat_moradia',
    limit_amount: 2500.0,
    period: 'monthly',
    categories: { name: 'Moradia & Contas', color: '#AF52DE' },
  },
  {
    id: 'bud_3',
    family_id: 'fam_demo_organizai',
    category_id: 'cat_transporte',
    limit_amount: 600.0,
    period: 'monthly',
    categories: { name: 'Transporte & Carro', color: '#0A84FF' },
  },
  {
    id: 'bud_4',
    family_id: 'fam_demo_organizai',
    category_id: 'cat_lazer',
    limit_amount: 500.0,
    period: 'monthly',
    categories: { name: 'Lazer & Passeios', color: '#FF2D55' },
  },
];

const INITIAL_GOALS: Goal[] = [
  {
    id: 'goal_1',
    family_id: 'fam_demo_organizai',
    name: 'Reserva de Emergência Familiar',
    target_amount: 20000.0,
    current_amount: 12400.0,
    deadline: `${currentYear}-12-31`,
    color: '#30D158',
    icon: 'Shield',
    status: 'active',
  },
  {
    id: 'goal_2',
    family_id: 'fam_demo_organizai',
    name: 'Viagem de Férias em Família ✈️',
    target_amount: 6000.0,
    current_amount: 3850.0,
    deadline: `${currentYear}-11-25`,
    color: '#0A84FF',
    icon: 'Plane',
    status: 'active',
  },
  {
    id: 'goal_3',
    family_id: 'fam_demo_organizai',
    name: 'Reforma e Móveis da Casa',
    target_amount: 8000.0,
    current_amount: 4200.0,
    deadline: `${currentYear}-12-15`,
    color: '#FF9500',
    icon: 'Home',
    status: 'active',
  },
];

const INITIAL_PLANNING: PlanningItem[] = [
  {
    id: 'plan_1',
    family_id: 'fam_demo_organizai',
    description: 'Seguro Automóvel Familiar (Parcela)',
    type: 'expense',
    amount: 215.0,
    expected_date: fmtDate(20),
    status: 'pending',
    categories: { name: 'Transporte & Carro', color: '#0A84FF' },
  },
  {
    id: 'plan_2',
    family_id: 'fam_demo_organizai',
    description: 'Adiantamento / Bônus Semestral',
    type: 'income',
    amount: 1200.0,
    expected_date: fmtDate(22),
    status: 'pending',
    categories: { name: 'Renda Extra & Bônus', color: '#64D2FF' },
  },
  {
    id: 'plan_3',
    family_id: 'fam_demo_organizai',
    description: 'Parcela Cartão de Crédito',
    type: 'expense',
    amount: 680.0,
    expected_date: fmtDate(25),
    status: 'pending',
    categories: { name: 'Cartão de Crédito', color: '#FF9F0A' },
  },
];

export const localStore = {
  getProfile: (): Profile => getStored<Profile>('profile', INITIAL_PROFILE),
  setProfile: (p: Profile) => setStored('profile', p),

  getMyFamily: (): MyFamily => getStored<MyFamily>('family', INITIAL_FAMILY),
  setMyFamily: (f: MyFamily) => setStored('family', f),

  getMembers: (): FamilyMember[] => getStored<FamilyMember[]>('members', INITIAL_MEMBERS),
  setMembers: (m: FamilyMember[]) => setStored('members', m),

  getCategories: (): Category[] => getStored<Category[]>('categories', INITIAL_CATEGORIES),
  setCategories: (c: Category[]) => setStored('categories', c),

  getSubcategories: (catId?: string): Subcategory[] => {
    const list = getStored<Subcategory[]>('subcategories', INITIAL_SUBCATEGORIES);
    return catId ? list.filter((s) => s.category_id === catId) : list;
  },
  setSubcategories: (s: Subcategory[]) => setStored('subcategories', s),

  getTransactions: (): Transaction[] => getStored<Transaction[]>('transactions', INITIAL_TRANSACTIONS),
  setTransactions: (t: Transaction[]) => setStored('transactions', t),

  getBudgets: (): Budget[] => getStored<Budget[]>('budgets', INITIAL_BUDGETS),
  setBudgets: (b: Budget[]) => setStored('budgets', b),

  getGoals: (): Goal[] => getStored<Goal[]>('goals', INITIAL_GOALS),
  setGoals: (g: Goal[]) => setStored('goals', g),

  getPlanning: (): PlanningItem[] => getStored<PlanningItem[]>('planning', INITIAL_PLANNING),
  setPlanning: (p: PlanningItem[]) => setStored('planning', p),

  // Aliases para conveniência
  getPlanningItems: (): PlanningItem[] => getStored<PlanningItem[]>('planning', INITIAL_PLANNING),
  setPlanningItems: (p: PlanningItem[]) => setStored('planning', p),
  getFamily: (): FamilyGroup | null => getStored<MyFamily>('family', INITIAL_FAMILY).family_groups || null,

  resetToDemoData: () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },
};
