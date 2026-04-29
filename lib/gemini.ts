import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function parseFinancialText(text: string) {
  const model = genAI.getGenerativeModel({ 
    model: "gemma-3n-e2b-it"
  });

  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const prompt = `Você é um classificador financeiro. 
Sua missão é extrair dados e devolver APENAS o objeto JSON puro.
NUNCA use blocos de código markdown. NUNCA explique seu raciocínio.

HOJE: ${dateBRT}. Texto: "${text}"
Retorne APENAS o JSON:
- DESPESA: {"intent": "despesa", "descricao", "valor", "data", "tipo_despesa", "metodo_pagamento", "categoria", "num_parcelas"}
- RECEITA: {"intent": "receita", "descricao", "valor", "data", "tipo_receita"}
- CONSULTA: {"intent": "consulta", "pergunta"}`;

  try {
    const result = await model.generateContent(prompt);
    let rawText = result.response.text();
    fs.appendFileSync('gemma_debug.log', `\n--- E2B RAW OUTPUT ---\n${rawText}\n------------------\n`);
    
    // Limpeza agressiva
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').replace(/`/g, '').trim();
    
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
       throw new Error("Não encontrei JSON na resposta da IA.");
    }
    
    let jsonString = rawText.substring(firstBrace, lastBrace + 1);

    try {
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < rawText.length; i++) {
        if (rawText[i] === '{') depth++;
        if (rawText[i] === '}') depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
      if (endIdx !== -1) {
        jsonString = rawText.substring(firstBrace, endIdx + 1);
      }
    } catch (e) {}
    
    let parsed = JSON.parse(jsonString);

    // Se o modelo aninhou o resultado (ex: { "DESPESA": { ... } }), nós achatamos
    if (parsed.DESPESA) parsed = parsed.DESPESA;
    if (parsed.RECEITA) parsed = parsed.RECEITA;
    if (parsed.CONSULTA) parsed = parsed.CONSULTA;
    if (parsed.despesa) parsed = parsed.despesa;
    if (parsed.receita) parsed = parsed.receita;
    if (parsed.consulta) parsed = parsed.consulta;
    
    // Normalização de tipos para evitar erros no Notion
    if (parsed.valor) parsed.valor = Number(String(parsed.valor).replace(/[^\d.]/g, ''));
    if (parsed.num_parcelas) parsed.num_parcelas = Number(parsed.num_parcelas) || 0;
    if (parsed.intent) parsed.intent = String(parsed.intent).toLowerCase();
    
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
  const model = genAI.getGenerativeModel({ 
    model: "gemma-3n-e2b-it"
  });
  
  const now = new Date();
  const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dateBRT = brNow.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: '2-digit' });

  const prompt = `Você é um consultor financeiro amigável e extremamente conciso.
Sua missão é dar uma resposta final direta ao usuário.
Regras:
- Devolva APENAS a mensagem final.
- NUNCA mostre rascunhos ou pensamentos internos.
- NUNCA use asteriscos ou negritos.
- Seja BREVE (máximo 3 frases).

Data: ${dateBRT}.
DADOS: ${JSON.stringify(currentMonthDetails || {})}
HISTÓRICO: ${balancetesData}
MOVIMENTAÇÕES: ${transacoesReport}
Pergunta do ${firstName}: "${pergunta}"

Instrução: Comece com "Oi ${firstName}! 😊" e dê um conselho breve. Devolva APENAS a resposta final.`;

  try {
    const result = await model.generateContent(prompt);
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
    let text = result.response.text();
    
    const markers = ["Final Polish:", "Final Response:", "Response:", "Rascunho:", "Draft:", "Final Message:"];
    for (const marker of markers) {
      if (text.includes(marker)) {
        text = text.split(marker).pop() || text;
      }
    }

    text = text.replace(/\*|#|_/g, '').trim(); 
    return { text, tokensUsed };
  } catch (err) {
    console.error("Erro no Gemma Advisor:", err);
    throw new Error('O Consultor não conseguiu gerar a recomendação.');
  }
}
