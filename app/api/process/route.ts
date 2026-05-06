import { NextResponse } from 'next/server';
import { getCustomerBySecretKey, updateCustomerDbIds, logTokenUsage } from '@/lib/firebaseAdmin';
import { parseFinancialText, generateFinancialAdvice } from '@/lib/gemini';
import { 
  addTransactionToClientNotion, 
  getBalancetesData, 
  getCurrentMonthTransactions, 
  deleteLastTransaction 
} from '@/lib/notionClient';

// ── Detector de SALDO: resposta fixa sem IA (Atalho rápido) ──
function isSaldoQuery(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const saldoPatterns = [
    /\bsaldo\b/,
    /\bbalancete\b/,
    /\bbalanco\b/,
    /como\s+(esta|ta|anda)\s+(meu\s+)?(saldo|balancete|balanco)/,
    /qual\s+(e\s+)?(meu|o)\s+(saldo|balancete|balanco)/,
  ];
  return saldoPatterns.some(p => p.test(lower));
}

export async function POST(request: Request) {
  try {
    const { secretKey, text } = await request.json();

    if (!secretKey || !text) {
      return NextResponse.json({ success: false, message: 'Dados insuficientes.' }, { status: 400 });
    }

    const customerRes = await getCustomerBySecretKey(secretKey);
    if (!customerRes || !customerRes.data || customerRes.status === 'blocked') {
      return NextResponse.json({ success: false, message: customerRes?.reason || 'Chave de acesso inválida ou bloqueada.' }, { status: 403 });
    }

    const { 
      notionAccessToken, 
      workspaceId, 
      name, 
      pageId,
      balancetesDbId: cachedBalancetesId,
      despesasDbId: cachedDespesasId,
      receitasDbId: cachedReceitasId
    } = customerRes.data;

    let balancetesDbId = cachedBalancetesId;
    let despesasDbId = cachedDespesasId;
    let receitasDbId = cachedReceitasId;
    let totalTokens = 0;
    const firstName = name.split(' ')[0];

    console.log(`📡 Processando comando de: ${name} -> "${text}"`);

    // 1. FLUXO DE SALDO (Atalho Zero-Token)
    if (isSaldoQuery(text)) {
      console.log(`⚡ Atalho de SALDO ativado.`);
      const { currentMonth } = await getBalancetesData(notionAccessToken, balancetesDbId);
      
      if (!currentMonth) {
        return NextResponse.json({ success: true, message: `Oi ${firstName}! Não encontrei seu balancete deste mês no Notion ainda.` });
      }

      const { entradas, saidas, resultado } = currentMonth;
      const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
      const msg = `💰 *Seu Status Atual*\n\n📈 Entradas: ${fmt(entradas)}\n📉 Saídas: ${fmt(saidas)}\n⚖️ Saldo: ${fmt(resultado)}\n\nO que mais deseja saber?`;
      return NextResponse.json({ success: true, message: msg });
    }

    // 2. CLASSIFICAÇÃO PELA IA (Todos os outros casos)
    const aiResult = await parseFinancialText(text);
    console.log('🤖 Resultado da Classificação:', JSON.stringify(aiResult, null, 2));
    totalTokens += aiResult._tokensUsed || 0;

    if (aiResult.error) {
      return NextResponse.json({ success: false, message: aiResult.error });
    }

    // CASO: DELETAR
    if (aiResult.intent === 'deletar_ultimo') {
      console.log(`🗑️ Deletando última movimentação...`);
      const delResult = await deleteLastTransaction(notionAccessToken, despesasDbId, receitasDbId);
      const valFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delResult.valor);
      const msg = `🗑️ Registro removido: ${delResult.descricao} (${valFmt}). ✅`;
      if (pageId) logTokenUsage(pageId, totalTokens);
      return NextResponse.json({ success: true, message: msg });
    }

    // CASO: CONSULTA ou DECISÃO DE COMPRA
    if (aiResult.intent === 'consulta' || aiResult.intent === 'decisao_compra') {
      const isDecisao = aiResult.intent === 'decisao_compra';
      console.log(`🤖 ${isDecisao ? 'Decisão de Compra' : 'Consulta'} detectada.`);
      
      const balancetesResult = await getBalancetesData(notionAccessToken, balancetesDbId);
      let transacoesReport = 'Sem movimentações detalhadas encontradas.';

      if (balancetesResult.currentMonth) {
        const monthInfo = balancetesResult.currentMonth as any;
        const transacoesResult = await getCurrentMonthTransactions(notionAccessToken, monthInfo.pageId, despesasDbId, receitasDbId);
        transacoesReport = transacoesResult.report;
        
        // Cacheia IDs se foram descobertos agora
        if (pageId) {
          const idsToCache: any = {};
          if (balancetesResult.newDbId) idsToCache.balancetesId = balancetesResult.newDbId;
          if (transacoesResult.newDespesasDbId) idsToCache.despesasId = transacoesResult.newDespesasDbId;
          if (transacoesResult.newReceitasDbId) idsToCache.receitasId = transacoesResult.newReceitasDbId;
          if (Object.keys(idsToCache).length > 0) updateCustomerDbIds(pageId, idsToCache);
        }
      }
      
      const pergunta = isDecisao 
        ? `Posso comprar ${aiResult.descricao_item} por R$${aiResult.valor_item}?`
        : (aiResult.pergunta || text);

      console.log('🗣️ Gerando conselho detalhado...');
      const adviceResult = await generateFinancialAdvice(pergunta, balancetesResult.data, transacoesReport, firstName, balancetesResult.currentMonth);
      totalTokens += adviceResult.tokensUsed || 0;
      
      if (pageId) logTokenUsage(pageId, totalTokens);
      return NextResponse.json({ success: true, message: adviceResult.text });
    }

    // CASO: LANÇAMENTO (Multi-Item)
    console.log(`🤖 Lançamento detectado (${aiResult.itens?.length || 0} itens).`);
    let successCount = 0;
    let lastSummary = '';
    const isDespesa = aiResult.intent === 'despesa';

    for (const item of (aiResult.itens || [])) {
      const cachedId = isDespesa ? despesasDbId : receitasDbId;
      const { newDbId } = await addTransactionToClientNotion(notionAccessToken, workspaceId, item, cachedId, aiResult.intent);
      
      if (newDbId && pageId && successCount === 0) {
        if (isDespesa) { await updateCustomerDbIds(pageId, { despesasId: newDbId }); despesasDbId = newDbId; }
        else { await updateCustomerDbIds(pageId, { receitasId: newDbId }); receitasDbId = newDbId; }
      }

      const valFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor);
      lastSummary += `\n✅ ${item.descricao}: ${valFmt}`;
      successCount++;
    }

    const responseMessage = `✅ Tudo pronto! Lancei ${successCount} item(s) no seu Notion:${lastSummary}\n\nJá deixei tudo organizado. Quer saber como isso afetou seu "Termômetro Financeiro" ou se ainda pode comprar algo hoje? É só perguntar! 🚀`;
    if (pageId) logTokenUsage(pageId, totalTokens);
    return NextResponse.json({ success: true, message: responseMessage });

  } catch (err: any) {
    console.error('❌ Erro crítico:', err);
    return NextResponse.json({ success: false, message: 'Ops! Tive um problema técnico. Tente novamente em breve.' }, { status: 500 });
  }
}
