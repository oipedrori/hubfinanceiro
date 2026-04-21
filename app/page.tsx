'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

function LandingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const secretKey = searchParams.get('key');
  const name = searchParams.get('name');
  const error = searchParams.get('error');

  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

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

    // Salvar chave no localStorage se ela existir na URL
    if (secretKey) {
      localStorage.setItem('zimbroo_secret_key', secretKey);
    }
  }, [secretKey]);

  const clientId = '31ed872b-594c-81a0-8494-0037918ae6cc';
  const redirectUri = 'https://hubfinanceirobot.vercel.app/api/auth/callback/notion';
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const firstName = name ? name.split(' ')[0] : '';

  return (
    <main className="main">
      <div className="bg-glow"></div>
      
      <div className="glass-card animate-fade">
        {/* Pílula removida para minimalismo total */}

        {success ? (
          <div style={{ textAlign: 'left' }}>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>Pronto, <span>{firstName}</span>!</h1>
            <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
              Seu Notion foi conectado com sucesso. {platform === 'ios' ? 'Siga os passos abaixo para configurar o seu iPhone.' : 'Agora ficou fácil usar no seu Android.'}
            </p>
            
            {platform === 'ios' && (
              <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '1rem' }}>Como configurar no iPhone:</p>
                <ol style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '8px' }}>Copie sua chave secreta gerada logo abaixo.</li>
                  <li style={{ marginBottom: '8px' }}>Clique no botão azul "Baixar Atalho" no final desta página.</li>
                  <li style={{ marginBottom: '8px' }}>Ao adicionar o seu Atalho, ele solicitará o seu código. Basta colar a chave que você copiou.</li>
                  <li>Adicione o atalho na página inicial do seu celular para ter o Hub Financeiro sempre à mão.</li>
                </ol>
              </div>
            )}

            <div className="success-box">
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>SUA CHAVE SECRETA:</p>
              <div className="key-display">
                <span>{secretKey}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(secretKey || '');
                    alert('Chave copiada!');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  COPIAR
                </button>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {platform === 'ios' ? (
                <a href="https://www.icloud.com/shortcuts/adec613888cf4228aa07ab6386f81aa4" target="_blank" className="btn-primary">
                  Baixar Atalho do iOS
                </a>
              ) : (
                <a href="/bot" className="btn-primary">
                  Usar Web App (Modo Voz)
                </a>
              )}
              
              <button 
                onClick={() => window.location.href = '/'}
                style={{ background: 'none', border: '1px solid var(--border)', color: '#94a3b8', padding: '0.8rem 2.5rem', borderRadius: '12px', cursor: 'pointer', width: '100%', fontWeight: 600 }}
              >
                Voltar ao início
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="hero-title">Hub Financeiro <span>Bot</span></h1>
            <p className="subtitle">
              Sua gestão financeira, agora com o poder da voz e Inteligência Artificial integrada ao seu Notion. 
              Sem formulários, sem planilhas chatas. Apenas fale.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <a href={notionAuthUrl} className="btn-primary">
                <img src="https://www.notion.so/images/favicon.ico" alt="Notion" width={20} height={20} />
                Conectar seu Notion
              </a>
              
              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '10px' }}>
                  Ops! Houve um erro na conexão: {error}. Tente novamente.
                </p>
              )}
              
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '1.5rem' }}>
                Seguro. Privado. Seus dados continuam no seu Notion.
              </p>
            </div>
          </>
        )}
      </div>

      <footer style={{ marginTop: '4rem', color: '#64748b', fontSize: '0.8rem' }}>
        © 2026 Hub Financeiro Bot. Todos os direitos reservados.
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="main" style={{ background: '#0a0c10', color: 'white' }}><div className="hero-title">Carregando...</div></div>}>
      <LandingContent />
    </Suspense>
  );
}
