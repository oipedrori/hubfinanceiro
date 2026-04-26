import { Client } from "@notionhq/client";

const notion = new Client({ auth: "test" });
console.log("databases.query type:", typeof (notion.databases as any).query);
console.log("databases.retrieve type:", typeof (notion.databases as any).retrieve);
