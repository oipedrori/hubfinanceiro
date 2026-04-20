export async function getCustomerBySecretKey(secretKey: string) {
  const token = process.env.ADMIN_NOTION_SECRET;
  const databaseId = process.env.ADMIN_NOTION_DB_ID;

  if (!databaseId || !token) {
    throw new Error('As variáveis de sistema estão incompletas.');
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'Zimbroo Secret Key', rich_text: { equals: secretKey } },
        page_size: 1
      })
    });

    if (!res.ok) {
       console.error("Erro fetch Notion:", await res.text());
       return null;
    }

    const data = await res.json();
    if (data.results.length === 0) return null;

    const page = data.results[0];
    const isActive = page.properties['Assinatura Ativa']?.checkbox || false;

    if (!isActive) {
      return { status: 'blocked', reason: 'A assinatura do cliente encontra-se Inativa' };
    }

    const name = page.properties['Cliente']?.title[0]?.plain_text || 'Cliente Misterioso';
    const notionAccessToken = page.properties['Notion Access Tolken']?.rich_text[0]?.plain_text || null;
    const workspaceUrl = page.properties['ID do Workspace']?.rich_text[0]?.plain_text || null;
    
    let workspaceId = null;
    if (workspaceUrl) {
      // Se já for um UUID completo (36 chars com hífens), usamos direto
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceUrl)) {
        workspaceId = workspaceUrl;
      } else {
        // Se for uma URL, tentamos extrair o hash de 32 chars e formatar
        const match = workspaceUrl.match(/[a-f0-9]{32}/i);
        if (match) {
           const raw = match[0];
           workspaceId = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
        }
      }
    }

    return {
      status: 'active',
      data: { name, notionAccessToken, workspaceId }
    };
  } catch (error) {
    throw new Error('Falha ao tentar se conectar ao Notion Mestre do Hub Financeiro.');
  }
}

export async function createNewCustomer(data: { name: string, notionAccessToken: string, workspaceId: string }) {
  const token = process.env.ADMIN_NOTION_SECRET;
  const databaseId = process.env.ADMIN_NOTION_DB_ID;

  if (!databaseId || !token) {
    throw new Error('Configuração de Admin ausente.');
  }

  // 1. Verificar se o cliente já existe por Workspace ID
  const existingRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: { property: 'ID do Workspace', rich_text: { equals: data.workspaceId } },
      page_size: 1
    })
  });

  if (existingRes.ok) {
    const existingData = await existingRes.json();
    if (existingData.results.length > 0) {
      const existingPage = existingData.results[0];
      const existingKey = existingPage.properties['Zimbroo Secret Key']?.rich_text[0]?.plain_text;
      
      // Se achamos o cara, atualizamos apenas o Token de Acesso (caso tenha mudado) e retornamos a chave velha
      if (existingKey) {
        await fetch(`https://api.notion.com/v1/pages/${existingPage.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              'Notion Access Tolken': { rich_text: [{ text: { content: data.notionAccessToken } }] }
            }
          })
        });
        return { secretKey: existingKey };
      }
    }
  }

  // 2. Se não existe, cria um novo como antes
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const secretKey = `zimbroo_${randomSuffix}`;

  const res = await fetch(`https://api.notion.com/v1/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        'Cliente': { title: [{ text: { content: data.name } }] },
        'Zimbroo Secret Key': { rich_text: [{ text: { content: secretKey } }] },
        'Notion Access Tolken': { rich_text: [{ text: { content: data.notionAccessToken } }] },
        'ID do Workspace': { rich_text: [{ text: { content: data.workspaceId } }] },
        'Assinatura Ativa': { checkbox: true }
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Erro ao criar cliente no Notion Admin:", err);
    throw new Error('Não conseguimos salvar seu cadastro no banco de dados mestre.');
  }

  return { secretKey };
}
