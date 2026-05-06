import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    // There is no listModels in the new SDK sometimes, but wait, the error said "Call ListModels to see the list of available models"
    let nextPageToken = '';
    let allModels: string[] = [];
    do {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.models) {
        allModels = allModels.concat(data.models.map((m: any) => m.name));
      }
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
    
    console.log("All Gemma models:");
    console.log(allModels.filter(m => m.includes('gemma')));
  } catch(e) {
    console.error(e);
  }
}
listModels();
