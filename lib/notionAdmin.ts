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
      const match = workspaceUrl.match(/[a-f0-9]{32}/i);
      if (match) {
         const raw = match[0];
         workspaceId = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
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
