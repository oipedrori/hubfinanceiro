'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, loginWithGoogle, logout } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function LandingContent() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  const templateIdParam = searchParams.get('template_id');
  
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  
  // Estado para os acordeões
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);
  
  // Estados do Checklist
  const [notionConnected, setNotionConnected] = useState(false);
  const [shortcutSaved, setShortcutSaved] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  useEffect(() => {
    // Detectar plataforma
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isMac = /Macintosh/i.test(ua);
    
    if (isIOS || isMac) {
      setPlatform('ios');
    } else if (/Android/i.test(ua)) {
      setPlatform('android');
    }

    // Carregar estado do checklist salvo localmente
    setShortcutSaved(localStorage.getItem('hub_shortcut_done') === 'true');

    // Se houver chave na URL, salva no localstorage, marca como conectado e abre o acordeão do Notion
    if (secretKey) {
      localStorage.setItem('zimbroo_secret_key', secretKey);
      if (templateIdParam) {
        localStorage.setItem('hub_template_id', templateIdParam);
        setTemplateId(templateIdParam);
      }
      setNotionConnected(true);
      setActiveAccordion(0); // Mantém o acordeão da chave aberto para copiar
    } else if (localStorage.getItem('zimbroo_secret_key')) {
      setNotionConnected(true);
      setTemplateId(localStorage.getItem('hub_template_id'));
    }

    // Monitorar Autenticação
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [secretKey]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      alert('Erro ao fazer login. Verifique sua conexão e o console do Firebase.');
    }
  };

  const toggleAccordion = (index: number) => {
    setActiveAccordion(prev => prev === index ? null : index);
  };

  const handleNotionConnect = () => {
    const clientId = '31ed872b-594c-81a0-8494-0037918ae6cc';
    const redirectUri = 'https://hubfinanceirobot.vercel.app/api/auth/callback/notion';
    window.location.href = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const handleShortcutClick = () => {
    if (platform === 'ios') {
      window.open('https://www.icloud.com/shortcuts/f6a018a3e2694c7d819d5370a95c40fc', '_blank');
      localStorage.setItem('hub_shortcut_done', 'true');
      setShortcutSaved(true);
      setActiveAccordion(null);
    }
  };

  const handleAndroidPWA = () => {
    const key = typeof window !== 'undefined' ? localStorage.getItem('zimbroo_secret_key') : null;
    if (!key) {
      alert('Atenção: Você precisa conectar seu Notion no Passo 1 primeiro para o Bot funcionar!');
      return;
    }
    localStorage.setItem('hub_shortcut_done', 'true');
    setShortcutSaved(true);
    window.location.href = '/bot';
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar todo o progresso do checklist e limpar a chave atual?')) {
      localStorage.removeItem('zimbroo_secret_key');
      localStorage.removeItem('hub_shortcut_done');
      localStorage.removeItem('hub_template_id');
      setNotionConnected(false);
      setShortcutSaved(false);
      setTemplateId(null);
      setActiveAccordion(null);

      // Limpa os parâmetros da URL (como ?key=...) para que um F5 não recarregue a chave
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair da sua conta?')) {
      auth.signOut();
    }
  };

  const handleOpenNotion = () => {
    if (templateId) {
      const cleanId = templateId.replace(/-/g, '');
      window.open(`https://www.notion.so/${cleanId}`, '_blank');
    } else {
      window.open('https://www.notion.so/', '_blank');
    }
  };

  if (loadingAuth) {
    return <div className="main" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;
  }

  const localKey = typeof window !== 'undefined' ? localStorage.getItem('zimbroo_secret_key') : secretKey;
  const contentMaxWidth = user ? '500px' : '1000px';

  return (
    <main className="main" style={{ justifyContent: 'flex-start', paddingTop: '4rem' }}>
      
      {/* Header Comum */}
      <div className="app-header animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: contentMaxWidth, margin: '0 auto 2rem auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <picture>
            <source srcSet="/icon-dark.png" media="(prefers-color-scheme: dark)" />
            <img src="/icon-light.png" alt="Logo" width={48} height={48} style={{ objectFit: 'contain' }} />
          </picture>
          <h1 style={{ margin: 0 }}>Hub Financeiro</h1>
        </div>
        
        {user ? (
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            Sair
          </button>
        ) : (
          <button onClick={handleLogin} className="btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', borderRadius: '8px', cursor: 'pointer' }}>
            Login
          </button>
        )}
      </div>

      {!user ? (
        /* ================= TELA PRE-LOGIN (LANDING PAGE) ================= */
        <div className="lp-container animate-fade" style={{maxWidth: '1000px'}}>
          
          {/* Nova Hero Section: 2 Colunas */}
          <div className="lp-hero-grid">
            <div className="lp-3d-wrapper">
              <img src="/app-dashboard.png" alt="Dashboard do Hub Financeiro" className="lp-3d-image" />
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(150,150,150,0.08)', padding: '6px 14px', borderRadius: '20px', marginBottom: '1.2rem', border: '1px solid var(--border)', width: 'fit-content' }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="Notion" width="16" height="16" style={{ borderRadius: '4px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>Construído no Notion</span>
              </div>

              <h1 className="lp-hero-title">O Sistema Inteligente para Controlar seu Dinheiro</h1>
              <p className="lp-text" style={{fontSize: '1.2rem', marginBottom: '2rem'}}>
                Esqueça planilhas complicadas. Automatize sua vida financeira em um único lugar, visual e direto ao ponto.
              </p>
              
              <button onClick={handleLogin} className="btn-primary" style={{ background: 'var(--foreground)', color: 'var(--background)', width: '100%', padding: '1.2rem' }}>
                Entre e faça sua assinatura
              </button>
            </div>
          </div>

          {/* Interactive Data Block - No Card */}
          <div className="data-showcase">
            <div className="data-stat">
              <span className="data-number">80<span style={{fontSize: '0.6em'}}><span style={{WebkitTextFillColor: 'initial', color: 'var(--foreground)'}}>%</span></span></span>
              <p className="data-label">das pessoas abandonam planilhas no 2º mês.</p>
            </div>
            <div className="data-divider"></div>
            <div className="data-solution">
              <h3>O Hub Financeiro inverte a estatística.</h3>
              <p>Ele é um <strong>ecossistema de gestão financeira</strong> que roda no seu celular e sincroniza perfeitamente com a nuvem. Aqui você não precisa abrir seu Notion para preencher tabelas chatas. Você apenas manda um áudio e a IA organiza tudo por você em <strong>segundos</strong>.</p>
            </div>
          </div>

          <div className="lp-divider" style={{margin: '4rem 0'}}></div>

          <h2 className="lp-hero-subtitle" style={{textAlign: 'center', marginBottom: '3rem', fontSize: '1.8rem'}}>Planos para qualquer objetivo</h2>

          {/* Pricing Grid */}
          <div className="pricing-grid">
            {/* PLANO BÁSICO */}
            <div className="pricing-card">
              <h3 className="pricing-title">Básico</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>Apenas o sistema no Notion.</p>
              <div className="pricing-price">R$ 49,90 <span className="pricing-period">/ único</span></div>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Template Notion Premium</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Visão anual em uma tela</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem automação por voz</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem Inteligência Artificial</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Escolher Básico
              </button>
            </div>

            {/* PLANO IA PLUS */}
            <div className="pricing-card featured">
              <div style={{position:'absolute', top:'-12px', right:'2rem', background:'#0085E6', color:'#ffffff', fontSize:'0.75rem', fontWeight:800, padding:'6px 14px', borderRadius:'12px', letterSpacing:'0.5px', textTransform:'uppercase'}}>Mais Popular</div>
              <h3 className="pricing-title">IA Plus</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>Automação no seu celular.</p>
              <div className="pricing-price">R$ 14,90 <span className="pricing-period">/ mês</span></div>
              <p style={{fontSize:'0.8rem', opacity:0.6, marginTop:'-10px', marginBottom:'15px'}}>ou R$ 149,00 / ano</p>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Tudo do Básico</li>
                <li><span style={{fontSize:'1rem'}}>🚀</span> <strong>Automação por Voz</strong></li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Adicione gastos sem digitar</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem análises e conselhos</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Testar IA Plus
              </button>
            </div>

            {/* PLANO IA PRO */}
            <div className="pricing-card">
              <h3 className="pricing-title">IA Pro</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>Seu consultor financeiro VIP.</p>
              <div className="pricing-price">R$ 24,90 <span className="pricing-period">/ mês</span></div>
              <p style={{fontSize:'0.8rem', opacity:0.6, marginTop:'-10px', marginBottom:'15px'}}>ou R$ 249,00 / ano</p>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Tudo do IA Plus</li>
                <li><span style={{fontSize:'1rem'}}>🧠</span> <strong>Conselheiro IA Avançado</strong></li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Dicas de economia reais</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Análise de perfil de gastos</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Conhecer IA Pro
              </button>
            </div>
          </div>

          <div className="lp-divider" style={{margin: '4rem 0'}}></div>

          {/* Features Expandidas e Mais Persuasivas */}
          <div className="features-grid">
            <div>
              <span style={{fontSize: '2rem', display: 'block', marginBottom: '0.5rem'}}>🎙️</span>
              <h3 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>O Fim da Digitação Manual</h3>
              <p className="lp-text">
                A preguiça de anotar os gastos é o maior inimigo da sua conta bancária. Com a nossa automação, <strong>você apenas fala no celular</strong> (ex: "gastei 50 no ifood"). A IA entende a categoria, a data e o valor, e o Hub organiza tudo para você na hora.
              </p>
            </div>
            <div>
              <span style={{fontSize: '2rem', display: 'block', marginBottom: '0.5rem'}}>📊</span>
              <h3 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>Visão Anual Panorâmica</h3>
              <p className="lp-text">
                Sem dezenas de abas soltas e cálculos perdidos. Saiba exatamente de onde vem o seu dinheiro e para onde ele vai ao longo dos 12 meses, tudo na mesma tela, com <strong>feedbacks em cores</strong> que mostram se você está no azul ou no vermelho.
              </p>
            </div>
            <div>
              <span style={{fontSize: '2rem', display: 'block', marginBottom: '0.5rem'}}>🗂️</span>
              <h3 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>Categorização Inteligente</h3>
              <p className="lp-text">
                Para controlar o dinheiro, você precisa saber por onde ele escapa. O Hub separa e totaliza seus gastos (Moradia, Lazer, Educação) e monta gráficos limpos para você <strong>encontrar o gargalo financeiro</strong> do seu mês.
              </p>
            </div>
            <div>
              <span style={{fontSize: '2rem', display: 'block', marginBottom: '0.5rem'}}>🧠</span>
              <h3 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>Conselhos Personalizados</h3>
              <p className="lp-text">
                Não sabe se pode assumir aquela parcela? Pergunte à IA. Com o plano Pro, a Inteligência Artificial <strong>lê seu balancete</strong> e atua como seu conselheiro financeiro VIP, dando dicas reais sobre sua saúde financeira.
              </p>
            </div>
          </div>

          {/* Final CTA Box */}
          <div className="cta-box">
            <h2 className="cta-title">Pronto para assumir o controle?</h2>
            <p className="cta-subtitle">A paz mental de saber exatamente para onde vai o seu dinheiro está a um clique de distância.</p>
            <button onClick={handleLogin} className="cta-btn">
              Entre e faça sua assinatura
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>

          <div style={{background: 'rgba(255,150,0,0.05)', border: '1px solid #f59e0b', borderRadius: '12px', padding: '1.5rem', width: '100%', marginBottom: '4rem'}}>
            <p style={{fontSize: '0.9rem', color: '#888', margin: 0}}>
              <strong style={{color: '#f59e0b'}}>⚠️ Nota Técnica:</strong> O Hub Financeiro é construído sobre o Notion, o que permite que ele funcione nativamente na Web, Android e iOS. A automação por voz utiliza o aplicativo "Atalhos" no iOS (iPhone) e funciona via WebApp no Android.
            </p>
          </div>

        </div>
      ) : (
        /* ================= TELA POST-LOGIN ================= */
        <div className="glass-card animate-fade" style={{ padding: '2rem 2.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 className="hero-title" style={{ fontSize: '2rem', marginBottom: 0 }}>
              Olá, <span>{user.displayName?.split(' ')[0] || 'Visitante'}</span>!
            </h2>
          </div>
          
          <p className="subtitle" style={{ fontSize: '1rem', marginBottom: '2rem' }}>
            Siga os passos abaixo para preparar seu ambiente financeiro.
          </p>

          <div className="checklist">
            {/* Etapa 1: Conectar Bot e Duplicar */}
            <div className={`check-item ${notionConnected ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(0)}>
                <div className="check-content-title">
                  <span className="check-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </span>
                  <div className="check-text">
                    <h4>Crie e Conecte seu Sistema</h4>
                  </div>
                </div>
                <div className="check-circle"></div>
              </div>
              <div className={`accordion-content ${activeAccordion === 0 ? 'expanded' : ''}`}>
                <p className="accordion-text">
                  {notionConnected 
                    ? "Excelente! Seu banco de dados foi criado e conectado. Abaixo está sua chave de segurança. Ela já está salva neste navegador, mas copie-a para a próxima etapa."
                    : "Ao clicar abaixo, o Notion vai pedir sua permissão. Ele criará automaticamente o template financeiro na sua conta e conectará nosso robô a ele em um único passo!"}
                </p>
                
                {notionConnected && localKey ? (
                  <div style={{ marginBottom: '1.2rem' }}>
                    <code style={{ fontSize: '0.8rem', background: 'rgba(150,150,150,0.1)', padding: '0.8rem', borderRadius: '8px', display: 'block', wordBreak: 'break-all', border: '1px dashed var(--border)' }}>
                      {localKey}
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(localKey);
                        alert('Chave copiada!');
                        setActiveAccordion(platform === 'ios' ? 1 : 2);
                      }}
                      className="accordion-btn"
                      style={{ marginTop: '0.8rem', background: 'none', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    >
                      Copiar e Avançar
                    </button>
                  </div>
                ) : (
                  <button onClick={handleNotionConnect} className="accordion-btn">
                    Conectar com Notion
                  </button>
                )}
              </div>
            </div>

            {/* Etapa 2: Atalho iOS */}
            <div className={`check-item ${shortcutSaved && platform === 'ios' ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(1)}>
                <div className="check-content-title">
                  <span className="check-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="1.2rem" height="1.2rem" viewBox="0 0 256 315" fill="currentColor"><path d="M213.803 167.03c.442 47.58 41.74 63.413 42.197 63.615-.335 1.05-6.568 22.56-21.726 44.713-13.104 19.153-26.705 38.234-48.23 38.633-21.144.39-27.953-12.484-52.179-12.484-24.23 0-31.802 12.1-51.774 12.893-20.741.798-36.316-20.746-49.52-39.823-26.995-39.043-47.568-110.37-19.735-158.606 13.813-24.07 38.53-39.318 65.346-39.712 20.34-.398 39.512 13.685 51.972 13.685 12.464 0 35.592-16.83 60.235-14.326 10.323.43 39.313 4.14 57.91 31.417-1.488.922-34.61 20.155-34.226 60.007zM174.003 44.45c11.066-13.34 18.52-31.902 16.484-50.418-15.894.64-35.08 10.59-46.48 23.93-10.22 11.82-19.143 30.803-16.737 48.91 17.705 1.375 35.66-9.08 46.733-22.422z"/></svg>
                  </span>
                  <div className="check-text">
                    <h4>Salve o atalho [iOS]</h4>
                  </div>
                </div>
                <div className="check-circle"></div>
              </div>
              <div className={`accordion-content ${activeAccordion === 1 ? 'expanded' : ''}`}>
                <p className="accordion-text">
                  Tenha o Hub Financeiro integrado direto no seu iPhone usando o aplicativo "Atalhos". Ao baixar, ele pedirá sua Chave de Segurança (aquela que geramos no passo anterior).
                </p>
                <button onClick={handleShortcutClick} className="accordion-btn">
                  Baixar Atalho iOS
                </button>
              </div>
            </div>

            {/* Etapa 3: Atalho Android */}
            <div className={`check-item ${shortcutSaved && platform === 'android' ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(2)}>
                <div className="check-content-title">
                  <span className="check-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="currentColor"><path d="M16 13c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zM8 13c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm8.5-5.38L17.61 6.5a.495.495 0 1 0-.7-.7L15.65 7.06A7.476 7.476 0 0 0 12 6a7.476 7.476 0 0 0-3.65 1.06L7.1 5.8a.495.495 0 0 0-.7.7l1.11 1.12c-2.31 1.54-3.51 4-3.51 6.38h16c0-2.38-1.2-4.84-3.5-6.38z"/></svg>
                  </span>
                  <div className="check-text">
                    <h4>Salve o atalho [Android]</h4>
                  </div>
                </div>
                <div className="check-circle"></div>
              </div>
              <div className={`accordion-content ${activeAccordion === 2 ? 'expanded' : ''}`}>
                <p className="accordion-text">
                  Para usar o Bot de Voz clique no botão abaixo.<br/><br/>
                  No Google Chrome do seu celular, clique em Compartilhar e selecione <strong>"Adicionar à tela inicial"</strong>. Isso vai instalar o aplicativo do Hub Financeiro no seu celular!
                </p>
                <button onClick={handleAndroidPWA} className="accordion-btn">
                  Acessar Bot de Voz
                </button>
              </div>
            </div>

          </div>

          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <button 
              onClick={handleOpenNotion}
              className="accordion-btn"
              style={{ 
                margin: '0 auto', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                width: '100%',
                padding: '1.2rem',
                fontSize: '1.05rem',
                opacity: notionConnected ? 1 : 0.4,
                cursor: notionConnected ? 'pointer' : 'not-allowed',
                pointerEvents: notionConnected ? 'auto' : 'none'
              }}
              disabled={!notionConnected}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="Notion Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              Acessar meu Hub Financeiro
            </button>
          </div>
        </div>
      )}
      {user && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginTop: '3rem' }}>
          <button onClick={handleReset} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Resetar meu progresso
          </button>

          <button onClick={handleLogout} className="logout-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      )}

      <footer style={{ marginTop: '1.5rem', color: '#888888', fontSize: '0.8rem', textAlign: 'center' }}>
        © 2026 Hub Financeiro Bot
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="main" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>}>
      <LandingContent />
    </Suspense>
  );
}
