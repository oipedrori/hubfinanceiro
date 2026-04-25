'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function VoiceBotPage() {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Toque no círculo para falar');
  const [transcription, setTranscription] = useState('');
  const [response, setResponse] = useState('');
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Carregar chave do localStorage
    const savedKey = localStorage.getItem('zimbroo_secret_key');
    setSecretKey(savedKey);

    // Inicializar Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscription(text);
        processVoice(text);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Erro no reconhecimento:', event.error);
        setStatus('Erro ao ouvir. Tente novamente.');
        setIsListening(false);
      };
    } else {
      setStatus('Seu navegador não suporta reconhecimento de voz.');
    }
  }, []);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setTranscription(textInput);
    processVoice(textInput);
    setTextInput('');
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    
    setTranscription('');
    setResponse('');
    setIsListening(true);
    setStatus('Ouvindo...');
    recognitionRef.current.start();
  };

  const processVoice = async (text: string) => {
    if (!secretKey) {
      setStatus('Erro: Você precisa conectar seu Notion na página principal primeiro!');
      return;
    }

    setStatus('Processando...');
    
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey, text })
      });

      const data = await res.json();
      
      if (data.success) {
        setResponse(data.message);
        setStatus('Respondendo...');
        speak(data.message);
      } else {
        setStatus(`Erro: ${data.error}`);
      }
    } catch (err) {
      setStatus('Erro de conexão com o servidor.');
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setStatus('Pronto! Toque para falar de novo.');
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="main" style={{ justifyContent: 'space-between', padding: '3rem 2rem' }}>
      <div style={{ textAlign: 'center', width: '100%' }}>
         <h1 className="hero-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Hub Financeiro Bot</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
        <div 
          onClick={!isListening ? startListening : undefined}
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: isListening ? 'var(--primary)' : 'transparent',
            border: `4px solid ${isListening ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.4s ease',
            boxShadow: 'none'
          }}
        >
          <div style={{ 
            width: isListening ? '40px' : '60px', 
            height: isListening ? '40px' : '60px', 
            background: isListening ? '#fff' : 'var(--primary)',
            borderRadius: isListening ? '8px' : '50%',
            transition: 'all 0.3s ease'
          }}></div>
        </div>

        <div style={{ textAlign: 'center', minHeight: '80px' }}>
          <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>{status}</p>
          <p style={{ color: '#666666', fontStyle: 'italic', fontSize: '0.95rem' }}>
            {transcription && `"${transcription}"`}
          </p>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {response && (
          <div className="animate-fade" style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            <p style={{ fontSize: '1rem', lineHeight: '1.5' }}>{response}</p>
          </div>
        )}
        
        <form onSubmit={handleTextSubmit} style={{ marginBottom: '2rem', display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ou digite seu gasto aqui..." 
            style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: '1rem', outline: 'none' }}
          />
          <button type="submit" style={{ background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>
            Enviar
          </button>
        </form>

        <Link href="/" style={{ color: '#888888', fontSize: '0.9rem', display: 'block', textAlign: 'center' }}>
          Voltar para Home
        </Link>
      </div>
    </main>
  );
}
