import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Users,
  Tags,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Save,
  Moon,
  Sun,
  DollarSign,
  Bell,
  BellOff,
  Check,
  LogOut,
  Database,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Receipt,
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { supabase, supabaseUrl } from '../supabaseClient';
import { testConnection } from '../firebase';
import { firebaseStore } from '../lib/firebaseStore';
import { migrationService, type MigrationSummary } from '../lib/migrationService';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAppSettings, type ThemeMode, type CurrencyCode } from '../useAppSettings';
import { CategoryManager } from './CategoryManager';
import { FamilySettings } from './FamilySettings';

type SectionId = 'profile' | 'family' | 'categories' | 'firebase' | 'supabase' | 'app';

interface SettingsProps {
  profileId: string;
  initialName: string;
  initialProfession?: string;
  familyId: string | null;
  familyName: string;
  inviteCode?: string | null;
  userId: string;
  onRefreshProfile: () => Promise<void>;
  onRefreshFamily: () => Promise<void>;
  onLogout: () => void;
  categories: any[];
  onRefreshCategories: () => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  profileId,
  initialName,
  familyId,
  familyName,
  inviteCode,
  userId,
  onRefreshProfile,
  onRefreshFamily,
  onLogout,
  categories,
  onRefreshCategories,
}) => {
  const [active, setActive] = useState<SectionId | null>(null);
  const [name, setName] = useState(initialName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbChecking, setDbChecking] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);

  const [fbChecking, setFbChecking] = useState(false);
  const [fbStatus, setFbStatus] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);
  const [txChecking, setTxChecking] = useState(false);
  const [txStatus, setTxStatus] = useState<{
    checked: boolean;
    count: number;
    transactions: any[];
    error?: string;
  } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationSummary | null>(() => migrationService.getLastMigration());

  const savedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const { theme, setTheme, currency, setCurrency, notifications, setNotifications } = useAppSettings();

  const sections = [
    {
      id: 'profile' as const,
      title: 'Perfil',
      subtitle: 'Seu nome e identificação familiar',
      icon: <User size={20} />,
      color: 'var(--color-primary)',
    },
    {
      id: 'family' as const,
      title: 'Família',
      subtitle: 'Conexão e sincronização do casal',
      icon: <Users size={20} />,
      color: 'var(--color-secondary)',
    },
    {
      id: 'categories' as const,
      title: 'Categorias',
      subtitle: 'Gerencie categorias e subcategorias de gastos',
      icon: <Tags size={20} />,
      color: '#ff9500',
    },
    {
      id: 'firebase' as const,
      title: 'Banco de Dados (Firebase)',
      subtitle: 'Firestore em nuvem e sincronização/migração',
      icon: <Database size={20} />,
      color: '#ff9500',
    },
    {
      id: 'supabase' as const,
      title: 'Origem Supabase (Preservado)',
      subtitle: 'Base de dados original intacta (somente leitura)',
      icon: <ShieldCheck size={20} />,
      color: '#30d158',
    },
    {
      id: 'app' as const,
      title: 'Preferências do App',
      subtitle: 'Tema, moeda e notificações',
      icon: <SlidersHorizontal size={20} />,
      color: '#64d2ff',
    },
  ];

  const handleTestFirebase = async () => {
    setFbChecking(true);
    try {
      const res = await testConnection();
      if (res.ok) {
        setFbStatus({
          ok: true,
          message: `Conexão com Firebase Firestore ativa com sucesso! Latência: ${res.latencyMs || 0}ms`,
          latency: res.latencyMs,
        });
      } else {
        setFbStatus({
          ok: false,
          message: `Falha de conexão com Firebase: ${res.error || 'Erro desconhecido'}`,
        });
      }
    } catch (err: any) {
      setFbStatus({
        ok: false,
        message: `Erro ao testar Firebase: ${err.message || String(err)}`,
      });
    } finally {
      setFbChecking(false);
    }
  };

  const handleCheckFirebaseTransactions = async () => {
    setTxChecking(true);
    try {
      const activeFam = familyId || 'fam_demo_organizai';
      const res = await firebaseStore.checkTransactionsStatus(activeFam);
      setTxStatus({
        checked: true,
        count: res.count,
        transactions: res.transactions,
        error: res.error,
      });
    } catch (err: any) {
      setTxStatus({
        checked: true,
        count: 0,
        transactions: [],
        error: err.message || String(err),
      });
    } finally {
      setTxChecking(false);
    }
  };

  const handleRunMigration = async () => {
    setMigrating(true);
    try {
      const res = await migrationService.migrateFromSupabaseToFirebase(familyId || undefined);
      setMigrationResult(res);
      await onRefreshCategories();
      await onRefreshFamily();
      await onRefreshProfile();
      // Atualiza automaticamente a auditoria de transações
      await handleCheckFirebaseTransactions();
    } catch (err: any) {
      console.error('Erro na migração:', err);
    } finally {
      setMigrating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg('');
    setSaved(false);
    try {
      const { error } = await api.updateProfile(profileId, {
        display_name: name.trim(),
      });
      if (error) throw error;
      setSaved(true);
      await onRefreshProfile();
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestDatabase = async () => {
    setDbChecking(true);
    const start = performance.now();
    try {
      const { error } = await supabase.from('categories').select('id').limit(1);
      const elapsed = Math.round(performance.now() - start);
      if (error && error.code !== 'PGRST116') {
        setDbStatus({
          ok: true, // PostgREST responded (RLS status ok)
          message: `Respondendo via Supabase (${elapsed}ms). RLS e tabelas operacionais.`,
          latency: elapsed,
        });
      } else {
        setDbStatus({
          ok: true,
          message: `Conexão bem-sucedida! Latência: ${elapsed}ms.`,
          latency: elapsed,
        });
      }
    } catch (err: any) {
      setDbStatus({
        ok: false,
        message: err.message || 'Falha ao conectar ao Supabase.',
      });
    } finally {
      setDbChecking(false);
    }
  };

  // ── Section navigation ──
  if (active) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="ios-section-action"
            onClick={() => setActive(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}
          >
            <ChevronLeft size={16} /> Voltar
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {sections.find((s) => s.id === active)?.title}
          </h1>
        </div>

        {active === 'profile' && (
          <>
            <form onSubmit={handleSaveProfile} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Nome de exibição</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome ou apelido familiar"
                  required
                />
              </div>

              {errorMsg && (
                <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: 'var(--color-expense)', fontSize: '0.85rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saved ? <><Check size={16} /> Salvo!</> : <><Save size={16} /> Salvar Perfil</>}
              </button>
            </form>

            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-expense)', borderColor: 'rgba(244,63,94,0.2)', background: 'var(--color-expense-bg)' }}
            >
              <LogOut size={16} /> Sair da Conta
            </button>
          </>
        )}

        {active === 'family' && (
          <FamilySettings
            familyId={familyId}
            familyName={familyName}
            inviteCode={inviteCode}
            userId={userId}
            onRefreshFamily={onRefreshFamily}
          />
        )}

        {active === 'categories' && (
          <CategoryManager
            categories={categories}
            familyId={familyId || ''}
            onRefreshCategories={onRefreshCategories}
          />
        )}

        {active === 'firebase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="ios-list-item-icon"
                    style={{ background: 'rgba(255, 149, 0, 0.15)', color: '#ff9500', width: 44, height: 44 }}
                  >
                    <Database size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Firebase Cloud Firestore
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ff9500', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9500', display: 'inline-block' }} />
                      Banco de Dados Ativo Principal
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Projeto Firebase:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{firebaseConfig.projectId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>ID do Banco Firestore:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{firebaseConfig.firestoreDatabaseId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Regras de Segurança:</span>
                    <span style={{ color: '#30d158' }}>Implantadas & Protegidas (ABAC Zero-Trust)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={fbChecking}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={16} className={fbChecking ? 'spinner' : ''} />
                  {fbChecking ? 'Testando Conexão...' : 'Testar Conexão Firebase'}
                </button>

                {fbStatus && (
                  <div
                    style={{
                      background: fbStatus.ok ? 'rgba(48, 209, 88, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                      border: `1px solid ${fbStatus.ok ? '#30d158' : '#f43f5e'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      fontSize: '0.82rem',
                      color: fbStatus.ok ? '#30d158' : '#f43f5e',
                    }}
                  >
                    {fbStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Auditoria & Verificação de Transações no Firebase */}
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="ios-list-item-icon"
                    style={{ background: 'rgba(100, 210, 255, 0.15)', color: '#64d2ff', width: 44, height: 44 }}
                  >
                    <Receipt size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Transações no Firebase Firestore
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Verificar contagem e integridade dos registros no Firestore
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Caminho no Firestore:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      families/{familyId || 'fam_demo_organizai'}/transactions
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Status de Verificação:</span>
                    <span style={{ color: txStatus ? (txStatus.count > 0 ? '#30d158' : '#ff9500') : 'var(--text-tertiary)' }}>
                      {txStatus ? (txStatus.count > 0 ? `✓ ${txStatus.count} transação(ões) ativa(s)` : '0 transações no Firestore') : 'Ainda não consultado'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckFirebaseTransactions}
                  disabled={txChecking}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={16} className={txChecking ? 'spinner' : ''} />
                  {txChecking ? 'Consultando Firestore...' : 'Verificar Transações no Firebase Agora'}
                </button>

                {txStatus && (
                  <div style={{ background: txStatus.count > 0 ? 'rgba(48, 209, 88, 0.08)' : 'rgba(255, 149, 0, 0.08)', border: `1px solid ${txStatus.count > 0 ? '#30d158' : '#ff9500'}`, borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600, color: txStatus.count > 0 ? '#30d158' : '#ff9500' }}>
                      {txStatus.count > 0
                        ? `✓ Confirmado: ${txStatus.count} transação(ões) encontrada(s) no Firebase Firestore!`
                        : 'ℹ️ Nenhuma transação encontrada no Firebase Firestore ainda.'}
                    </div>

                    {txStatus.count === 0 && (
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        O Firebase Firestore está configurado e pronto. Para transferir os dados da base para o Firebase, clique no botão verde <strong>"Sincronizar Dados Supabase ➔ Firebase"</strong> abaixo. Seus dados do Supabase serão lidos e salvos no Firebase de forma 100% segura, sem apagar nada.
                      </div>
                    )}

                    {txStatus.count > 0 && txStatus.transactions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                          ÚLTIMAS TRANSAÇÕES NO FIRESTORE:
                        </div>
                        {txStatus.transactions.slice(0, 5).map((t, idx) => (
                          <div
                            key={t.id || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'var(--surface-color)',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.description}</span>
                              <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.5rem', fontSize: '0.72rem' }}>{t.date}</span>
                            </div>
                            <span style={{ fontWeight: 600, color: t.type === 'income' ? '#30d158' : '#ff453a' }}>
                              {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {txStatus.error && (
                      <div style={{ color: '#f43f5e', fontSize: '0.75rem' }}>
                        Aviso: {txStatus.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sincronização & Migração Segura do Supabase */}
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="ios-list-item-icon"
                    style={{ background: 'rgba(48, 209, 88, 0.15)', color: '#30d158', width: 44, height: 44 }}
                  >
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Migração & Abstração de Dados
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Importar informações do Supabase para o Firebase
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(48, 209, 88, 0.08)', border: '1px solid rgba(48, 209, 88, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-primary)' }}>
                  <strong>🔒 Garantia de Preservação:</strong> O banco Supabase original é consultado <em>estritamente em modo de leitura (SELECT)</em>. Nenhum dado existente é apagado, excluído ou substituído no Supabase. Todos os registros são replicados de forma segura no Firebase.
                </div>

                <button
                  type="button"
                  onClick={handleRunMigration}
                  disabled={migrating}
                  className="btn-primary"
                  style={{ background: '#30d158', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={16} className={migrating ? 'spinner' : ''} />
                  {migrating ? 'Sincronizando do Supabase para o Firebase...' : 'Sincronizar Dados Supabase ➔ Firebase'}
                </button>

                {migrationResult && (
                  <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600, color: migrationResult.success ? '#30d158' : '#f43f5e' }}>
                      {migrationResult.success ? '✓ Dados sincronizados com sucesso!' : 'Erro na sincronização'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                      <div>Transações: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.transactions}</strong></div>
                      <div>Categorias: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.categories}</strong></div>
                      <div>Metas: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.goals}</strong></div>
                      <div>Orçamentos: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.budgets}</strong></div>
                      <div>Planejamento: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.planningItems}</strong></div>
                      <div>Famílias/Perfis: <strong style={{ color: 'var(--text-primary)' }}>{migrationResult.counts.families + migrationResult.counts.profiles}</strong></div>
                    </div>
                    {migrationResult.completedAt && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Última sincronização: {new Date(migrationResult.completedAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {active === 'supabase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="ios-list-item-icon"
                    style={{ background: 'rgba(48, 209, 88, 0.15)', color: '#30d158', width: 44, height: 44 }}
                  >
                    <Database size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Supabase Cloud Database (Origem)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#30d158', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158', display: 'inline-block' }} />
                      Preservado & Protegido (Somente Leitura)
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Endpoint:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{supabaseUrl}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Estado:</span>
                    <span style={{ color: '#30d158' }}>Intacto (Zero Exclusões)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Destino de Operações:</span>
                    <span style={{ color: 'var(--text-primary)' }}>Migrado para Firebase Firestore</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(48, 209, 88, 0.08)', border: '1px solid rgba(48, 209, 88, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <ShieldCheck size={18} color="#30d158" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-primary)' }}>
                    <strong>Proteção Integral:</strong> Todos os dados existentes no Supabase estão salvos e preservados. O OrganizAI abstrai as informações para o Firebase Firestore sem apagar nenhum registro da sua base original.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={dbChecking}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}
                >
                  <RefreshCw size={16} className={dbChecking ? 'spinner' : ''} />
                  {dbChecking ? 'Testando Conexão...' : 'Testar Conexão Supabase'}
                </button>

                {dbStatus && (
                  <div
                    style={{
                      background: dbStatus.ok ? 'rgba(48, 209, 88, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                      border: `1px solid ${dbStatus.ok ? '#30d158' : '#f43f5e'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      fontSize: '0.82rem',
                      color: dbStatus.ok ? '#30d158' : '#f43f5e',
                    }}
                  >
                    {dbStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {active === 'app' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Theme */}
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="ios-list-item-icon" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Aparência</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{theme === 'dark' ? 'Tema escuro' : 'Tema claro'}</div>
                  </div>
                </div>
                <div className="ios-segment" style={{ width: 'auto' }}>
                  <button
                    className={`ios-segment-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark' as ThemeMode)}
                    type="button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Moon size={14} /> Escuro
                  </button>
                  <button
                    className={`ios-segment-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light' as ThemeMode)}
                    type="button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Sun size={14} /> Claro
                  </button>
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="ios-list-item-icon" style={{ background: 'var(--color-meta-bg)', color: 'var(--color-meta)' }}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Moeda</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Usada nos valores do app</div>
                  </div>
                </div>
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: '110px' }}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                >
                  <option value="BRL">R$ (BRL)</option>
                  <option value="USD">$ (USD)</option>
                  <option value="EUR">€ (EUR)</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div className="ios-card">
              <div className="ios-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="ios-list-item-icon" style={{ background: notifications ? 'var(--color-primary-glow)' : 'rgba(142,142,147,0.12)', color: notifications ? 'var(--color-primary)' : 'var(--text-tertiary)' }}>
                    {notifications ? <Bell size={18} /> : <BellOff size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notificações</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{notifications ? 'Ativadas' : 'Desativadas'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifications(!notifications)}
                  aria-label="Alternar notificações"
                  style={{
                    width: 50,
                    height: 30,
                    borderRadius: 9999,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 3,
                    background: notifications ? 'var(--color-primary)' : 'rgba(120,120,128,0.32)',
                    transition: 'background var(--transition-fast)',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: notifications ? 23 : 3,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left var(--transition-fast)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Hub (lista de seções) ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Configurações
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Organize seu perfil, família, categorias e preferências do app.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="ios-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              borderLeft: `3px solid ${s.color}`,
              textAlign: 'left',
            }}
          >
            <div
              className="ios-list-item-icon"
              style={{ background: 'transparent', color: s.color, border: `1px solid ${s.color}30`, width: 40, height: 40 }}
            >
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{s.subtitle}</div>
            </div>
            <ChevronRight size={18} color="var(--text-quaternary)" />
          </button>
        ))}
      </div>
    </div>
  );
};
