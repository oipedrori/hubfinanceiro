'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, loginWithGoogle, logout } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function LandingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const secretKey = searchParams.get('key');
  
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  
  // Estado para os acordeões
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);
  
  // Estados do Checklist
  const [templateDuplicated, setTemplateDuplicated] = useState(false);
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
    setTemplateDuplicated(localStorage.getItem('hub_template_done') === 'true');
    setShortcutSaved(localStorage.getItem('hub_shortcut_done') === 'true');

    // Se houver chave na URL, salva no localstorage, marca como conectado e abre o acordeão do Notion
    if (secretKey) {
      localStorage.setItem('zimbroo_secret_key', secretKey);
      setNotionConnected(true);
      setActiveAccordion(1); // Abre o acordeão do "Conectar o Bot" para mostrar a chave
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

  const handleDuplication = () => {
    window.open('https://www.notion.so/pedrori/Template-Finan-as-144ad1f2859080a08eb9c4d2f2907c7a', '_blank');
    localStorage.setItem('hub_template_done', 'true');
    setTemplateDuplicated(true);
    setActiveAccordion(1); // Avança para o próximo passo
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
    localStorage.setItem('hub_shortcut_done', 'true');
    setShortcutSaved(true);
    window.location.href = '/bot';
  };

  if (loadingAuth) {
    return <div className="main"><p>Carregando...</p></div>;
  }

  const localKey = typeof window !== 'undefined' ? localStorage.getItem('zimbroo_secret_key') : secretKey;

  return (
    <main className="main" style={{ justifyContent: 'flex-start', paddingTop: '4rem' }}>
      
      {/* Header Comum */}
      <div className="app-header animate-fade">
        <picture>
          <source srcSet="/icon-dark.png" media="(prefers-color-scheme: dark)" />
          <img src="/icon-light.png" alt="Logo" width={48} height={48} style={{ objectFit: 'contain' }} />
        </picture>
        <h1>Hub Financeiro</h1>
      </div>

      {!user ? (
        /* ================= TELA PRE-LOGIN (LANDING PAGE) ================= */
        <div className="lp-container animate-fade">
          <h1 className="lp-hero-title">Hub Financeiro: O Sistema Inteligente para Controlar seu Dinheiro</h1>
          <h2 className="lp-hero-subtitle">Você não precisa ganhar rios de dinheiro para ser organizado.</h2>
          <p className="lp-text">Você só precisa do sistema certo.</p>
          
          <img src="/app-dashboard.png" alt="Dashboard do Hub Financeiro" className="lp-hero-image" />

          <p className="lp-text">
            Cansado de planilhas complicadas que você começa em janeiro e abandona em fevereiro? O <span className="lp-highlight">Hub Financeiro</span> foi desenhado com um único objetivo: tirar o peso da gestão financeira das suas costas e transformá-la em algo simples, visual e — o melhor de tudo — <span className="lp-highlight">automático</span>.
          </p>

          <h2 className="lp-hero-subtitle" style={{marginTop: '2.5rem'}}>Este não é apenas mais um template de Notion.</h2>
          <p className="lp-text">É o seu sistema operacional financeiro para o ano todo.</p>

          <div className="pricing-grid">
            {/* PLANO BÁSICO */}
            <div className="pricing-card">
              <h3 className="pricing-title">Básico</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>O alicerce da sua organização.</p>
              <div className="pricing-price">R$ 49,90 <span className="pricing-period">/ único</span></div>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Template Notion Original</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Visão anual centralizada</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Gráficos de balancete</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem comandos de voz</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem Inteligência Artificial</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Escolher Básico
              </button>
            </div>

            {/* PLANO IA PLUS */}
            <div className="pricing-card featured">
              <div style={{position:'absolute', top:'-12px', right:'2rem', background:'#f59e0b', color:'#000', fontSize:'0.7rem', fontWeight:800, padding:'4px 12px', borderRadius:'12px', letterSpacing:'0.5px', textTransform:'uppercase'}}>Mais Popular</div>
              <h3 className="pricing-title">IA Plus</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>Seu assistente de bolso.</p>
              <div className="pricing-price">R$ 14,90 <span className="pricing-period">/ mês</span></div>
              <p style={{fontSize:'0.8rem', opacity:0.6, marginTop:'-10px', marginBottom:'15px'}}>ou R$ 149,00 / ano</p>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Tudo do plano Básico</li>
                <li><span style={{fontSize:'1rem'}}>🚀</span> <strong>Automação por Voz</strong></li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Lance despesas sem digitar nada</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Integração de atalhos (iOS/Android)</li>
                <li><span style={{fontSize:'1rem', opacity:0.3}}>❌</span> Sem conselheiro financeiro VIP</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Testar IA Plus
              </button>
            </div>

            {/* PLANO IA PRO */}
            <div className="pricing-card">
              <h3 className="pricing-title">IA Pro</h3>
              <p className="lp-text" style={{fontSize:'0.9rem', marginBottom:'0'}}>Seu conselheiro financeiro VIP.</p>
              <div className="pricing-price">R$ 24,90 <span className="pricing-period">/ mês</span></div>
              <p style={{fontSize:'0.8rem', opacity:0.6, marginTop:'-10px', marginBottom:'15px'}}>ou R$ 249,00 / ano</p>
              <ul className="pricing-features">
                <li><span style={{fontSize:'1rem'}}>✅</span> Tudo do plano Plus</li>
                <li><span style={{fontSize:'1rem'}}>🧠</span> <strong>Conselheiro IA Avançado</strong></li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Dicas para economizar</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Análises profundas de gastos</li>
                <li><span style={{fontSize:'1rem'}}>✅</span> Conversas e tira-dúvidas</li>
              </ul>
              <button onClick={handleLogin} className="pricing-btn btn-outline">
                Conhecer IA Pro
              </button>
            </div>
          </div>

          <div className="lp-divider"></div>

          <div className="lp-aside">
            <h3>O que você vai encontrar aqui:</h3>
            <ul>
              <li><span style={{fontSize:'1.1rem'}}>✅</span> <span><strong>Visão Anual em Uma Tela:</strong> Chega de abas infinitas. Controle seus 12 meses em um único painel intuitivo.</span></li>
              <li><span style={{fontSize:'1.1rem'}}>✅</span> <span><strong>Feedback Visual Imediato:</strong> O sistema te avisa com cores.</span></li>
              <li><span style={{fontSize:'1.1rem'}}>✅</span> <span><strong>Botões que fazem tudo sozinhos:</strong> O sistema já vincula suas movimentações aos meses corretamente.</span></li>
              <li><span style={{fontSize:'1.1rem'}}>✅</span> <span><strong>Uma IA que faz todo o trabalho chato:</strong> Basta falar qual foi sua despesa ou receita e a IA adiciona tudo no seu Notion.</span></li>
            </ul>
          </div>

          <img src="/app-dashboard.png" alt="Visão Geral do Hub Financeiro" className="lp-hero-image" />

          <div className="lp-divider"></div>

          <h2 className="lp-hero-subtitle">🚀 BÔNUS EXCLUSIVO: Sua Própria IA Financeira</h2>
          <p className="lp-text" style={{fontWeight: 700}}>O Fim do Preenchimento Manual</p>
          <p className="lp-text">
            O maior inimigo da organização é a preguiça de anotar os gastos. Por isso, criei uma solução definitiva.
          </p>
          <p className="lp-text">
            Você terá acesso ao <span className="lp-highlight">Tutorial de Integração Notion + IA</span>. Um passo a passo detalhado onde ensino como transformar seu celular em um assistente pessoal que registra tudo por comando de voz.
          </p>
          <p className="lp-text" style={{fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)'}}>
            Você fala, a IA entende e o Hub Financeiro organiza. Simples assim.
          </p>

          <div className="lp-divider"></div>

          <div className="lp-aside" style={{borderLeftColor: '#888'}}>
            <h3>Para quem é isso?</h3>
            <ul>
              <li><span style={{color: '#888'}}>•</span> <span>Para quem ama organização, mas odeia perder tempo preenchendo células de Excel.</span></li>
              <li><span style={{color: '#888'}}>•</span> <span>Para quem quer ter paz mental ao olhar para a conta bancária.</span></li>
              <li><span style={{color: '#888'}}>•</span> <span>Para quem quer usar a tecnologia (e a IA) para facilitar a vida adulta.</span></li>
            </ul>
          </div>

          <div className="lp-aside" style={{background: 'rgba(255,150,0,0.05)', borderLeftColor: '#f59e0b'}}>
            <p style={{fontSize: '0.9rem', color: '#888', lineHeight: 1.5}}>
              <strong style={{color: '#f59e0b'}}>⚠️ Requisitos do Sistema:</strong> O Hub Financeiro funciona em qualquer dispositivo (Web, Android e iOS). O <strong>Bônus de Automação com IA</strong> utiliza o recurso "Atalhos", exclusivo para <strong>iPhone/iOS</strong> no momento. Versão para Android em desenvolvimento.
            </p>
          </div>

        </div>
      ) : (
        /* ================= TELA POST-LOGIN ================= */
        <div className="glass-card animate-fade" style={{ padding: '2rem 2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="hero-title" style={{ fontSize: '2rem', marginBottom: 0 }}>
              Olá, <span>{user.displayName?.split(' ')[0] || 'Visitante'}</span>!
            </h2>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}>
              Sair
            </button>
          </div>
          
          <p className="subtitle" style={{ fontSize: '1rem', marginBottom: '2rem' }}>
            Siga os passos abaixo para preparar seu ambiente financeiro.
          </p>

          <div className="checklist">
            {/* Etapa 1: Template */}
            <div className={`check-item ${templateDuplicated ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(0)}>
                <div className="check-content-title">
                  <span className="check-icon">📝</span>
                  <div className="check-text">
                    <h4>Duplique o template</h4>
                  </div>
                </div>
                <div className="check-circle"></div>
              </div>
              <div className={`accordion-content ${activeAccordion === 0 ? 'expanded' : ''}`}>
                <p className="accordion-text">
                  Para o sistema funcionar, você precisa ter a estrutura do banco de dados na sua conta do Notion. Clique no botão abaixo para abrir a página e, no canto superior direito, clique em "Duplicate" ou "Duplicar".
                </p>
                <button onClick={handleDuplication} className="accordion-btn">
                  Acessar Template
                </button>
              </div>
            </div>

            {/* Etapa 2: Conectar Bot */}
            <div className={`check-item ${notionConnected ? 'completed' : ''}`}>
              <div className="check-header" onClick={() => toggleAccordion(1)}>
                <div className="check-content-title">
                  <span className="check-icon">🤖</span>
                  <div className="check-text">
                    <h4>Conecte o Bot</h4>
                  </div>
                </div>
                <div className="check-circle"></div>
              </div>
              <div className={`accordion-content ${activeAccordion === 1 ? 'expanded' : ''}`}>
                <p className="accordion-text">
                  {notionConnected 
                    ? "Excelente! Seu Notion está conectado. Abaixo está sua chave de segurança gerada automaticamente. Ela já está salva no seu navegador, mas é bom você tê-la caso precise configurar outro dispositivo."
                    : "Agora precisamos que você dê permissão para o nosso robô ler e escrever as informações financeiras no template que você acabou de duplicar."}
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
                        setActiveAccordion(platform === 'ios' ? 2 : 3);
                      }}
                      className="accordion-btn"
                      style={{ marginTop: '0.8rem', background: 'none', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    >
                      Copiar e Avançar
                    </button>
                  </div>
                ) : (
                  <button onClick={handleNotionConnect} className="accordion-btn">
                    Conectar Notion
                  </button>
                )}
              </div>
            </div>

            {/* Etapa 3: Atalho iOS */}
            {(platform === 'ios' || platform === 'other') && (
              <div className={`check-item ${shortcutSaved && platform === 'ios' ? 'completed' : ''}`}>
                <div className="check-header" onClick={() => toggleAccordion(2)}>
                  <div className="check-content-title">
                    <span className="check-icon">📱</span>
                    <div className="check-text">
                      <h4>Salve o atalho [iOS]</h4>
                    </div>
                  </div>
                  <div className="check-circle"></div>
                </div>
                <div className={`accordion-content ${activeAccordion === 2 ? 'expanded' : ''}`}>
                  <p className="accordion-text">
                    Tenha o Hub Financeiro integrado direto no seu iPhone usando o aplicativo "Atalhos". Ao baixar, ele pedirá sua Chave de Segurança (aquela que geramos no passo anterior).
                  </p>
                  <button onClick={handleShortcutClick} className="accordion-btn">
                    Baixar Atalho iOS
                  </button>
                </div>
              </div>
            )}

            {/* Etapa 4: PWA Android */}
            {(platform === 'android' || platform === 'other') && (
              <div className={`check-item ${shortcutSaved && platform === 'android' ? 'completed' : ''}`}>
                <div className="check-header" onClick={() => toggleAccordion(3)}>
                  <div className="check-content-title">
                    <span className="check-icon">🤖</span>
                    <div className="check-text">
                      <h4>Salve o atalho [Android]</h4>
                    </div>
                  </div>
                  <div className="check-circle"></div>
                </div>
                <div className={`accordion-content ${activeAccordion === 3 ? 'expanded' : ''}`}>
                  <p className="accordion-text">
                    Para usar no Android, acesse o Bot de Voz. No Google Chrome, clique nos três pontinhos no canto superior direito e selecione <strong>"Adicionar à tela inicial"</strong>. Isso vai instalar o aplicativo do Hub no seu celular!
                  </p>
                  <button onClick={handleAndroidPWA} className="accordion-btn">
                    Acessar Bot de Voz
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      
      <footer style={{ marginTop: '3rem', color: '#888888', fontSize: '0.8rem', textAlign: 'center' }}>
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
