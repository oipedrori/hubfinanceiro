async function test() {
  const secretKey = 'zimbroo_nmcam'; 
  const text = 'Quanto eu gastei este mês?';
  
  console.log("Testing /api/process...");
  try {
    const res = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, text })
    });

    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
