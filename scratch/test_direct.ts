import { POST } from '../app/api/process/route';

async function testDirect() {
  const secretKey = 'zimbroo_nmcam'; 
  const text = 'MOVIMENTACAO gastei 55 e 88 no mercado e 27 e 38 na padaria';
  
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
