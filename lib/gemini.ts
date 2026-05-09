import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
  // Chamada de listModels (aquecimento da rota / validação)
  await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + process.env.GEMINI_API_KEY).catch(() => {});

  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const systemInstruction = `Atue como MASTER_FINANCIAL_PROCESSOR. Extraia dados de movimentações financeiras de transcrições de voz.
DATA_REF: ${dateBRT} (Use como âncora absoluta).

INSTRUÇÃO DE INTELIGÊNCIA TEMPORAL:
- Se o usuário mencionar "ontem", "anteontem", "semana passada" ou dias da semana ("na segunda"), calcule a data exata no formato YYYY-MM-DD.
- Se nenhuma data for dita, use a data da DATA_REF.

LÓGICA DE ROTEAMENTO (INTENT):
DESPESA: Quando o usuário informa um novo gasto (Gatilhos: comprei, paguei, lanche, mercado, pix enviado). use db_id = "ID_DESPESAS".
RECEITA: Quando o usuário informa um novo ganho (Gatilhos: recebi, ganhei, caiu, salário, pix recebido). use db_id = "ID_RECEITAS".

CAMINHO 1: REGISTRO DE DESPESA
- Categorias: Alimentação, Comunicação, Doações, Educação, Equipamentos, Impostos, Investimento, Lazer, Moradia, Pet, Saúde, Seguro, Transporte, Vestuário.
- Parcelas: Procure por "X vezes", "X parcelas", "X x" ou "em X". Extraia o número X. Se não houver, use 1.
- Tipo: Se Parcelas > 1 "Parcelada", senão "Móvel".
- Pagamento: Se não citado, assuma "Crédito".

CAMINHO 2: REGISTRO DE RECEITA
- Categorias: Salário, Freela, Reembolso, Empréstimo.
- Descrição: Sintética (Ex: "Cliente X" em vez de "Recebi do cliente X").

Preencha o objeto conforme o esquema JSON estrito. Proibido campos nulos ou vazios. Use deduções acima.`;

  const model = genAI.getGenerativeModel({ 
    model: "models/gemma-4-26b-a4b-it",
    systemInstruction,
    generationConfig: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          intent: { type: SchemaType.STRING },
          db_id: { type: SchemaType.STRING },
          dados: {
            type: SchemaType.OBJECT,
            properties: {
              descricao: { type: SchemaType.STRING },
              valor: { type: SchemaType.NUMBER },
              data: { type: SchemaType.STRING },
              categoria: { type: SchemaType.STRING },
              pagamento: { type: SchemaType.STRING },
              tipo: { type: SchemaType.STRING },
              parcelas: { type: SchemaType.NUMBER }
            },
            required: ["descricao", "valor", "data", "categoria"]
          }
        },
        required: ["intent", "db_id", "dados"]
      },
      temperature: 0.1,
      topP: 1
    }
  });

  try {
    const result = await model.generateContentStream(text);
    let rawText = '';
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      rawText += chunkText;
      process.stdout.write(chunkText);
    }
    
    const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    
    // Adapta para o formato esperado pelo Zimbroo (intent e array de itens)
    return {
      intent: String(parsed.intent).toLowerCase(),
      itens: [{
        ...parsed.dados,
        // Garante que campos opcionais tenham fallback para não quebrar o fluxo do Notion
        metodo_pagamento: parsed.dados.pagamento || "Crédito",
        tipo_despesa: parsed.dados.tipo || "Móvel",
        num_parcelas: parsed.dados.parcelas || 1
      }],
      _tokensUsed: (await result.response).usageMetadata?.totalTokenCount || 0
    };
  } catch (err) {
    console.error("Erro no Gemma Fast Classifier:", err);
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
  const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-lite" });
  
  const now = new Date();
  const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dateBRT = brNow.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: '2-digit' });

  const prompt = `Você é o Consultor Financeiro Estratégico do Hub Financeiro. Sua missão é dar uma análise REAL, DETALHADA e ESPECÍFICA das finanças do usuário.

REGRAS DE RESPOSTA:
- Use obrigatoriamente as MOVIMENTAÇÕES DETALHADAS abaixo para dar exemplos reais e específicos. Cite nomes de itens e categorias.
- "TERMÔMETRO FINANCEIRO" (Burn Rate): Em qualquer consulta sobre resumo ou situação, você DEVE analisar se o ritmo de gastos está adequado para o dia ${now.getDate()} do mês. Compare o total gasto vs o tempo decorrido.
- "CONSELHEIRO DE COMPRA": Se a intenção for "decisao_compra", avalie se o usuário pode gastar o valor solicitado baseado no saldo atual e na projeção de gastos. Dê uma recomendação clara (Sim/Não/Cuidado) e justifique com os dados.
- Se o usuário perguntar sobre um gasto específico, procure-o na lista e informe o valor exato e a categoria.
- VALORES MONETÁRIOS: Use sempre o formato "R$ XX,XX" e arredonde para duas casas decimais.
- OBRIGATÓRIO: Sua resposta final DEVE conter EXATAMENTE 3 parágrafos curtos. Não escreva mais nem menos. Seja direto.
- Seja amigável, comece com "Oi ${firstName}! 😊" e use emojis.
- PROIBIDO usar asteriscos (*) ou negritos (**).
- Devolva APENAS a resposta final.

CONTEXTO:
Data: ${dateBRT} (Dia ${now.getDate()}).
STATUS ATUAL: ${JSON.stringify(currentMonthDetails || {})}
HISTÓRICO MENSAL: ${balancetesData}
MOVIMENTAÇÕES DETALHADAS (Use isso para ser específico):
${transacoesReport}

Pergunta/Ação do Usuário: "${pergunta}"`;

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
