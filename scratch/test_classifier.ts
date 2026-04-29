async function test() {
  const secretKey = 'zimbroo_6hhn2'; 
  const text = 'Quanto gastei com mercado este mês?';
  
  console.log("Testing Quanto gastei Logic...");
  try {
    const res = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, text })
    });

    const data = await res.json();
    console.log("Response Message:", data.message);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
