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
    if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) {
      setPlatform('ios');
    } else if (/Android/i.test(ua)) {
      setPlatform('android');
    }

    // Salvar chave no localStorage se ela existir na URL
    if (secretKey) {
      localStorage.setItem('zimbroo_secret_key', secretKey);
      console.log('Chave Zimbroo salva localmente.');
    }
  }, [secretKey]);

  const clientId = '31ed872b-594c-81a0-8494-0037918ae6cc';
  // ... rest of logic
  const redirectUri = 'https://hubfinanceirobot.vercel.app/api/auth/callback/notion';
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return (
    <main className="main">
      <div className="bg-glow"></div>
      
      <div className="glass-card animate-fade">
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(49, 130, 206, 0.1)', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Hub Financeiro Bot</span>
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'left' }}>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>Pronto, <span>{name}</span>!</h1>
            <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
              Seu Notion foi conectado com sucesso. {platform === 'ios' ? 'Agora você já pode configurar seu iPhone.' : 'Agora ficou fácil usar no seu Android.'}
            </p>
            
            <div className="success-box">
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>SUA CHAVE SECRETA ZIMBROO:</p>
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
                <a href="https://www.icloud.com/shortcuts/f76389ba24984b9caba892875da8e1c3" target="_blank" className="btn-primary">
                  Baixar Atalho do iOS
                </a>
              ) : (
                <a href="/bot" className="btn-primary">
                  Usar Web App (Modo Voz)
                </a>
              )}
              
              <button 
                onClick={() => window.location.href = '/'}
                style={{ background: 'none', border: '1px solid var(--border)', color: '#94a3b8', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' }}
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
                Conectar meu Notion
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
