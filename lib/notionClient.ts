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
      return { data: 'O banco "Balancetes" não foi encontrado na conta.', newDbId: null, currentMonth: null };
    }
    targetDbId = searchData.results[0].id;
    wasSearched = true;
  }

  try {
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
    let rowsData = await rowsRes.json();

    // Se o ID do cache falhou (ex: deletado ou sem acesso), tenta buscar de novo uma vez
    if (!rowsRes.ok && rowsData.code === 'object_not_found') {
      console.log("Database em cache não encontrada. Tentando busca bruta...");
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

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.results.length > 0) {
          targetDbId = searchData.results[0].id;
          wasSearched = true;
          // Tenta a query de novo com o novo ID
          const retryRes = await fetch(`https://api.notion.com/v1/databases/${targetDbId}/query`, {
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
          rowsData = await retryRes.json();
        }
      }
    }

    if (!rowsData.results) {
      throw new Error(`Não consegui ler o seu banco de Balancetes. Verifique se ele existe e se a integração do Hub Financeiro tem acesso a ele.`);
    }

    if(rowsData.results.length === 0) return { data: 'O Balancete do cliente não contém meses registrados.', newDbId: wasSearched ? targetDbId : null, currentMonth: null };

    const currentYear = new Date().getFullYear();
    const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentMonthPrefix = String(brNow.getMonth() + 1).padStart(2, '0');

    let currentMonthData: { entradas: number, saidas: number, resultado: number, pageId: string } | null = null;

    const relatorio = rowsData.results.map((row: any) => {
      const mes = row.properties['Mês']?.title[0]?.plain_text || 'Desconhecido';
      const entradas = row.properties['Entradas']?.rollup?.number || 0;
      const saidas = row.properties['Saídas']?.rollup?.number || 0;
      const resultado = row.properties['Resultado do mês']?.formula?.number || 0;

      if (mes.startsWith(currentMonthPrefix)) {
        currentMonthData = { entradas, saidas, resultado, pageId: row.id };
      }

      return `${mes}/${currentYear}: Entradas R$${entradas} | Saídas R$${saidas} | Balanço R$${resultado}`;
    });

    return { data: relatorio.join('|'), newDbId: wasSearched ? targetDbId : null, currentMonth: currentMonthData };
  } catch (e: any) {
    throw new Error(`Erro ao acessar dados do Notion: ${e.message}`);
  }
}

// ── Busca movimentações do mês atual (despesas + receitas) ──
// Agora filtrando pela RELAÇÃO com o Balancete do mês, para pegar parcelas e recorrentes
export async function getCurrentMonthTransactions(
  clientAccessToken: string,
  monthPageId: string,
  despesasDbId?: string | null,
  receitasDbId?: string | null
) {
  const headers = {
    'Authorization': `Bearer ${clientAccessToken}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  // Busca o ID de uma database pelo nome (caso não esteja em cache)
  async function findDbId(name: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST', headers,
        body: JSON.stringify({ query: name, filter: { value: 'database', property: 'object' } })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.results.length > 0 ? data.results[0].id : null;
    } catch { return null; }
  }

  // Busca transações vinculadas ao ID do mês do balancete
  async function fetchFromDb(dbId: string, relationName: string): Promise<{ descricao: string, valor: number }[]> {
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST', headers,
        body: JSON.stringify({
          filter: {
            property: relationName,
            relation: { contains: monthPageId }
          },
          page_size: 100
        })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.results.map((row: any) => {
        // Para despesas, usamos 'Valor para balancete' (que trata parcelas)
        // Para receitas, usamos o 'Valor' normal
        const valorProp = row.properties['Valor para balancete'] || row.properties['Valor'];
        const valor = valorProp?.formula?.number ?? valorProp?.number ?? 0;
        
        return {
          descricao: row.properties['Descrição']?.title[0]?.plain_text || 'Sem descrição',
          valor: valor
        };
      });
    } catch { return []; }
  }

  // Resolve IDs em paralelo
  const [dId, rId] = await Promise.all([
    despesasDbId || findDbId('Despesas'),
    receitasDbId || findDbId('Receitas')
  ]);

  // Busca transações vinculadas ao mês (usando o nome exato da relação que vi no search)
  const [despesas, receitas] = await Promise.all([
    dId ? fetchFromDb(dId, 'Balancete') : Promise.resolve([]),
    rId ? fetchFromDb(rId, 'Balancete') : Promise.resolve([])
  ]);

  // Totais numéricos
  const totalDespesas = despesas.reduce((sum, d) => sum + d.valor, 0);
  const totalReceitas = receitas.reduce((sum, r) => sum + r.valor, 0);

  // Formata relatório para a IA
  let report = '';
  if (despesas.length > 0) {
    report += 'DESPESAS VINCULADAS A ESTE MÊS (incluindo parcelas e recorrentes):\n';
    despesas.forEach(d => report += `- ${d.descricao}: R$${d.valor.toFixed(2)}\n`);
  }
  if (receitas.length > 0) {
    report += 'RECEITAS VINCULADAS A ESTE MÊS:\n';
    receitas.forEach(r => report += `- ${r.descricao}: R$${r.valor.toFixed(2)}\n`);
  }

  if (!report) report = 'Nenhuma movimentação vinculada a este mês no balancete.';

  return {
    report,
    totalDespesas,
    totalReceitas,
    newDespesasDbId: !despesasDbId && dId ? dId : null,
    newReceitasDbId: !receitasDbId && rId ? rId : null
  };
}
