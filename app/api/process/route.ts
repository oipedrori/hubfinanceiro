import { NextResponse } from 'next/server';
import { getCustomerBySecretKey, updateCustomerDbIds, logTokenUsage } from '@/lib/notionAdmin';
import { parseFinancialText, generateFinancialAdvice } from '@/lib/gemini';
import { addTransactionToClientNotion, getBalancetesData, getCurrentMonthTransactions } from '@/lib/notionClient';

// ── Detector de SALDO: resposta fixa sem IA ──
function isSaldoQuery(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const saldoPatterns = [
    /meu\s+saldo/,
    /meu\s+balancete/,
    /meu\s+balanco/,
    /como\s+(esta|ta|anda)\s+(meu\s+)?(saldo|balancete|balanco)/,
    /qual\s+(e\s+)?(meu|o)\s+(saldo|balancete|balanco)/,
    /saldo\s+(atual|do\s+mes)/,
    /balancete\s+(atual|do\s+mes)/,
  ];
  return saldoPatterns.some(p => p.test(lower));
}

// ── Pré-classificador local: detecta consultas SEM gastar tokens ──
// Conservador por design: só retorna true quando é claramente uma pergunta.
// Se tiver dúvida, retorna false e o Gemini classifica normalmente.
function isLikelyConsulta(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Padrões fortes de consulta financeira (saldo/balancete tratados separadamente)
  const consultaPatterns = [
    /como\s+(estao|esta|ta|anda|andam|vao)/,
    /quanto\s+(gastei|ganhei|sobrou|falta|tenho|devo)/,
    /me\s+(da|de|faz)\s+(um|uma)\s+(resumo|conselho|dica|analise)/,
    /minhas?\s+(situacao|financas|financ|contas?)/,
    /meus?\s+(gastos?|financ)/,
    /(conselho|dica|sugestao|recomendacao)\s*(financ)?/,
    /(resumo|analise|relatorio)\s+(financ|do\s+mes|mensal)/,
    /estou\s+(gastando|economizando|devendo|perdendo|ganhando)/,
    /posso\s+(gastar|economizar|investir)/,
    /como\s+(economizar|investir|melhorar|reduzir|organizar)/,
    /o\s+que\s+(voce\s+)?acha/,
    /fechamento\s+do\s+mes/,
    /como\s+(anda|vai)\s+meu/,
  ];

  if (consultaPatterns.some(p => p.test(lower))) return true;

  // Texto com "?" e SEM valores monetários → provavelmente uma pergunta
  if (lower.includes('?')) {
    const hasMoneyValue = /\d+[\.,]?\d*\s*(reais|real|conto|mil)|\br?\$\s*\d/i.test(lower);
    if (!hasMoneyValue) return true;
  }

  return false;
}

