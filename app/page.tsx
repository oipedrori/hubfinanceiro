'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, loginWithGoogle, logout } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function LandingContent() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  
  // Estado para os acordeões
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);
  
  // Estados do Checklist
  const [notionConnected, setNotionConnected] = useState(false);
  const [shortcutSaved, setShortcutSaved] = useState(false);

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
      setNotionConnected(true);
      setActiveAccordion(0); // Mantém o acordeão da chave aberto para copiar
    } else if (localStorage.getItem('zimbroo_secret_key')) {
      setNotionConnected(true);
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
      setNotionConnected(false);
      setShortcutSaved(false);
      setActiveAccordion(null);
    }
  };

  if (loadingAuth) {
    return <div className="main"><p>Carregando...</p></div>;
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
              <strong style={{color: '#f59e0b'}}>⚠️ Nota Técnica:</strong> O Hub roda na Web, Android e iOS. A automação por voz funciona via aplicativo "Atalhos" no iOS (iPhone) e via PWA (Web App) no Android.
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
                  <span className="check-icon">🤖</span>
                  <div className="check-text">
                    <h4>Conecte e Crie seu Sistema</h4>
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
                  <span className="check-icon">📱</span>
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

            {/* Etapa 3: PWA Android */}
            <div className={`check-item ${shortcutSaved && platform === 'android' ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(2)}>
                <div className="check-content-title">
                  <span className="check-icon">🤖</span>
                  <div className="check-text">
                    <h4>Salve o atalho [Android / PWA]</h4>
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
              onClick={() => window.open('https://www.notion.so/', '_blank')}
              className="accordion-btn"
              style={{ margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', maxWidth: '300px' }}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="Notion Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
              Acessar meu Hub Financeiro
            </button>
          </div>
        </div>
      )}
      {user && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
          <button onClick={handleReset} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Resetar meu progresso
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
    <Suspense fallback={<div className="main"><p>Carregando...</p></div>}>
      <LandingContent />
    </Suspense>
  );
}
