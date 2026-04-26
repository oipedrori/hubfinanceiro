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

async function list() {
  const snap = await db.collection('customers').get();
  console.log('Found', snap.size, 'customers in Firebase');
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Name: ${data.name}, Key: ${data.secretKey}, Active: ${data.isActive}`);
  });
}

list();
