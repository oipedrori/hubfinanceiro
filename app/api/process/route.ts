import { NextResponse } from 'next/server';
import { getCustomerBySecretKey } from '@/lib/notionAdmin';
import { parseFinancialText, generateFinancialAdvice } from '@/lib/gemini';
import { addTransactionToClientNotion, getBalancetesData } from '@/lib/notionClient';

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
    const { name, notionAccessToken, workspaceId } = customer.data!;
    
    if (!notionAccessToken || !workspaceId) {
       return NextResponse.json({ error: 'O cadastro do cliente está incompleto (Falta URL ou Token Notion).' }, { status: 400 });
    }

    console.log(`📡 Processando áudio do cliente: ${name}`);

    // Acordamos o Gemini para ler o texto e organizar nos moldes matemáticos da sua tabela
    const aiResult = await parseFinancialText(text);

    if (aiResult.intent === 'consulta') {
      console.log(`🤖 Usuário fez uma consulta. Resgatando balancetes no Notion de ${name}...`);
      const balancetesReport = await getBalancetesData(notionAccessToken);
      
      console.log('🗣️ Pedindo conselho ao Zimbroo (Gemini) sem travas JSON...');
      const advice = await generateFinancialAdvice(aiResult.pergunta, balancetesReport);
      
      console.log('💬 Resposta do Consultor falado gerada com sucesso.');
      // Devolvemos o texto limpo para o iOS Shortcuts poder ler em voz alta
      return NextResponse.json({ success: true, message: advice }, { status: 200 });
    }

    console.log(`🤖 Gemini terminou de classificar (É uma ${aiResult.intent}). Inserindo no Notion particular de ${name}...`);

    // 4. Entregamos os números e datas organizados para a "gaveta" privada de Despesas ou Receitas desse cliente
    await addTransactionToClientNotion(notionAccessToken, workspaceId, aiResult);

    // Tudo lindo! Devolvemos mensagem de sucesso pro celular
    // 5. Gerar Resposta Humanizada
    let responseMessage = "";
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aiResult.valor);
    const firstName = name.split(' ')[0];

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

    return NextResponse.json({ 
      success: true, 
      message: responseMessage 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro Crítico no /api/process:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
