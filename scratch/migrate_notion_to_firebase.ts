import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach(line => {
      if (line && !line.startsWith("#")) {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim().replace(/^"(.*)"$/, '$1');
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();
const CUSTOMERS_COLLECTION = 'customers';

async function migrate() {
  const databaseId = process.env.ADMIN_NOTION_DB_ID as string;
  const secret = process.env.ADMIN_NOTION_SECRET as string;

  console.log("Fetching users from Notion...");
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    console.error("Notion fetch failed:", await res.text());
    return;
  }

  const data = await res.json();
  console.log(`Found ${data.results.length} users in Notion.`);

  for (const page of data.results) {
    const props = page.properties;
    const name = props['Cliente']?.title[0]?.plain_text || 'Sem Nome';
    const email = props['E-mail']?.email || null;
    const isActive = props['Assinatura Ativa']?.checkbox !== false;
    const notionToken = props['Notion Access Tolken']?.rich_text[0]?.plain_text || null;
    const workspaceId = props['ID do Workspace']?.rich_text[0]?.plain_text || null;
    const saleId = props['ID da venda']?.rich_text[0]?.plain_text || null;

    if (!workspaceId) {
      console.log(`- Skipping ${name} (no workspace ID)`);
      continue;
    }

    // Usar o ID da venda como secretKey se existir, senão gera um.
    // Isso aumenta a chance de compatibilidade com atalhos antigos.
    const secretKey = saleId ? `zimbroo_${saleId.toLowerCase()}` : `zimbroo_${Math.random().toString(36).substring(2, 7)}`;

    // Verificar se já existe no Firebase
    const existing = await db.collection(CUSTOMERS_COLLECTION).where('workspaceId', '==', workspaceId).limit(1).get();

    if (!existing.empty) {
      console.log(`- Updating existing user: ${name}`);
      await existing.docs[0].ref.update({
        name,
        email,
        isActive,
        notionAccessToken: notionToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.log(`- Creating new user: ${name} (Key: ${secretKey})`);
      await db.collection(CUSTOMERS_COLLECTION).add({
        name,
        email,
        isActive,
        secretKey,
        notionAccessToken: notionToken,
        workspaceId,
        tokensUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  console.log("Migration complete!");
}

migrate();
