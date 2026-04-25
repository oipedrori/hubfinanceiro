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
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Estados do Checklist
  const [templateDuplicated, setTemplateDuplicated] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [shortcutSaved, setShortcutSaved] = useState(false);
  
  // Modal PWA Android
  const [showAndroidPWA, setShowAndroidPWA] = useState(false);

  const slides = [
    { title: "Controle seus dados", desc: "Totalmente privado e no seu Notion" },
    { title: "IA Inteligente", desc: "Utilize IA para te ajudar com as suas finanças" },
    { title: "Sempre com você", desc: "Tenha tudo na palma da mão a qualquer momento do dia" },
    { title: "Em breve", desc: "Conecte seus bancos com Open Finance" }
  ];

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

    // Se houver chave na URL, salva no localstorage e marca como conectado
    if (secretKey) {
      localStorage.setItem('zimbroo_secret_key', secretKey);
      setNotionConnected(true);
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

  useEffect(() => {
    // Rotação do Carrossel a cada 5s
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      alert('Erro ao fazer login. Verifique sua conexão e o console do Firebase.');
    }
  };

  const handleDuplication = () => {
    window.open('https://www.notion.so/pedrori/Template-Finan-as-144ad1f2859080a08eb9c4d2f2907c7a', '_blank');
    localStorage.setItem('hub_template_done', 'true');
    setTemplateDuplicated(true);
  };

  const handleNotionConnect = () => {
    const clientId = '31ed872b-594c-81a0-8494-0037918ae6cc';
    const redirectUri = 'https://hubfinanceirobot.vercel.app/api/auth/callback/notion';
    window.location.href = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const handleShortcutClick = () => {
    if (platform === 'ios') {
      window.open('https://www.icloud.com/shortcuts/f6a018a3e2694c7d819d5370a95c40fc', '_blank');
    } else {
      setShowAndroidPWA(true);
    }
    localStorage.setItem('hub_shortcut_done', 'true');
    setShortcutSaved(true);
  };

  if (loadingAuth) {
    return <div className="main"><p>Carregando...</p></div>;
  }

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
        /* ================= TELA PRE-LOGIN ================= */
        <div className="glass-card animate-fade" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p className="subtitle" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
            O sistema inteligente para cuidar do seu dinheiro.
          </p>

          <div className="carousel-container">
            {slides.map((slide, index) => (
              <div key={index} className={`carousel-slide ${index === activeSlide ? 'active' : ''}`}>
                <h3>{slide.title}</h3>
                <p>{slide.desc}</p>
              </div>
            ))}
          </div>

          <button onClick={handleLogin} className="btn-primary" style={{ marginTop: '1rem', background: 'var(--foreground)', color: 'var(--background)' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>
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
            Complete as etapas abaixo para configurar seu Hub.
          </p>

          <div className="checklist">
            {/* Etapa 1 */}
            <div className={`check-item ${templateDuplicated ? 'completed' : ''}`} onClick={handleDuplication}>
              <div className="check-content">
                <span className="check-icon">📝</span>
                <div className="check-text">
                  <h4>Duplique o template</h4>
                  <p>Copie o template do Hub para o seu Notion</p>
                </div>
              </div>
              <div className="check-circle"></div>
            </div>

            {/* Etapa 2 */}
            <div className={`check-item ${notionConnected ? 'completed' : ''}`} onClick={handleNotionConnect}>
              <div className="check-content">
                <span className="check-icon">🤖</span>
                <div className="check-text">
                  <h4>Conecte o Bot</h4>
                  <p>Integre a Inteligência Artificial ao seu Notion</p>
                </div>
              </div>
              <div className="check-circle"></div>
            </div>

            {/* Etapa 3 */}
            <div className={`check-item ${shortcutSaved ? 'completed' : ''}`} onClick={handleShortcutClick}>
              <div className="check-content">
                <span className="check-icon">📱</span>
                <div className="check-text">
                  <h4>Salve o atalho</h4>
                  <p>Adicione o app na tela inicial do seu {platform === 'ios' ? 'iOS' : 'Android'}</p>
                </div>
              </div>
              <div className="check-circle"></div>
            </div>
          </div>

          {showAndroidPWA && platform !== 'ios' && (
            <div className="animate-fade" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(150,150,150,0.05)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Como instalar no Android:</p>
              <ol style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#888888', lineHeight: '1.6' }}>
                <li>Abra o navegador Chrome.</li>
                <li>Acesse o endereço: <strong>hubfinanceirobot.vercel.app/bot</strong></li>
                <li>Clique nos três pontinhos no canto superior direito.</li>
                <li>Selecione <strong>"Adicionar à tela inicial"</strong>.</li>
              </ol>
              <button onClick={() => setShowAndroidPWA(false)} style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--foreground)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                Entendi
              </button>
            </div>
          )}

          {/* Área Secreta caso o usuário queira ver a chave */}
          {notionConnected && secretKey && (
            <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>Sua chave de conexão (já salva automaticamente):</p>
              <code style={{ fontSize: '0.8rem', background: 'rgba(150,150,150,0.1)', padding: '0.5rem', borderRadius: '8px', display: 'block', wordBreak: 'break-all' }}>
                {secretKey}
              </code>
            </div>
          )}
        </div>
      )}
      
      <footer style={{ marginTop: '3rem', color: '#888888', fontSize: '0.8rem' }}>
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
