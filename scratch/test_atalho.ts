async function testAtalho() {
  const secretKey = 'zimbroo_6hhn2'; 
  const text = 'Gastei 20 no pão';
  
  console.log("Testing Shortcut API...");
  try {
    const res = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, text })
    });

    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testAtalho();
