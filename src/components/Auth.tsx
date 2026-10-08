import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { auth as fbAuth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { LogIn, UserPlus, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
  onDemoLogin?: () => void;
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onDemoLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // 1. Tenta autenticação via Firebase Google Popup
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(fbAuth, provider);
      if (result.user) {
        onAuthSuccess();
        return;
      }
    } catch (fbErr: any) {
      console.warn('Firebase popup sign-in fallback:', fbErr);
      // 2. Fallback OAuth
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      } catch (err: any) {
        setErrorMsg(fbErr.message || err.message || 'Ocorreu um erro ao entrar com Google.');
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });

        if (error) throw error;

        if (data.user && data.session) {
          onAuthSuccess();
        } else {
          setSuccessMsg('Cadastro realizado! Verifique seu e-mail para confirmar o cadastro e depois faça login.');
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      padding: '1.5rem',
      background: 'radial-gradient(circle at center, #111827 0%, #07090e 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Visual background glowing elements for "wow" effect */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'float 6s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '10%',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'float 8s ease-in-out infinite alternate',
        pointerEvents: 'none'
      }} />

      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '430px',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow-lg), 0 0 40px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 5
      }}>
        {/* Brand Icon Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-primary-glow)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            width: '54px',
            height: '54px',
            marginBottom: '1rem',
            boxShadow: 'var(--glow-primary)',
            animation: 'float 4s ease-in-out infinite'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, marginBottom: '0.45rem', color: '#fff', letterSpacing: '-0.04em' }}>
            Organiz<span style={{ color: 'var(--color-primary)', textShadow: '0 0 12px rgba(16,185,129,0.3)' }}>AI</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '300px', lineHeight: '1.4' }}>
            {isSignUp ? 'Crie sua conta compartilhada familiar' : 'Acesse o controle financeiro compartilhado do casal'}
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
            marginBottom: '1.5rem',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--color-income)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.1rem' }}>✓</span>
            {successMsg}
          </div>
        )}

        {onDemoLogin && (
          <button
            type="button"
            onClick={onDemoLogin}
            style={{
              width: '100%',
              marginBottom: '0.75rem',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 214, 10, 0.3)',
              backgroundColor: 'rgba(255, 214, 10, 0.08)',
              color: '#ffd60a',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={16} color="#ffd60a" />
            Explorar no Modo Demonstração (Sem Login)
          </button>
        )}

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ width: '100%', marginBottom: '0.5rem' }}
        >
          {loading ? <Loader2 size={18} className="spinner" /> : <GoogleIcon size={18} />}
          Continuar com Google
        </button>

        <div className="auth-divider">
          <span>ou</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Guilherme Silva"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Endereço de E-mail</label>
            <input
              type="email"
              className="form-input"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem' }} disabled={loading}>
            {loading ? (
              <Loader2 size={18} className="spinner" />
            ) : isSignUp ? (
              <>
                <UserPlus size={18} /> Cadastrar Conta
              </>
            ) : (
              <>
                <LogIn size={18} /> Acessar OrganizAI
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Já tem uma conta cadastrada?' : 'Ainda não tem conta no OrganizAI?'}
          </span>{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: '700',
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: 'var(--font-title)',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          >
            {isSignUp ? 'Faça login' : 'Cadastre-se grátis'}
          </button>
        </div>

        {/* Security badge at bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} color="#30d158" />
            <span style={{ fontWeight: 600 }}>Sincronizado com Supabase</span>
          </div>
          <span style={{ color: 'rgba(235, 235, 245, 0.4)', fontSize: '0.66rem' }}>
            cwpbidoxhnocyotqzhaz.supabase.co
          </span>
        </div>
      </div>
    </div>
  );
};
