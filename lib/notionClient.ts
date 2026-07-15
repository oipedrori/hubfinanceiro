
// Busca o ID da página principal compartilhada com a integração
async function findTemplatePageId(clientAccessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { value: 'page', property: 'object' }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results) return null;

    const page = data.results.find((p: any) => {
      const titleProp = p.properties?.title || p.properties?.Name || p.properties?.Nome;
      const titleArray = titleProp?.title || p.title;
      const title = (titleArray?.[0]?.plain_text || '').toLowerCase();
      return title.includes('hub') || title.includes('financeiro') || title.includes('zimbroo');
    }) || data.results[0];

    return page ? page.id : null;
  } catch (e) {
    console.error("Erro ao buscar página template:", e);
    return null;
  }
}

// Varre recursivamente os blocos em busca de child_database originais
async function findDatabasesInBlock(clientAccessToken: string, blockId: string, depth = 0): Promise<{ id: string, title: string }[]> {
  if (depth > 4) return []; // Evita loops ou recursão excessiva

  const list: { id: string, title: string }[] = [];
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];

    for (const block of data.results) {
      if (block.type === 'child_database') {
        list.push({
          id: block.id,
          title: block.child_database?.title || ''
        });
      } else if (block.has_children) {
        const subDbs = await findDatabasesInBlock(clientAccessToken, block.id, depth + 1);
        list.push(...subDbs);
      }
    }
  } catch (e) {
    console.error(`Erro ao buscar filhos do bloco ${blockId}:`, e);
  }
  return list;
}

// ── HELPER: Busca mais robusta para encontrar bancos de dados mesmo dentro de colunas ──
async function findDatabaseByName(clientAccessToken: string, targetName: string): Promise<string | null> {
  try {
    // 1. Tenta a busca padrão do Notion primeiro
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' }
      })
    });
    
    let databases: any[] = [];
    if (res.ok) {
      const data = await res.json();
      if (data.results) {
        databases = data.results;
      }
    }

    const targetLower = targetName.toLowerCase();

    // Helper para buscar na lista de databases
    const searchInList = (list: any[]) => {
      const cleanMatch = (val: string) => val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const cleanTarget = cleanMatch(targetLower);

      // Correspondência exata
      const exact = list.find((db: any) => {
        const title = db.title?.[0]?.plain_text || db.child_database?.title || db.title || '';
        return cleanMatch(title) === cleanTarget;
      });
      if (exact) return exact.id;

      // Correspondência parcial
      const partial = list.find((db: any) => {
        const title = db.title?.[0]?.plain_text || db.child_database?.title || db.title || '';
        return cleanMatch(title).includes(cleanTarget);
      });
      return partial ? partial.id : null;
    };

    let matchedId = searchInList(databases);
    if (matchedId) return matchedId;

    // 2. Se não encontrou via busca (que pode falhar para bancos em colunas),
    // faz a busca varrendo os blocos da página principal
    console.log(`⚠️ Database '${targetName}' não encontrada na busca padrão. Iniciando varredura de blocos da página...`);
    const rootPageId = await findTemplatePageId(clientAccessToken);
    if (rootPageId) {
      const pageDbs = await findDatabasesInBlock(clientAccessToken, rootPageId);
      console.log(`Bancos de dados encontrados na varredura de blocos:`, pageDbs);
      matchedId = searchInList(pageDbs);
      if (matchedId) return matchedId;
    }

    return null;
  } catch (e) {
    console.error("Erro no findDatabaseByName:", e);
    return null;
  }
}

