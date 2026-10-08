import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Users,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { ONBOARDING_KEY } from '../utils';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: LayoutDashboard,
    color: '#30d158',
    bgGlow: 'rgba(48, 209, 88, 0.15)',
    title: 'Dashboard Inteligente',
    subtitle: 'Visão completa das suas finanças',
    description:
      'Veja seu saldo total, fluxo de caixa semanal e distribuição de gastos em tempo real. Tudo organizado em cards elegantes.',
    details: [
      { icon: ArrowUpRight, color: '#30d158', text: 'KPIs de entradas e saídas' },
      { icon: Sparkles, color: '#64d2ff', text: 'Gráficos interativos' },
      { icon: Target, color: '#ff9500', text: 'Progresso de metas' },
    ],
  },
  {
    icon: ArrowUpRight,
    color: '#0a84ff',
    bgGlow: 'rgba(10, 132, 255, 0.15)',
    title: 'Transações',
    subtitle: 'Registre cada movimento',
    description:
      'Adicione receitas e despesas rapidamente. Busque, filtre por categoria ou período e visualize detalhes completos.',
    details: [
      { icon: ArrowUpRight, color: '#30d158', text: 'Entradas e saídas' },
      { icon: ArrowDownRight, color: '#ff453a', text: 'Filtros avançados' },
      { icon: LayoutDashboard, color: '#8e8e93', text: 'Agrupamento por data' },
    ],
  },
  {
    icon: Target,
    color: '#ff9500',
    bgGlow: 'rgba(255, 149, 0, 0.15)',
    title: 'Metas',
    subtitle: 'Alcance seus objetivos',
    description:
      'Crie metas de economia com prazos e acompanhe o progresso. Adicione valores e veja a barra de progresso se preencher.',
    details: [
      { icon: Target, color: '#ff9500', text: 'Crie metas personalizadas' },
      { icon: ArrowUpRight, color: '#30d158', text: 'Acompanhe progresso' },
      { icon: Sparkles, color: '#64d2ff', text: 'Cores e prazos' },
    ],
  },
  {
    icon: Users,
    color: '#af52de',
    bgGlow: 'rgba(175, 82, 222, 0.15)',
    title: 'Família',
    subtitle: 'Finanças compartilhadas',
    description:
      'Crie um grupo familiar e compartilhe o controle financeiro. Todos os membros podem registrar transações no mesmo grupo.',
    details: [
      { icon: Users, color: '#af52de', text: 'Grupos familiares' },
      { icon: LayoutDashboard, color: '#64d2ff', text: 'Dados compartilhados' },
      { icon: Target, color: '#ff9500', text: 'Metas em conjunto' },
    ],
  },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (step: number) => {
      if (isAnimating || step === currentStep) return;
      setDirection(step > currentStep ? 1 : -1);
      setIsAnimating(true);
      setCurrentStep(step);
      setTimeout(() => setIsAnimating(false), 400);
    },
    [currentStep, isAnimating]
  );

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      goTo(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, goTo, handleComplete]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) goTo(currentStep - 1);
  }, [currentStep, goTo]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 60;
    if (touchDelta < -threshold && currentStep < STEPS.length - 1) {
      goNext();
    } else if (touchDelta > threshold && currentStep > 0) {
      goPrev();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Enter' && currentStep === STEPS.length - 1) handleComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, handleComplete, currentStep]);

  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${step.bgGlow} 0%, transparent 70%)`,
          filter: 'blur(80px)',
          transition: 'background 0.6s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Skip button */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          right: '20px',
          zIndex: 10,
        }}
      >
        <button
          onClick={handleComplete}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '8px 18px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.2s',
          }}
        >
          Pular
        </button>
      </div>

      {/* Main content area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Step content */}
        <div
          key={currentStep}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '360px',
            animation: direction >= 0 ? 'onboardingSlideIn 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'onboardingSlideInReverse 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: `${step.color}18`,
              border: `1.5px solid ${step.color}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              boxShadow: `0 0 40px ${step.color}15`,
            }}
          >
            <Icon size={36} color={step.color} strokeWidth={1.8} />
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: '2rem',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.04em',
              marginBottom: '0.35rem',
              lineHeight: 1.1,
            }}
          >
            {step.title}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: '1rem',
              fontWeight: 600,
              color: step.color,
              marginBottom: '0.75rem',
            }}
          >
            {step.subtitle}
          </p>

          {/* Description */}
          <p
            style={{
              fontSize: '0.92rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              marginBottom: '1.5rem',
              maxWidth: '320px',
            }}
          >
            {step.description}
          </p>

          {/* Detail pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
            {step.details.map((detail, i) => {
              const DetailIcon = detail.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 1rem',
                    animation: `onboardingFadeUp 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.1 + i * 0.08}s both`,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: `${detail.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DetailIcon size={16} color={detail.color} />
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {detail.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          padding: '0 2rem 2rem',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        {/* Dots */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                border: 'none',
                background: i === currentStep ? step.color : 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '340px' }}>
          {currentStep > 0 && (
            <button
              onClick={goPrev}
              style={{
                flex: '0 0 auto',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <button
            onClick={currentStep === STEPS.length - 1 ? handleComplete : goNext}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: currentStep === STEPS.length - 1
                ? `linear-gradient(135deg, ${step.color}, ${step.color}dd)`
                : step.color,
              color: '#000',
              fontFamily: 'var(--font-title)',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: `0 4px 20px ${step.color}30`,
            }}
          >
            {currentStep === STEPS.length - 1 ? (
              <>
                Começar <Sparkles size={18} />
              </>
            ) : (
              <>
                Próximo <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
