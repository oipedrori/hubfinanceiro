import fs from "fs";
import path from "path";

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

async function inspect() {
  try {
    const databaseId = process.env.ADMIN_NOTION_DB_ID as string;
    const secret = process.env.ADMIN_NOTION_SECRET as string;

    console.log("Querying with fetch and version 2022-06-28...");
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 1 })
    });

    if (!res.ok) {
      console.error("Fetch failed:", res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log("Query Result results length:", data.results.length);
    if (data.results.length > 0) {
      const first = data.results[0];
      console.log("Properties keys:", Object.keys(first.properties || {}));
      console.log("Sample Row:", JSON.stringify(first, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

inspect();
