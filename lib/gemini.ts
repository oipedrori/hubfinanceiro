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
- CONSULTA: {"intent": "consulta", "pergunta"}

REGRAS DE INTENÇÃO:
- Se o usuário perguntar algo (ex: "Quanto gastei...", "Como está meu saldo?"), use "intent": "consulta".
- NUNCA use "despesa" para perguntas. Use "despesa" apenas para lançamentos novos.

REGRAS PARA RECEITA:
- Use APENAS: "Salário", "Empréstimo", "Reembolso" ou "Freela".

REGRAS PARA CATEGORIA:
- Use APENAS: Alimentação, Comunicação, Doação, Educação, Equipamentos, Impostos, Investimentos, Lazer, Moradia, Pet, Saúde, Seguro, Transporte, Vestuário, Higiene Pessoal, Outros.

REGRAS PARA MÉTODO DE PAGAMENTO:
- Use APENAS: Crédito, Pix, Débito, Dinheiro, Transferência.
- VALOR PADRÃO: Se o usuário não mencionar, use "Crédito".

REGRAS PARA TIPO DE DESPESA:
- "Recorrente": Quando o usuário diz que gasta "todo mês", "sempre", ou é uma conta fixa (ex: luz, aluguel).
- "Parcelada": Quando o usuário menciona parcelas (ex: "em 3x", "4 vezes"). O campo "num_parcelas" deve capturar o número total.
- "Móvel": Gastos eventuais do dia a dia.
- Use APENAS: "Móvel", "Recorrente" ou "Parcelada". PROIBIDO usar qualquer outro valor.`;

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
    if (parsed.valor) {
      const v = Number(String(parsed.valor).replace(/[^\d.]/g, ''));
      parsed.valor = Number(v.toFixed(2));
    }
    if (parsed.num_parcelas) parsed.num_parcelas = Number(parsed.num_parcelas) || 0;
    if (parsed.intent) parsed.intent = String(parsed.intent).toLowerCase();
    
    // Forçar Tipo de Despesa fixo: Móvel, Recorrente ou Parcelada
    const allowedTiposDespesa = ['Móvel', 'Recorrente', 'Parcelada'];
    if (parsed.intent === 'despesa') {
      if (!parsed.tipo_despesa || !allowedTiposDespesa.includes(parsed.tipo_despesa)) {
        if (String(parsed.tipo_despesa).toLowerCase().includes('parcel') || (parsed.num_parcelas && parsed.num_parcelas > 1)) parsed.tipo_despesa = 'Parcelada';
        else if (String(parsed.tipo_despesa).toLowerCase().includes('recorr') || String(parsed.tipo_despesa).toLowerCase().includes('fixa')) parsed.tipo_despesa = 'Recorrente';
        else parsed.tipo_despesa = 'Móvel';
      }
    }

    // Forçar Tipo de Receita fixo: Salário, Empréstimo, Reembolso ou Freela
    const allowedTiposReceita = ['Salário', 'Empréstimo', 'Reembolso', 'Freela'];
    if (parsed.intent === 'receita') {
      if (!parsed.tipo_receita || !allowedTiposReceita.includes(parsed.tipo_receita)) {
        const tr = String(parsed.tipo_receita).toLowerCase();
        if (tr.includes('salário') || tr.includes('pagamento') || tr.includes('empresa')) parsed.tipo_receita = 'Salário';
        else if (tr.includes('emprest') || tr.includes('banco')) parsed.tipo_receita = 'Empréstimo';
        else if (tr.includes('reembolso') || tr.includes('devolu')) parsed.tipo_receita = 'Reembolso';
        else if (tr.includes('freela') || tr.includes('extra') || tr.includes('serviço')) parsed.tipo_receita = 'Freela';
        else parsed.tipo_receita = 'Freela';
      }
    }

    // Forçar Categorias fixas
    const allowedCategorias = [
      'Alimentação', 'Comunicação', 'Doação', 'Educação', 'Equipamentos', 
      'Impostos', 'Investimentos', 'Lazer', 'Moradia', 'Pet', 
      'Saúde', 'Seguro', 'Transporte', 'Vestuário', 'Higiene Pessoal', 'Outros'
    ];
    if (parsed.intent === 'despesa') {
      if (!parsed.categoria || !allowedCategorias.includes(parsed.categoria)) {
        const cat = String(parsed.categoria).toLowerCase();
        if (cat.includes('mercado') || cat.includes('comer') || cat.includes('restaurante')) parsed.categoria = 'Alimentação';
        else if (cat.includes('uber') || cat.includes('carro') || cat.includes('gasolina') || cat.includes('ônibus')) parsed.categoria = 'Transporte';
        else if (cat.includes('aluguel') || cat.includes('luz') || cat.includes('água') || cat.includes('condomínio')) parsed.categoria = 'Moradia';
        else if (cat.includes('médico') || cat.includes('farmácia') || cat.includes('remédio')) parsed.categoria = 'Saúde';
        else if (cat.includes('cinema') || cat.includes('viagem') || cat.includes('show')) parsed.categoria = 'Lazer';
        else if (cat.includes('internet') || cat.includes('celular') || cat.includes('telefone')) parsed.categoria = 'Comunicação';
        else if (cat.includes('roupa') || cat.includes('sapato')) parsed.categoria = 'Vestuário';
        else parsed.categoria = 'Outros';
      }
    }

    // Forçar título curto e limpo
    if (parsed.descricao) {
      let d = parsed.descricao.replace(/^(Compra|Gasto|Pagamento|Gastei|Recebi|Vendi|Paguei)\s(no|na|de|com|o|a)\s/i, '');
      d = d.split(' ').slice(0, 2).join(' ');
      parsed.descricao = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
    }

    // Forçar Método de Pagamento fixo: Crédito, Pix, Débito, Dinheiro, Transferência
    const allowedMetodos = ['Crédito', 'Pix', 'Débito', 'Dinheiro', 'Transferência'];
    if (parsed.intent === 'despesa') {
      if (!parsed.metodo_pagamento || !allowedMetodos.includes(parsed.metodo_pagamento)) {
        const mp = String(parsed.metodo_pagamento || '').toLowerCase();
        if (mp.includes('pix')) parsed.metodo_pagamento = 'Pix';
        else if (mp.includes('débito')) parsed.metodo_pagamento = 'Débito';
        else if (mp.includes('dinheiro') || mp.includes('espécie')) parsed.metodo_pagamento = 'Dinheiro';
        else if (mp.includes('transf') || mp.includes('ted') || mp.includes('doc')) parsed.metodo_pagamento = 'Transferência';
        else if (mp.includes('crédito') || mp.includes('cartão')) parsed.metodo_pagamento = 'Crédito';
        else parsed.metodo_pagamento = 'Crédito'; // Valor padrão
      }
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
Sua missão é dar uma análise REAL e DIRETA das finanças do usuário.

REGRAS DE RESPOSTA:
- Se o usuário perguntar "Quanto gastei com [categoria/item]", analise as MOVIMENTAÇÕES DETALHADAS e dê o VALOR TOTAL somado.
- NUNCA liste todas as transações uma por uma, a menos que o usuário peça explicitamente. Foque no resumo e no total.
- VALORES MONETÁRIOS: Use sempre o formato "R$ XX,XX" e ARREDONDE para exatamente duas casas decimais (centavos).
- Use EXATAMENTE 2 parágrafos pequenos (máximo 3 linhas cada).
- Deve caber na tela de um celular sem que o usuário precise rolar muito.
- Seja amigável, comece com "Oi ${firstName}! 😊" e use emojis.
- PROIBIDO usar asteriscos (*) ou negritos (**).
- Devolva APENAS a resposta final.

CONTEXTO:
Data: ${dateBRT}.
STATUS ATUAL: ${JSON.stringify(currentMonthDetails || {})}
HISTÓRICO MENSAL: ${balancetesData}
MOVIMENTAÇÕES DETALHADAS:
${transacoesReport}

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
