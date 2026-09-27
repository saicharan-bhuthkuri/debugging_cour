import { SignJWT } from "jose";

console.log("=== RUNNING DUAL-LANGUAGE (C & PYTHON) API EVALUATION TESTS ===");

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "miaow_trinity");
const adminToken = await new SignJWT({
    id: 1,
    name: "Admin Dual Tester",
    role: "admin",
    college: "Test College",
    branch: "CSE",
    year: 4,
    phone: "1234567890"
}).setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h").sign(secret);

const API_BASE = "http://localhost:3000";

// --- FETCH QUESTIONS ---
console.log("\n1. Fetching questions via GET /debug/question...");
let res = await fetch(`${API_BASE}/debug/question`, {
    headers: { Authorization: `Bearer ${adminToken}` }
});
let data = await res.json();
const questions = data.result || [];
const cQuestions = questions.filter((q: any) => q.language === "c");
const pyQuestions = questions.filter((q: any) => q.language === "python");

console.log(`Retrieved ${questions.length} questions: ${cQuestions.length} C questions, ${pyQuestions.length} Python questions.`);
if (cQuestions.length === 0 || pyQuestions.length === 0) {
    console.error("Missing questions in DB!");
    process.exit(1);
}

import { questions as seedQuestions } from "./scripts/seed_4_sets";

// --- TEST 2: C Question Evaluation ---
const testCQMeta = cQuestions[0];
const cSolution = seedQuestions.find((q: any) => testCQMeta.title.includes(q.title) && q.language === "c")?.answer || "";
console.log(`\n2. Testing C Question (ID: ${testCQMeta.id}, "${testCQMeta.title}")...`);

let t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: testCQMeta.id, source_code: cSolution, language: "c" })
});
data = await res.json();
let elapsed = (performance.now() - t0).toFixed(1);
console.log(`C Question response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results?.every((r: any) => r.pass)) {
    console.error("C Question evaluation failed!");
    process.exit(1);
}
console.log("[PASS] C Question: all test cases passed!");

// --- TEST 3: Python Question Evaluation ---
const testPyQMeta = pyQuestions[0];
const pySolution = seedQuestions.find((q: any) => testPyQMeta.title.includes(q.title) && q.language === "python")?.answer || "";
console.log(`\n3. Testing Python Question (ID: ${testPyQMeta.id}, "${testPyQMeta.title}")...`);

t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: testPyQMeta.id, source_code: pySolution, language: "python" })
});
data = await res.json();
elapsed = (performance.now() - t0).toFixed(1);
console.log(`Python Question response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results?.every((r: any) => r.pass)) {
    console.error("Python Question evaluation failed!");
    process.exit(1);
}
console.log("[PASS] Python Question: all test cases passed!");

// --- TEST 4: Python Wrong Answer Handling ---
console.log("\n4. Testing Python Wrong Answer...");
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: testPyQMeta.id, source_code: "print('INTENTIONALLY WRONG')", language: "python" })
});
data = await res.json();
const allWrong = data.result?.results?.every((r: any) => !r.pass);
console.log(`Correctly flagged as wrong: ${allWrong}`);
if (!allWrong) process.exit(1);

// --- TEST 5: Exam Levels Verification ---
console.log("\n5. Verifying Exam Levels via GET /debug/level...");
res = await fetch(`${API_BASE}/debug/level`, {
    headers: { Authorization: `Bearer ${adminToken}` }
});
data = await res.json();
const levels = data.result || [];
console.log(`Exam Levels in DB: ${levels.length}`);
levels.forEach((l: any) => console.log(` - Level ${l.order_num}: "${l.name}" (${l.question_ids?.length} questions)`));

if (levels.length < 8) {
    console.error("Expected 8 exam levels!");
    process.exit(1);
}

console.log("\nALL DUAL-LANGUAGE (C & PYTHON) 4-SET EXAM API TESTS PASSED SUCCESSFULLY 100%!");
process.exit(0);
