export async function addTransactionToClientNotion(clientAccessToken: string, workspaceId: string, transactionData: any, cachedDbId?: string | null) {
  const isDespesa = transactionData.intent === 'despesa';
  const targetDbName = isDespesa ? 'Despesas' : 'Receitas';
  
  let targetDbId = cachedDbId;
  let wasSearched = false;

  // Só faz a busca bruta se não tiver o ID no cache
  if (!targetDbId) {
    const searchRes = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: targetDbName,
        filter: { value: 'database', property: 'object' }
      })
    });

    if (!searchRes.ok) throw new Error("Falha na busca pela tabela do cliente");
    
    const searchData = await searchRes.json();
    if (searchData.results.length === 0) {
      throw new Error(`Não consegui achar uma tabela chamada '${targetDbName}' na conta do cliente.`);
    }

    targetDbId = searchData.results[0].id;
    wasSearched = true;
  }

  const properties: any = {
    'Descrição': { title: [ { text: { content: transactionData.descricao || 'Nova Transação' } } ] },
    'Valor': { number: transactionData.valor || 0 },
    'Data': { date: { start: transactionData.data } }
  };

  if (isDespesa) {
    properties['Tipo de Despesa'] = { select: { name: transactionData.tipo_despesa || 'Móvel' } };
    properties['Método de Pagamento'] = { select: { name: transactionData.metodo_pagamento || 'Crédito' } };
    properties['Categoria'] = { select: { name: transactionData.categoria || 'Outros' } };
    properties['Nº Parcelas'] = { number: transactionData.num_parcelas || 1 };
  } else {
    properties['Tipo de Receita'] = { select: { name: transactionData.tipo_receita || 'Freela' } };
  }

  const createRes = await fetch('https://api.notion.com/v1/pages', {
     method: 'POST',
     headers: {
      'Authorization': `Bearer ${clientAccessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: targetDbId },
      properties: properties
    })
  });

  if (!createRes.ok) throw new Error(await createRes.text());
  
  const result = await createRes.json();
  return { result, newDbId: wasSearched ? targetDbId : null };
}

export async function getBalancetesData(clientAccessToken: string, cachedDbId?: string | null) {
  let targetDbId = cachedDbId;
  let wasSearched = false;

  if (!targetDbId) {
    const searchRes = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Balancetes',
        filter: { value: 'database', property: 'object' }
      })
    });

    if (!searchRes.ok) throw new Error("Falha na busca pela tabela Balancetes do cliente");
    const searchData = await searchRes.json();
    if (searchData.results.length === 0) {
      return { data: 'O banco "Balancetes" não foi encontrado na conta.', newDbId: null };
    }
    targetDbId = searchData.results[0].id;
    wasSearched = true;
  }

  // Baixa os meses disponíveis. Como o formato é "01 | Janeiro", o sorts ascending ou descending funciona!
  const rowsRes = await fetch(`https://api.notion.com/v1/databases/${targetDbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${clientAccessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      page_size: 15,
      sorts: [{ property: 'Mês', direction: 'descending' }]
    })
  });
  const rowsData = await rowsRes.json();

  if(rowsData.results.length === 0) return { data: 'O Balancete do cliente não contém meses registrados.', newDbId: wasSearched ? targetDbId : null };

  const currentYear = new Date().getFullYear();

  const relatorio = rowsData.results.map((row: any) => {
    const mes = row.properties['Mês']?.title[0]?.plain_text || 'Desconhecido';
    const entradas = row.properties['Entradas']?.rollup?.number || 0;
    const saidas = row.properties['Saídas']?.rollup?.number || 0;
    const resultado = row.properties['Resultado do mês']?.formula?.number || 0;
    // Adicionamos o ano corrente para a IA não se perder entre ciclos
    return `${mes}/${currentYear}: Entradas R$${entradas} | Saídas R$${saidas} | Balanço R$${resultado}`;
  });

  return { data: relatorio.join('|'), newDbId: wasSearched ? targetDbId : null };
}
