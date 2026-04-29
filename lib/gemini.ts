import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

/**
 * Tenta extrair o primeiro objeto JSON válido de uma string ruidosa.
 */
function extractFirstJSON(text: string): any {
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').replace(/`/g, '').trim();
  
  const firstBrace = cleanText.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  for (let i = firstBrace; i < cleanText.length; i++) {
    if (cleanText[i] === '{') depth++;
    if (cleanText[i] === '}') depth--;
    if (depth === 0) {
      const candidate = cleanText.substring(firstBrace, i + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        continue;
      }
    }
  }
  
  try {
    const lastBrace = cleanText.lastIndexOf('}');
    return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
  } catch (e) {
    return null;
  }
}

export async function parseFinancialText(text: string) {
  const model = genAI.getGenerativeModel({ 
    model: "gemma-3n-e2b-it"
  });

  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const prompt = `Você é um robô classificador financeiro. 
Sua saída deve conter APENAS um objeto JSON puro.

REGRAS PARA A DESCRIÇÃO:
- A "descricao" deve ser um título PADRONIZADO, curto e com a primeira letra maiúscula (ex: "Mercado", "Gasolina", "Aluguel", "Academia").
- NUNCA use frases como "Compra no...", "Gastei com...", "Pagamento de...".
- Use no máximo 2 palavras.

HOJE: ${dateBRT}. Texto do usuário: "${text}"

Retorne o JSON:
- DESPESA: {"intent": "despesa", "descricao", "valor", "data", "tipo_despesa", "metodo_pagamento", "categoria", "num_parcelas"}
- RECEITA: {"intent": "receita", "descricao", "valor", "data", "tipo_receita"}
- CONSULTA: {"intent": "consulta", "pergunta"}`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    
    let parsed = extractFirstJSON(rawText);
    
    if (!parsed) {
      console.error("Falha ao extrair JSON do E2B. Raw:", rawText);
      throw new Error("Não encontrei JSON válido na resposta da IA.");
    }

    const topLevelKey = Object.keys(parsed).find(k => ["DESPESA", "RECEITA", "CONSULTA", "despesa", "receita", "consulta"].includes(k));
    if (topLevelKey) parsed = parsed[topLevelKey];

    // Normalização de tipos e limpeza de descrição
    if (parsed.valor) parsed.valor = Number(String(parsed.valor).replace(/[^\d.]/g, ''));
    if (parsed.num_parcelas) parsed.num_parcelas = Number(parsed.num_parcelas) || 0;
    if (parsed.intent) parsed.intent = String(parsed.intent).toLowerCase();
    
    // Forçar título curto e limpo se a IA falhar
    if (parsed.descricao) {
      let d = parsed.descricao.replace(/^(Compra|Gasto|Pagamento|Gastei|Recebi|Vendi)\s(no|na|de|com|o|a)\s/i, '');
      d = d.split(' ').slice(0, 2).join(' ');
      parsed.descricao = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
    }
    
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
    return { ...parsed, _tokensUsed: tokensUsed };
  } catch (err) {
    console.error("Erro no Gemma Classifier:", err);
    throw new Error('Falha na classificação da IA.');
  }
}

export async function generateFinancialAdvice(
  pergunta: string, 
  balancetesData: string, 
  transacoesReport: string, 
  firstName: string,
  currentMonthDetails?: { entradas: number, saidas: number, resultado: number } | null
) {
  const model = genAI.getGenerativeModel({ model: "gemma-3n-e2b-it" });
  
  const now = new Date();
  const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dateBRT = brNow.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: '2-digit' });

  const prompt = `Você é o Consultor Financeiro Estratégico do Hub Financeiro.
Sua missão é dar uma análise REAL e PROFUNDA das finanças do usuário.

REGRAS DE RESPOSTA:
- Use de 2 a 3 parágrafos curtos.
- Seja específico e traga insights baseados nos dados.
- Use emojis para tornar a leitura amigável.
- PROIBIDO usar asteriscos (*) ou negritos (**).
- Comece com "Oi ${firstName}! 😊".
- Devolva APENAS a resposta final.

CONTEXTO:
Data: ${dateBRT}.
STATUS ATUAL: ${JSON.stringify(currentMonthDetails || {})}
HISTÓRICO MENSAL: ${balancetesData}
MOVIMENTAÇÕES DETALHADAS: ${transacoesReport}

Pergunta do Usuário: "${pergunta}"`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    const markers = ["Final Polish:", "Final Response:", "Response:", "Rascunho:", "Draft:", "Final Message:"];
    for (const marker of markers) {
      if (text.includes(marker)) text = text.split(marker).pop() || text;
    }

    text = text.replace(/\*|#|_/g, '').trim(); 
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
    return { text, tokensUsed };
  } catch (err) {
    console.error("Erro no Gemma Advisor:", err);
    throw new Error('O Consultor não conseguiu gerar a recomendação.');
  }
}
