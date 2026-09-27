import { Database } from "bun:sqlite";

const d = new Database("db.sqlite");
console.log("Checkpointing WAL journal into main db.sqlite file...");
d.exec("PRAGMA wal_checkpoint(TRUNCATE);");

const qCount = d.query("SELECT count(*) as count FROM debug_questions;").get() as any;
const lCount = d.query("SELECT count(*) as count FROM debug_levels;").get() as any;
const uCount = d.query("SELECT count(*) as count FROM users;").get() as any;

console.log("\n--- VERIFICATION IN MAIN DB.SQLITE FILE ---");
console.log(`debug_questions rows: ${qCount?.count}`);
console.log(`debug_levels rows:    ${lCount?.count}`);
console.log(`users rows:           ${uCount?.count}`);

d.close();
console.log("\nDone! Now your SQLite GUI viewer will show all rows after refresh!");
process.exit(0);
