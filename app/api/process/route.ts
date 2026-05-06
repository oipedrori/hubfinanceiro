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
  if (lower.includes('ver meu balancete mensal')) return true;
  const saldoPatterns = [
    /\bsaldo\b/,
    /\bbalancete\b/,
    /\bbalanco\b/,
    /como\s+(esta|ta|anda)\s+(meu\s+)?(saldo|balancete|balanco)/,
    /qual\s+(e\s+)?(meu|o)\s+(saldo|balancete|balanco)/,
  ];
  return saldoPatterns.some(p => p.test(lower));
}

export const maxDuration = 60; // Permite até 60s no Vercel para evitar timeout com a Gemma 4

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secretKey = body.secretKey;
    const text = (body.text || body.message || '').trim();

    if (!secretKey || !text) {
      return NextResponse.json({ success: false, message: 'Dados insuficientes. Certifique-se de enviar a chave e a mensagem.' }, { status: 400 });
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

    // 0. INTERCEPTAÇÃO DE MENUS DO ATALHO
    let cleanText = text;
    let overrideIntent: string | null = null;
    const lowerText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let isBalanceteKeyword = false;

    if (lowerText.startsWith('desfazer')) {
      overrideIntent = 'deletar_ultimo';
      cleanText = text.replace(/^(?:\s*desfazer\s*[:\-]*\s*)/i, '').trim();
    } else if (lowerText.startsWith('conselho')) {
      overrideIntent = 'consulta';
      cleanText = text.replace(/^(?:\s*conselho\s*[:\-]*\s*)/i, '').trim();
      if (!cleanText) cleanText = "Faça um resumo geral das minhas finanças.";
    } else if (lowerText.startsWith('movimentacao')) {
      cleanText = text.replace(/^(?:\s*movimenta[çc][ãa]o\s*[:\-]*\s*)/i, '').trim();
    } else if (lowerText.startsWith('balancete')) {
      isBalanceteKeyword = true;
      cleanText = text.replace(/^(?:\s*balancete\s*[:\-]*\s*)/i, '').trim();
    }

    // 1. FLUXO DE SALDO (Atalho Zero-Token)
    if (isBalanceteKeyword || isSaldoQuery(cleanText)) {
      console.log(`⚡ Atalho de SALDO ativado.`);
      const { currentMonth } = await getBalancetesData(notionAccessToken, balancetesDbId);
      
      if (!currentMonth) {
        return NextResponse.json({ success: true, message: 'Não encontrei dados do mês atual no seu Balancete. 😅' });
      }

      const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const mesAtual = brNow.toLocaleDateString('pt-BR', { month: 'long' });
      const mesCapitalized = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
      
      const val = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
      const cm: any = currentMonth;
      const msg = `📊 Seu balancete de ${mesCapitalized}\nEntradas: ${val(cm.entradas)}\nSaídas: ${val(cm.saidas)}\nSaldo: ${val(cm.resultado)}\n\nRode o atalho novamente para explorar outras opções!`;
      return NextResponse.json({ success: true, message: msg });
    }

    // 2. CLASSIFICAÇÃO PELA IA (Todos os outros casos)
    let aiResult: any = {};
    if (overrideIntent) {
      aiResult = { intent: overrideIntent, pergunta: cleanText };
    } else {
      aiResult = await parseFinancialText(cleanText);
      totalTokens += aiResult._tokensUsed || 0;
    }

    console.log('🤖 Resultado da Classificação:', JSON.stringify(aiResult, null, 2));

    if (aiResult.error) {
      return NextResponse.json({ success: false, message: aiResult.error });
    }

    // CASO: DELETAR
    if (aiResult.intent === 'deletar_ultimo') {
      console.log(`🗑️ Deletando última movimentação...`);
      const delResult = await deleteLastTransaction(notionAccessToken, despesasDbId, receitasDbId);
      const valFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delResult.valor);
      const msg = `🗑️ Registro removido: ${delResult.descricao} (${valFmt}). ✅\n\nRode o atalho novamente para explorar outras opções!`;
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
      return NextResponse.json({ success: true, message: adviceResult.text + '\n\nRode o atalho novamente para explorar outras opções!' });
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
      
      let extraInfo = '';
      if (item.tipo_despesa === 'Parcelada' && item.num_parcelas) {
        extraInfo = `\n💳 (Parcelada em ${item.num_parcelas} vezes)`;
      } else if (item.tipo_despesa === 'Recorrente') {
        extraInfo = `\n🔁 (Adicionada como recorrente)`;
      }
      
      const categoryLabel = isDespesa ? (item.categoria || 'Outros') : (item.tipo_receita || 'Outros');
      lastSummary += `\n\nℹ️ ${item.descricao}\n💸 ${valFmt}\n🏷️ ${categoryLabel}${extraInfo}`;
      
      successCount++;
    }

    const intentLabel = isDespesa ? 'despesa' : 'receita';
    const msgPrefix = successCount > 1 ? `as ${successCount} ${intentLabel}s` : `a ${intentLabel}`;
    const responseMessage = `✅ Pronto! Acabei de adicionar ${msgPrefix}:${lastSummary}\n\nRode o atalho novamente para explorar outras opções!`;
    if (pageId) logTokenUsage(pageId, totalTokens);
    return NextResponse.json({ success: true, message: responseMessage });

  } catch (err: any) {
    console.error('❌ Erro crítico:', err);
    return NextResponse.json({ success: false, message: 'Ops! Tive um problema técnico. Tente novamente em breve.' }, { status: 500 });
  }
}
