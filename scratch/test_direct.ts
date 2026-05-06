import { POST } from '../app/api/process/route';

async function testDirect() {
  const secretKey = 'zimbroo_nmcam'; 
  const text = 'MOVIMENTACAO gastei 20 no pão';
  
  console.log("Testing POST directly...");
  try {
    const req = new Request('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, text })
    });

    const res = await POST(req);
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test failed with exception:", e);
  }
}

testDirect();