// Esta é a porta de entrada. Quando o iOS mandar o áudio, ele vai bater nesta URL usando o método POST
export async function POST(request: Request) {
  try {
    // 1. Abrimos a "carta" (JSON) que o celular enviou
    const body = await request.json();
    const { secretKey, text } = body;

    // Verificações de segurança básicas
    if (!secretKey) return NextResponse.json({ error: 'Falta a Chave do Hub Financeiro (Acesso Negado)' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'Nenhum texto enviado para processamento.' }, { status: 400 });

    // 2. Batemos na sua Tabela Mestre do Notion para checar quem é a pessoa
    const customer = await getCustomerBySecretKey(secretKey);

    if (!customer) {
      return NextResponse.json({ error: 'Chave não encontrada na Base Mestra do Hub Financeiro.' }, { status: 401 });
    }

    // Se estiver desativado no Checkbox...
    if (customer.status === 'blocked') {
      return NextResponse.json({ error: 'Assinatura inativa ou bloqueada no sistema.' }, { status: 403 });
    }

    // 3. O cliente é válido e ativo! 
    const { 
      name, notionAccessToken, workspaceId, 
      despesasDbId, receitasDbId, balancetesDbId, pageId 
    } = customer.data!;
    
    if (!notionAccessToken || !workspaceId) {
       return NextResponse.json({ error: 'O cadastro do cliente está incompleto (Falta URL ou Token Notion).' }, { status: 400 });
    }

    console.log(`📡 Processando áudio do cliente: ${name}`);
    const firstName = name.split(' ')[0];

    // Acumulador de tokens consumidos nesta requisição
    let totalTokens = 0;

    // ── COMANDO DE SALDO: resposta instantânea sem IA ──
    if (isSaldoQuery(text)) {
      console.log(`📊 Comando de saldo detectado para ${name}. Sem IA.`);
      
      const transacoesResult = await getCurrentMonthTransactions(notionAccessToken, despesasDbId, receitasDbId);
      
      // Cacheia IDs descobertos (fire-and-forget)
      if (pageId) {
        const idsToCache: any = {};
        if (transacoesResult.newDespesasDbId) idsToCache.despesasDbId = transacoesResult.newDespesasDbId;
        if (transacoesResult.newReceitasDbId) idsToCache.receitasDbId = transacoesResult.newReceitasDbId;
        if (Object.keys(idsToCache).length > 0) updateCustomerDbIds(pageId, idsToCache);
      }

      const receitas = transacoesResult.totalReceitas;
      const despesas = transacoesResult.totalDespesas;
      const saldo = receitas - despesas;
      const pctGasto = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;

      const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

      const message = `Oi, ${firstName}! 📋\n\n🟢 Receitas: ${fmt(receitas)}\n🔴 Despesas: ${fmt(despesas)}\n💰 Saldo: ${fmt(saldo)}\n\n📊 ${pctGasto}% da receita já foi gasto`;

      // Registra 0 tokens (não usou IA)
      if (pageId) logTokenUsage(pageId, 0);

      return NextResponse.json({ success: true, message }, { status: 200 });
    }

    // ── ATALHO: Pré-classificação local para consultas ──
    // Se o texto parece claramente uma pergunta, pulamos direto pro conselheiro (1 chamada ao invés de 2)
    if (isLikelyConsulta(text)) {
      console.log(`⚡ Atalho ativado: texto detectado como consulta localmente. Pulando classificação.`);
      
      // Busca balancetes E movimentações do mês em paralelo
      const [balancetesResult, transacoesResult] = await Promise.all([
        getBalancetesData(notionAccessToken, balancetesDbId),
        getCurrentMonthTransactions(notionAccessToken, despesasDbId, receitasDbId)
      ]);
      
      // Cacheia IDs descobertos (fire-and-forget)
      if (pageId) {
        const idsToCache: any = {};
        if (balancetesResult.newDbId) idsToCache.balancetesDbId = balancetesResult.newDbId;
        if (transacoesResult.newDespesasDbId) idsToCache.despesasDbId = transacoesResult.newDespesasDbId;
        if (transacoesResult.newReceitasDbId) idsToCache.receitasDbId = transacoesResult.newReceitasDbId;
        if (Object.keys(idsToCache).length > 0) updateCustomerDbIds(pageId, idsToCache);
      }

      const adviceResult = await generateFinancialAdvice(text, balancetesResult.data, transacoesResult.report, firstName);
      totalTokens += adviceResult.tokensUsed || 0;

      console.log('💬 Resposta do Consultor gerada com sucesso (via atalho).');
      if (pageId) logTokenUsage(pageId, totalTokens);

      return NextResponse.json({ success: true, message: adviceResult.text }, { status: 200 });
    }

    // ── FLUXO NORMAL: Gemini classifica o texto ──
    const aiResult = await parseFinancialText(text);
    totalTokens += aiResult._tokensUsed || 0;

    // Caso o classificador detecte uma consulta que o atalho não pegou
    if (aiResult.intent === 'consulta') {
      console.log(`🤖 Consulta detectada pelo Gemini. Resgatando dados de ${name}...`);
      
      // Busca balancetes E movimentações do mês em paralelo
      const [balancetesResult, transacoesResult] = await Promise.all([
        getBalancetesData(notionAccessToken, balancetesDbId),
        getCurrentMonthTransactions(notionAccessToken, despesasDbId, receitasDbId)
      ]);
      
      if (pageId) {
        const idsToCache: any = {};
        if (balancetesResult.newDbId) idsToCache.balancetesDbId = balancetesResult.newDbId;
        if (transacoesResult.newDespesasDbId) idsToCache.despesasDbId = transacoesResult.newDespesasDbId;
        if (transacoesResult.newReceitasDbId) idsToCache.receitasDbId = transacoesResult.newReceitasDbId;
        if (Object.keys(idsToCache).length > 0) updateCustomerDbIds(pageId, idsToCache);
      }
      
      console.log('🗣️ Pedindo conselho ao Consultor (Gemini)...');
      const adviceResult = await generateFinancialAdvice(aiResult.pergunta, balancetesResult.data, transacoesResult.report, firstName);
      totalTokens += adviceResult.tokensUsed || 0;
      
      console.log('💬 Resposta do Consultor gerada com sucesso.');
      if (pageId) logTokenUsage(pageId, totalTokens);

      return NextResponse.json({ success: true, message: adviceResult.text }, { status: 200 });
    }

    console.log(`🤖 Gemini classificou como ${aiResult.intent}. Inserindo no Notion de ${name}...`);

    // 4. Entregamos os números e datas organizados para a "gaveta" privada de Despesas ou Receitas desse cliente
    const isDespesa = aiResult.intent === 'despesa';
    const cachedId = isDespesa ? despesasDbId : receitasDbId;
    
    const { newDbId } = await addTransactionToClientNotion(notionAccessToken, workspaceId, aiResult, cachedId);

    // Salva no cache se for a primeira vez
    if (newDbId && pageId) {
      if (isDespesa) await updateCustomerDbIds(pageId, { despesasDbId: newDbId });
      else await updateCustomerDbIds(pageId, { receitasDbId: newDbId });
    }

    // 5. Gerar Resposta Humanizada
    let responseMessage = "";
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aiResult.valor);

    if (aiResult.intent === 'despesa') {
      responseMessage = `✅ Tudo pronto, ${firstName}. Lançamento realizado.
\n📝 O que foi: ${aiResult.descricao}
💰 Valor: ${valorFormatado}
🏷️ Categoria: ${aiResult.categoria}
💳 Pagamento: ${aiResult.metodo_pagamento}
\nJá deixei tudo organizado no seu Notion. 🚀`;
    } else if (aiResult.intent === 'receita') {
      responseMessage = `✅ Confirmado, ${firstName}. Receita registrada.
\n💰 Entrada: ${aiResult.descricao}
📈 Valor: ${valorFormatado}
🏷️ Tipo: ${aiResult.tipo_receita}
\nSeu relatório financeiro já foi atualizado no Notion. 🚀`;
    } else {
      responseMessage = `✅ Certinho, ${firstName}. Tudo anotado por aqui.`;
    }

    // Registra tokens consumidos (fire-and-forget)
    if (pageId) logTokenUsage(pageId, totalTokens);

    return NextResponse.json({ 
      success: true, 
      message: responseMessage 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro Crítico no /api/process:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
