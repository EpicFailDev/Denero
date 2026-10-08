import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { supabase, cachedQuery, invalidateQuery, clearQueryCache } from './supabaseClient';
import { api } from './lib/apiClient';
import { testConnection, auth as fbAuth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileHeader } from './components/MobileHeader';
import { ViewStack } from './components/ViewStack';
import { AppSettingsProvider } from './AppSettings';
import { Users } from 'lucide-react';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { Onboarding } from './components/Onboarding';
import { isOnboardingComplete } from './utils';
import { useFeedback } from './components/UIFeedback';

const DEMO_USER_SESSION = {
  user: {
    id: 'usr_demo_guilherme',
    email: 'guilherme@organizai.com',
    user_metadata: { display_name: 'Guilherme & Yumi' },
  },
  access_token: 'demo_token_organizai',
};

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TransactionsList = lazy(() => import('./components/TransactionsList').then(m => ({ default: m.TransactionsList })));
const FamilySettings = lazy(() => import('./components/FamilySettings').then(m => ({ default: m.FamilySettings })));
const AddTransactionModal = lazy(() => import('./components/AddTransactionModal').then(m => ({ default: m.AddTransactionModal })));
const Orcamentos = lazy(() => import('./components/Orcamentos').then(m => ({ default: m.Orcamentos })));
const Metas = lazy(() => import('./components/Metas').then(m => ({ default: m.Metas })));
const Planejamento = lazy(() => import('./components/Planejamento').then(m => ({ default: m.Planejamento })));
const Relatorios = lazy(() => import('./components/Relatorios').then(m => ({ default: m.Relatorios })));
const Calendario = lazy(() => import('./components/Calendario').then(m => ({ default: m.Calendario })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  profession?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  family_id?: string | null;
}

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

/** Tab order used to compute the directional transition (forward = advancing, back = retreating). */
const VIEW_ORDER: Record<string, number> = {
  dashboard: 0,
  transactions: 1,
  'transactions-entradas': 1.2,
  'transactions-saidas': 1.4,
  orcamentos: 2,
  metas: 3,
  planejamento: 4,
  calendario: 5,
  relatorios: 6,
  family: 7,
  categories: 8,
};

function LoadingSkeleton() {
  return (
    <div className="ios-loading">
      <div className="ios-spinner" />
    </div>
  );
}

function App() {
  const { showToast, confirm } = useFeedback();
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [familyInviteCode, setFamilyInviteCode] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState('dashboard');
  const [viewDirection, setViewDirection] = useState<'forward' | 'back'>('forward');
  const prevViewRef = useRef<string>(view);
  const contentRef = useRef<HTMLElement | null>(null);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setView('dashboard');

    // Valida conexão ao Firestore ao inicializar conforme protocolo
    testConnection().catch(() => {});

    // Suporte ao modo demonstração
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('organizai_is_demo') === 'true';
    if (isDemo) {
      setSession(DEMO_USER_SESSION);
      setAuthChecked(true);
      return;
    }

    // Listener de autenticação do Firebase
    const unsubFirebase = onAuthStateChanged(fbAuth, (fbUser) => {
      if (fbUser) {
        localStorage.removeItem('organizai_is_demo');
        setSession({
          user: {
            id: fbUser.uid,
            email: fbUser.email,
            user_metadata: { display_name: fbUser.displayName || 'Você' },
          },
          provider: 'firebase',
        });
        setAuthChecked(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!fbAuth.currentUser) {
        setSession(session);
      }
      setAuthChecked(true);

      // Show onboarding only for authenticated first-time users
      if (!isOnboardingComplete()) {
        setShowOnboarding(true);
      }
    }).catch((err: unknown) => {
      console.warn('Verificação de sessão (usando fallback seguro):', err);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !fbAuth.currentUser) {
        localStorage.removeItem('organizai_is_demo');
        setSession(session);
      }
      setAuthChecked(true);
    });

    return () => {
      unsubFirebase();
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileAndFamily = useCallback(async (userId: string) => {
    try {
      const { data: profData, error: profError } = await cachedQuery<Profile>(
        `profile:${userId}`,
        () => api.getProfile(userId) as unknown as Promise<{ data: Profile | null; error: any }>,
        60000
      );
      if (profError) throw profError;
      if (profData) setProfile(profData);

      const { data: memData, error: memError } = await api.getMyFamily();

      if (memError) throw memError;

      if (memData) {
        setFamilyId(memData.family_id);
        setFamilyName(memData.family_groups?.name || 'Minha Família');
        setFamilyInviteCode(memData.family_groups?.invite_code || null);
      } else {
        setFamilyId(null);
        setFamilyName('');
        setFamilyInviteCode(null);
      }
    } catch (err: any) {
      console.error('Erro ao buscar perfil/família:', err.message);
    }
  }, []);

  const fetchFinancialData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingData(true);

    try {
      const { data: catData, error: catError } = await cachedQuery<Category[]>(
        `categories:${familyId || 'global'}`,
        () => api.listCategories() as unknown as Promise<{ data: Category[] | null; error: any }>,
        30000
      );
      if (catError) throw catError;
      if (catData) setCategories(catData);

      if (familyId) {
        // Busca SEMPRE fresca (transações mudam a cada mutação) e paginada,
        // pois o PostgREST corta em max_rows (default 1000) — saldo truncado.
        const PAGE_SIZE = 1000;
        let transData: Transaction[] = [];
        let transError: any = null;
        let from = 0;
        for (;;) {
          const { data, error } = await api.listTransactions({ family_id: familyId, from, limit: PAGE_SIZE });
          if (error) {
            transError = error;
            break;
          }
          transData = transData.concat((data as Transaction[]) || []);
          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }

        if (transError) throw transError;

        setTransactions(transData);
      } else {
        setTransactions([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados financeiros:', err.message);
    } finally {
      setLoadingData(false);
    }
  }, [session?.user?.id, familyId]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileAndFamily(session.user.id);
    } else {
      setProfile(null);
      setFamilyId(null);
      setFamilyName('');
      setFamilyInviteCode(null);
      setCategories([]);
      setTransactions([]);
    }
  }, [session, fetchProfileAndFamily]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchFinancialData();
    }
  }, [familyId, fetchFinancialData, session?.user?.id]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    const shouldDelete = await confirm({
      title: 'Excluir Transação',
      message: 'Tem certeza que deseja apagar este lançamento? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      isDestructive: true,
    });
    if (!shouldDelete) return;

    try {
      const { error } = await api.deleteTransaction(id);
      if (error) throw error;
      showToast('Transação excluída com sucesso.', 'success');
      await fetchFinancialData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir transação.', 'error');
    }
  }, [confirm, showToast, fetchFinancialData]);

  const handleUpdateTransaction = useCallback(async (id: string, updates: {
    date: string; time?: string; description: string;
    type: 'income' | 'expense'; amount: number;
    category_id: string; subcategory_id?: string | null;
    odometer_km?: number | null;
  }) => {
    try {
      const { error } = await api.updateTransaction(id, updates);
      if (error) throw error;
      showToast('Transação atualizada com sucesso.', 'success');
      await fetchFinancialData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar transação.', 'error');
    }
  }, [showToast, fetchFinancialData]);

  const handleRefreshFamily = useCallback(async () => {
    if (session?.user?.id) {
      invalidateQuery(`profile:${session.user.id}`);
      await fetchProfileAndFamily(session.user.id);
    }
  }, [session?.user?.id, fetchProfileAndFamily]);

  const handleRefreshProfile = handleRefreshFamily;

  const handleLogout = useCallback(async () => {
    const shouldLogout = await confirm({
      title: 'Sair da Conta',
      message: 'Deseja realmente sair da sua sessão no OrganizAI?',
      confirmLabel: 'Sair',
      cancelLabel: 'Cancelar',
      isDestructive: true,
    });
    if (!shouldLogout) return;

    localStorage.removeItem('organizai_is_demo');
    clearQueryCache();
    await Promise.allSettled([
      fbAuth.signOut(),
      supabase.auth.signOut(),
    ]);
    setSession(null);
    showToast('Sessão encerrada.', 'info');
  }, [confirm, showToast]);

  const handleRefreshCategories = useCallback(async () => {
    invalidateQuery(`categories:${familyId || 'global'}`);
    await fetchFinancialData();
  }, [fetchFinancialData, familyId]);

  // Reset scroll to top on every screen change (iOS tab behavior) so the
  // directional exit pane (absolutely positioned at the top) stays visible.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [view]);

  const handleViewChange = useCallback((newView: string) => {
    let target = newView;
    if (newView === 'entradas') target = 'transactions-entradas';
    else if (newView === 'saidas') target = 'transactions-saidas';

    // Directional transition: advancing in tab order slides left, going back slides right.
    const prevOrder = VIEW_ORDER[prevViewRef.current] ?? 0;
    const nextOrder = VIEW_ORDER[target] ?? 0;
    setViewDirection(nextOrder >= prevOrder ? 'forward' : 'back');
    prevViewRef.current = target;
    setView(target);
  }, []);

  // Interactive swipe-back (edge gesture) — returns to the previous screen.
  const handleBack = useCallback((target: string) => {
    prevViewRef.current = target;
    setViewDirection('back');
    setView(target);
  }, []);

  // Determine mobile header title
  const getHeaderTitle = () => {
    switch (view) {
      case 'dashboard': return 'OrganizAI';
      case 'transactions': return 'Extrato';
      case 'transactions-entradas': return 'Entradas';
      case 'transactions-saidas': return 'Saídas';
      case 'categories': return 'Configurações';
      case 'family': return 'Família';
      case 'orcamentos': return 'Orçamentos';
      case 'metas': return 'Metas';
      case 'planejamento': return 'Planejamento';
      case 'relatorios': return 'Relatórios';
      case 'calendario': return 'Calendário';
      default: return 'OrganizAI';
    }
  };

  const getHeaderSubtitle = () => {
    if (view === 'dashboard') return familyName || 'Controle financeiro familiar';
    if (view === 'transactions' || view.startsWith('transactions-')) return familyName;
    return undefined;
  };

  const renderViewFor = (v: string) => {
    if (!familyId && v !== 'family') {
      return (
        <div className="ios-empty">
          <div className="ios-empty-icon">
            <Users size={28} />
          </div>
          <h3 className="ios-empty-title">Conecte seu amor!</h3>
          <p className="ios-empty-desc">
            Para lançar suas receitas e despesas, você precisa criar um Grupo Familiar ou participar de um existente.
          </p>
          <button
            className="ios-btn ios-btn-primary"
            style={{ maxWidth: '280px', marginTop: '0.5rem' }}
            onClick={() => handleViewChange('family')}
          >
            Configurar Grupo Familiar
          </button>
        </div>
      );
    }

    return (
      <Suspense fallback={<LoadingSkeleton />}>
        {v === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            onNavigate={handleViewChange}
            familyId={familyId || ''}
          />
        )}
        {v.startsWith('transactions') && (
          <TransactionsList
            key={v}
            transactions={transactions}
            categories={categories}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            userId={session.user.id}
            presetType={
              v === 'transactions-entradas' ? 'income' :
              v === 'transactions-saidas' ? 'expense' : 'all'
            }
          />
        )}
        {v === 'categories' && (
          <Settings
            profileId={profile?.id || ''}
            initialName={profile?.display_name || ''}
            initialProfession={profile?.profession}
            familyId={familyId}
            familyName={familyName}
            inviteCode={familyInviteCode}
            userId={session.user.id}
            onRefreshProfile={handleRefreshProfile}
            onRefreshFamily={handleRefreshFamily}
            onLogout={handleLogout}
            categories={categories}
            onRefreshCategories={handleRefreshCategories}
          />
        )}
        {v === 'family' && (
          <FamilySettings
            familyId={familyId}
            familyName={familyName}
            inviteCode={familyInviteCode}
            userId={session.user.id}
            onRefreshFamily={handleRefreshFamily}
          />
        )}
        {v === 'orcamentos' && (
          <Orcamentos familyId={familyId || ''} categories={categories} transactions={transactions} />
        )}
        {v === 'metas' && <Metas familyId={familyId || ''} />}
        {v === 'planejamento' && (
          <Planejamento familyId={familyId || ''} categories={categories} userId={session.user.id} />
        )}
        {v === 'relatorios' && (
          <Relatorios transactions={transactions} />
        )}
        {v === 'calendario' && (
          <Calendario
            transactions={transactions}
            categories={categories}
            familyId={familyId || ''}
            userId={session.user.id}
            onRefresh={fetchFinancialData}
          />
        )}
      </Suspense>
    );
  };

  if (!authChecked) {
    return (
      <div className="ios-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="ios-spinner" />
      </div>
    );
  }

  if (!session) {
    return (
      <Auth
        onAuthSuccess={() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSession(session);
          });
        }}
        onDemoLogin={() => {
          localStorage.setItem('organizai_is_demo', 'true');
          setSession(DEMO_USER_SESSION);
          showToast('Modo demonstração ativado com sucesso!', 'success');
        }}
      />
    );
  }

  return (
    <AppSettingsProvider>
    <div className="ios-app">
      {/* Mobile Header (visible on mobile only via CSS) */}
      <MobileHeader
        title={getHeaderTitle()}
        subtitle={getHeaderSubtitle()}
        onSettingsClick={() => handleViewChange('categories')}
      />

      {/* Desktop Sidebar (hidden on mobile via CSS) */}
      <Sidebar
        currentView={view}
        setView={handleViewChange}
        onLogout={() => setSession(null)}
        onAddTransactionClick={() => setIsAddOpen(true)}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        profession={profile?.profession}
      />

      {/* Loading indicator */}
      {loadingData && (
        <div style={{
          position: 'fixed', top: 'calc(var(--safe-top, 0px) + 0.75rem)', right: '1rem', zIndex: 500,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'rgba(28, 28, 30, 0.9)', backdropFilter: 'blur(12px)',
          padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-full)',
          fontSize: '0.72rem', color: 'var(--text-secondary)',
          border: '0.5px solid var(--separator)',
        }}>
          <div className="ios-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          Atualizando...
        </div>
      )}

      {/* Main scrollable content */}
      <main className="ios-content" ref={contentRef}>
        <ViewStack view={view} direction={viewDirection} onBack={handleBack}>
          {renderViewFor(view)}
        </ViewStack>
      </main>

      {/* iOS Bottom Tab Bar */}
      <MobileTabBar
        currentView={view}
        setView={handleViewChange}
        onAddTransactionClick={() => setIsAddOpen(true)}
        profession={profile?.profession}
      />

      {/* Add Transaction Modal (iOS Sheet style) */}
      {session.user && familyId && (
        <Suspense fallback={null}>
          <AddTransactionModal
            isOpen={isAddOpen}
            onClose={() => setIsAddOpen(false)}
            categories={categories}
            familyId={familyId}
            userId={session.user.id}
            onSuccess={fetchFinancialData}
          />
        </Suspense>
      )}
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
    </AppSettingsProvider>
  );
}

export default App;
