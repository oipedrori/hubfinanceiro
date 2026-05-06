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
    model: "gemma-4-26b-a4b-it"
  });

  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const prompt = `Você é um robô classificador financeiro. Sua saída deve conter APENAS um objeto JSON puro.

HOJE: ${dateBRT}. Texto do usuário: "${text}"

EXEMPLOS:
- "Gastei 20 no cafe": {"intent": "despesa", "itens": [{"descricao": "Cafe", "valor": 20}]}
- "Gastei 10 no pao e 50 na gasolina": {"intent": "despesa", "itens": [{"descricao": "Pao", "valor": 10}, {"descricao": "Gasolina", "valor": 50}]}
- "Quanto gastei este mes?": {"intent": "consulta", "pergunta": "Quanto gastei este mes?"}
- "Posso comprar um fone de 200?": {"intent": "decisao_compra", "descricao_item": "fone", "valor_item": 200}

REGRAS DE INTENÇÃO (CRÍTICO):
- Gastos, pagamentos ou compras: use "intent": "despesa".
- Entradas de dinheiro ou recebimentos: use "intent": "receita".
- Perguntas sobre o mês, saldo ou resumo: use "intent": "consulta".
- Perguntas sobre poder comprar algo: use "intent": "decisao_compra".

REGRAS PARA ITENS:
- "descricao": O que foi comprado ou pago (ex: Pao, Uber, Aluguel).
- "valor": O valor numérico (ex: 15.50).
- "categoria": Tente adivinhar (Alimentação, Transporte, Moradia, Lazer, Saúde, Vestuário, Outros). Se não souber, use "Outros".
- "metodo_pagamento": Crédito, Pix, Débito, Dinheiro. Se não souber, use "Crédito".`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    
    let parsed = extractFirstJSON(rawText);
    
    if (!parsed) {
      console.error("Falha ao extrair JSON da IA. Raw:", rawText);
      throw new Error("Não encontrei JSON válido na resposta da IA.");
    }

    // Se a IA retornar algo como {"DESPESA": {...}}, extraímos o conteúdo e salvamos a chave como intenção
    const topLevelKey = Object.keys(parsed).find(k => 
      ["DESPESA", "RECEITA", "CONSULTA", "DELETAR", "DECISAO", "despesa", "receita", "consulta", "deletar_ultimo", "decisao_compra"].includes(k)
    );
    
    if (topLevelKey) {
      const intentFromKey = topLevelKey.toLowerCase().replace("decisao", "decisao_compra").replace("deletar", "deletar_ultimo");
      const content = parsed[topLevelKey];
      parsed = { ...content, intent: parsed.intent || intentFromKey };
    }

    if (parsed.error) return parsed;
    if (parsed.intent) parsed.intent = String(parsed.intent).toLowerCase();

    // Normalização para itens múltiplos ou item único (legado)
    const normalizeItem = (item: any, intent: string) => {
      // Data default
      if (!item.data) item.data = dateBRT;

      // Valor
      if (item.valor) {
        const v = Number(String(item.valor).replace(/[^\d.]/g, ''));
        item.valor = Number(v.toFixed(2));
      }
      if (item.num_parcelas) item.num_parcelas = Number(item.num_parcelas) || 0;

      // Descrição curta
      if (item.descricao) {
        let d = item.descricao.replace(/^(Compra|Gasto|Pagamento|Gastei|Recebi|Vendi|Paguei)\s(no|na|de|com|o|a)\s/i, '');
        d = d.split(' ').slice(0, 2).join(' ');
        item.descricao = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
      }

      // Tipo de Despesa
      const allowedTiposDespesa = ['Móvel', 'Recorrente', 'Parcelada'];
      if (intent === 'despesa') {
        if (!item.tipo_despesa || !allowedTiposDespesa.includes(item.tipo_despesa)) {
          const td = String(item.tipo_despesa || '').toLowerCase();
          if (td.includes('parcel') || (item.num_parcelas && item.num_parcelas > 1)) item.tipo_despesa = 'Parcelada';
          else if (td.includes('recorr') || td.includes('fixa')) item.tipo_despesa = 'Recorrente';
          else item.tipo_despesa = 'Móvel';
        }
      }

      // Tipo de Receita
      const allowedTiposReceita = ['Salário', 'Empréstimo', 'Reembolso', 'Freela'];
      if (intent === 'receita') {
        if (!item.tipo_receita || !allowedTiposReceita.includes(item.tipo_receita)) {
          const tr = String(item.tipo_receita || '').toLowerCase();
          if (tr.includes('salário') || tr.includes('pagamento') || tr.includes('empresa')) item.tipo_receita = 'Salário';
          else if (tr.includes('emprest') || tr.includes('banco')) item.tipo_receita = 'Empréstimo';
          else if (tr.includes('reembolso') || tr.includes('devolu')) item.tipo_receita = 'Reembolso';
          else item.tipo_receita = 'Freela';
        }
      }

      // Categoria
      const allowedCategorias = ['Alimentação', 'Comunicação', 'Doação', 'Educação', 'Equipamentos', 'Impostos', 'Investimentos', 'Lazer', 'Moradia', 'Pet', 'Saúde', 'Seguro', 'Transporte', 'Vestuário', 'Higiene Pessoal', 'Outros'];
      if (intent === 'despesa') {
        if (!item.categoria || !allowedCategorias.includes(item.categoria)) {
          const cat = String(item.categoria || '').toLowerCase();
          if (cat.includes('mercado') || cat.includes('comer') || cat.includes('restaurante') || cat.includes('lanche') || cat.includes('comida')) item.categoria = 'Alimentação';
          else if (cat.includes('uber') || cat.includes('carro') || cat.includes('gasolina') || cat.includes('ônibus') || cat.includes('transporte')) item.categoria = 'Transporte';
          else if (cat.includes('aluguel') || cat.includes('luz') || cat.includes('água') || cat.includes('condomínio') || cat.includes('energia')) item.categoria = 'Moradia';
          else if (cat.includes('médico') || cat.includes('farmácia') || cat.includes('remédio')) item.categoria = 'Saúde';
          else if (cat.includes('cinema') || cat.includes('viagem') || cat.includes('show') || cat.includes('rolê')) item.categoria = 'Lazer';
          else if (cat.includes('internet') || cat.includes('celular') || cat.includes('telefone')) item.categoria = 'Comunicação';
          else if (cat.includes('roupa') || cat.includes('sapato')) item.categoria = 'Vestuário';
          else item.categoria = 'Outros';
        }
      }

      // Método de Pagamento
      const allowedMetodos = ['Crédito', 'Pix', 'Débito', 'Dinheiro', 'Transferência'];
      if (intent === 'despesa') {
        if (!item.metodo_pagamento || !allowedMetodos.includes(item.metodo_pagamento)) {
          const mp = String(item.metodo_pagamento || '').toLowerCase();
          if (mp.includes('pix')) item.metodo_pagamento = 'Pix';
          else if (mp.includes('débito')) item.metodo_pagamento = 'Débito';
          else if (mp.includes('dinheiro') || mp.includes('espécie')) item.metodo_pagamento = 'Dinheiro';
          else if (mp.includes('transf') || mp.includes('ted') || mp.includes('doc')) item.metodo_pagamento = 'Transferência';
          else item.metodo_pagamento = 'Crédito';
        }
      }
      return item;
    };

    if (parsed.itens && Array.isArray(parsed.itens)) {
      parsed.itens = parsed.itens.map((i: any) => normalizeItem(i, parsed.intent));
    } else if (parsed.descricao || parsed.valor) {
      // Suporte a formato antigo se o E2B falhar no array
      const normalized = normalizeItem(parsed, parsed.intent);
      parsed.itens = [normalized];
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
  const model = genAI.getGenerativeModel({ model: "gemma-4-26b-a4b-it" });
  
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
- A resposta deve ser concisa para mobile (máximo 4 parágrafos pequenos), mas rica em detalhes.
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
