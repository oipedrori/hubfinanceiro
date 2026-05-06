import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    // There is no listModels in the new SDK sometimes, but wait, the error said "Call ListModels to see the list of available models"
    // Let's just fetch from the REST API to see the models
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    console.log(data.models.map((m: any) => m.name));
  } catch(e) {
    console.error(e);
  }
}
listModels();