export async function addTransactionToClientNotion(clientAccessToken: string, workspaceId: string, transactionData: any, cachedDbId?: string | null, intent?: string) {
  const isDespesa = (intent || transactionData.intent) === 'despesa';
  const targetDbName = isDespesa ? 'Despesas' : 'Receitas';
  
  let targetDbId = cachedDbId;
  let wasSearched = false;

  // Só faz a busca bruta se não tiver o ID no cache
  if (!targetDbId) {
    targetDbId = await findDatabaseByName(clientAccessToken, targetDbName);
    if (!targetDbId) {
      throw new Error(`Não consegui achar uma tabela chamada '${targetDbName}' na conta do cliente.`);
    }
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
    targetDbId = await findDatabaseByName(clientAccessToken, 'Balancete');
    if (!targetDbId) {
      return { data: 'O banco "Balancetes" não foi encontrado na conta.', newDbId: null, currentMonth: null };
    }
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
      const fallbackId = await findDatabaseByName(clientAccessToken, 'Balancete');
      
      if (fallbackId) {
          targetDbId = fallbackId;
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
        currentMonthData = { 
          entradas: Number(entradas.toFixed(2)), 
          saidas: Number(saidas.toFixed(2)), 
          resultado: Number(resultado.toFixed(2)), 
          pageId: row.id 
        };
      }

      return `${mes}/${currentYear}: Entradas R$${entradas.toFixed(2)} | Saídas R$${saidas.toFixed(2)} | Balanço R$${resultado.toFixed(2)}`;
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
    return findDatabaseByName(clientAccessToken, name);
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
          valor: valor,
          categoria: row.properties['Categoria']?.select?.name || row.properties['Categoria']?.multi_select?.[0]?.name || 'Outros'
        };
      });
    } catch { return []; }
  }

  // Resolve IDs em paralelo
  const [dId, rId] = await Promise.all([
    despesasDbId || findDbId('Despesas'),
    receitasDbId || findDbId('Receitas')
  ]);

  // Tenta buscar transações com diferentes nomes de relação comuns
  const possibleRelationNames = ['Balancete', 'Mês', 'Balancetes', 'Mês/Ano', 'Periodo', 'Competência'];
  let despesas: any[] = [];
  let receitas: any[] = [];

  for (const relName of possibleRelationNames) {
    const [d, r] = await Promise.all([
      dId ? fetchFromDb(dId, relName) : Promise.resolve([]),
      rId ? fetchFromDb(rId, relName) : Promise.resolve([])
    ]);
    if (d.length > 0 || r.length > 0) {
      despesas = d;
      receitas = r;
      console.log(`✅ Transações encontradas usando relação: ${relName}`);
      break;
    }
  }

  // Totais numéricos
  const totalDespesas = despesas.reduce((sum, d) => sum + d.valor, 0);
  const totalReceitas = receitas.reduce((sum, r) => sum + r.valor, 0);

  // Formata relatório para a IA
  let report = '';

  // Adiciona resumo por categoria para facilitar para a IA
  const resumoCategorias: Record<string, number> = {};
  despesas.forEach(d => {
    const cat = d.categoria || 'Outros';
    resumoCategorias[cat] = (resumoCategorias[cat] || 0) + d.valor;
  });

  if (despesas.length > 0) {
    report += 'RESUMO DE GASTOS POR CATEGORIA NESTE MÊS:\n';
    Object.entries(resumoCategorias).forEach(([cat, total]) => {
      report += `- ${cat}: R$${total.toFixed(2)}\n`;
    });
  }
  if (receitas.length > 0) {
    const totalReceitas = receitas.reduce((sum, r) => sum + r.valor, 0);
    report += `\nTOTAL DE RECEITAS VINCULADAS A ESTE MÊS: R$${totalReceitas.toFixed(2)}\n`;
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

/**
 * Encontra a última movimentação (despesa ou receita) e a deleta (arquiva).
 */
export async function deleteLastTransaction(
  clientAccessToken: string,
  despesasDbId?: string | null,
  receitasDbId?: string | null
) {
  const headers = {
    'Authorization': `Bearer ${clientAccessToken}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  async function findDbId(name: string): Promise<string | null> {
    return findDatabaseByName(clientAccessToken, name);
  }

  const [dId, rId] = await Promise.all([
    despesasDbId || findDbId('Despesas'),
    receitasDbId || findDbId('Receitas')
  ]);

  // Busca a mais recente de cada um
  async function getLatest(dbId: string): Promise<any | null> {
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST', headers,
        body: JSON.stringify({ 
          page_size: 1, 
          sorts: [{ timestamp: 'created_time', direction: 'descending' }] 
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.results[0] || null;
    } catch { return null; }
  }

  const [lastD, lastR] = await Promise.all([
    dId ? getLatest(dId) : Promise.resolve(null),
    rId ? getLatest(rId) : Promise.resolve(null)
  ]);

  if (!lastD && !lastR) {
    throw new Error("Não encontrei nenhuma movimentação recente para deletar.");
  }

  // Compara qual é a mais recente de fato
  let targetPage: any = null;
  if (lastD && lastR) {
    const timeD = new Date(lastD.created_time).getTime();
    const timeR = new Date(lastR.created_time).getTime();
    targetPage = timeD > timeR ? lastD : lastR;
  } else {
    targetPage = lastD || lastR;
  }

  const desc = targetPage.properties['Descrição']?.title[0]?.plain_text || 'Sem descrição';
  const valor = targetPage.properties['Valor']?.number || 0;

  // Arquiva a página
  const delRes = await fetch(`https://api.notion.com/v1/pages/${targetPage.id}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ archived: true })
  });

  if (!delRes.ok) throw new Error("Falha ao deletar a página no Notion.");

  return { 
    descricao: desc, 
    valor, 
    tipo: targetPage.parent.database_id === dId ? 'despesa' : 'receita' 
  };
}

