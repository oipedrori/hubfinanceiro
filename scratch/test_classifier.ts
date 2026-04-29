async function test() {
  const secretKey = 'zimbroo_6hhn2'; 
  const text = 'Gastei 50 reais no mercado';
  
  console.log("Testing Hardened E2B...");
  try {
    const res = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, text })
    });

    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
