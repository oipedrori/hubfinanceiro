import * as admin from 'firebase-admin';

// Inicializa o Firebase Admin SDK apenas uma vez
if (!admin.apps.length) {
  // Trata quebras de linha na chave privada (muito comum ao colar em variáveis de ambiente)
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

export async function getCustomerBySecretKey(secretKey: string) {
  try {
    const customersRef = db.collection(CUSTOMERS_COLLECTION);
    const snapshot = await customersRef.where('secretKey', '==', secretKey).limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    const isActive = data.isActive !== false; // Padrão é true se não existir

    if (!isActive) {
      return { status: 'blocked', reason: 'A assinatura do cliente encontra-se Inativa' };
    }

    // Compatibilidade com o formato que o rest do sistema espera
    return {
      status: 'active',
      data: {
        name: data.name || 'Cliente Misterioso',
        notionAccessToken: data.notionAccessToken || null,
        workspaceId: data.workspaceId || null,
        despesasDbId: data.despesasDbId || null,
        receitasDbId: data.receitasDbId || null,
        balancetesDbId: data.balancetesDbId || null,
        pageId: doc.id // Usamos o ID do documento do Firestore como pageId
      }
    };
  } catch (error) {
    console.error("Erro no Firebase Admin ao buscar cliente:", error);
    throw new Error('Falha ao tentar se conectar ao Banco de Dados Admin do Hub Financeiro.');
  }
}

export async function createNewCustomer(data: { name: string, email?: string, notionAccessToken: string, workspaceId: string }) {
  try {
    const customersRef = db.collection(CUSTOMERS_COLLECTION);
    
    // 1. Verificar se o cliente já existe por Workspace ID
    const snapshot = await customersRef.where('workspaceId', '==', data.workspaceId).limit(1).get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const existingData = doc.data();
      
      // Se achamos, atualizamos apenas o Token de Acesso (caso tenha mudado)
      await doc.ref.update({
        notionAccessToken: data.notionAccessToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { secretKey: existingData.secretKey };
    }

    // 2. Se não existe, cria um novo
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const secretKey = `zimbroo_${randomSuffix}`;

    await customersRef.add({
      name: data.name,
      email: data.email || null,
      secretKey: secretKey,
      notionAccessToken: data.notionAccessToken,
      workspaceId: data.workspaceId,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      tokensUsed: 0 // Inicia o contador de tokens
    });

    return { secretKey };
  } catch (error) {
    console.error("Erro no Firebase Admin ao criar cliente:", error);
    throw new Error('Falha ao tentar criar novo cliente no Banco de Dados.');
  }
}

export async function updateCustomerDbIds(pageId: string, dbs: { despesasId?: string, receitasId?: string, balancetesId?: string }) {
  try {
    const docRef = db.collection(CUSTOMERS_COLLECTION).doc(pageId);
    
    const updates: any = {};
    if (dbs.despesasId) updates.despesasDbId = dbs.despesasId;
    if (dbs.receitasId) updates.receitasDbId = dbs.receitasId;
    if (dbs.balancetesId) updates.balancetesDbId = dbs.balancetesId;

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await docRef.update(updates);
    }
  } catch (error) {
    console.error("Erro no Firebase Admin ao atualizar IDs dos bancos:", error);
  }
}

export async function logTokenUsage(pageId: string, tokensUsed: number) {
  try {
    const docRef = db.collection(CUSTOMERS_COLLECTION).doc(pageId);
    
    // Incrementa os tokens atomicamente
    await docRef.update({
      tokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
      lastUsage: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Erro no Firebase Admin ao registrar uso de tokens:", error);
  }
}
