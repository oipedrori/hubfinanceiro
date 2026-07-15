import * as admin from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

// Funções copiadas do notionClient.ts para teste direto
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
    if (!res.ok) {
      console.error("Search failed:", await res.text());
      return null;
    }
    const data = await res.json();
    if (!data.results) return null;

    console.log("Páginas encontradas na busca:");
    data.results.forEach((p: any) => {
      const titleProp = p.properties?.title || p.properties?.Name || p.properties?.Nome;
      const titleArray = titleProp?.title || p.title;
      const title = titleArray?.[0]?.plain_text || '';
      console.log(`- ${title} (ID: ${p.id})`);
    });

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

async function findDatabasesInBlock(clientAccessToken: string, blockId: string, depth = 0): Promise<{ id: string, title: string }[]> {
  if (depth > 4) return [];

  const list: { id: string, title: string }[] = [];
  try {
    console.log(`Buscando filhos do bloco ${blockId} (depth: ${depth})...`);
    const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clientAccessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });
    if (!res.ok) {
      console.error(`Erro ao carregar blocos de ${blockId}:`, await res.text());
      return [];
    }
    const data = await res.json();
    if (!data.results) return [];

    for (const block of data.results) {
      console.log(`- Bloco encontrado: ${block.type} (ID: ${block.id}, has_children: ${block.has_children})`);
      if (block.type === 'child_database') {
        const title = block.child_database?.title || '';
        console.log(`🌟 [DATABASE DETECTADA]: ${title} (ID: ${block.id})`);
        list.push({ id: block.id, title });
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

async function test() {
  // Pega um cliente ativo para testar
  const snapshot = await db.collection('customers').limit(1).get();
  if (snapshot.empty) {
    console.log("Nenhum cliente cadastrado no Firestore.");
    return;
  }
  const clientData = snapshot.docs[0].data();
  const token = clientData.notionAccessToken;
  
  if (!token) {
    console.log("Cliente encontrado não tem token do Notion.");
    return;
  }

  console.log(`Testando varredura para o cliente: ${clientData.name}`);
  console.log(`Buscando ID da página principal...`);
  const rootPageId = await findTemplatePageId(token);
  if (!rootPageId) {
    console.log("Não foi possível encontrar a página raiz do template.");
    return;
  }

  console.log(`Página raiz encontrada: ${rootPageId}`);
  console.log(`Varrendo blocos da página principal...`);
  const dbs = await findDatabasesInBlock(token, rootPageId);
  console.log("\n--- RESULTADO DA VARREDURA ---");
  console.log(dbs);
}

test();
