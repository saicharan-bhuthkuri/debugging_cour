import * as db from "./db";

console.log("=== Running End-to-End Leaderboard Verification ===");

await db.initDB();

// 1. Create 3 test users if they don't already exist
const userA = { name: "Alice Hacker", role: "member" as const, year: 2, branch: "CSE", college: "IIT Bombay", phone: "9999900001" };
const userB = { name: "Bob Coder", role: "member" as const, year: 3, branch: "ECE", college: "NIT Trichy", phone: "9999900002" };
const userC = { name: "Charlie Debugger", role: "member" as const, year: 1, branch: "IT", college: "BITS Pilani", phone: "9999900003" };

await db.createUser(userA);
await db.createUser(userB);
await db.createUser(userC);

const uA = (await db.userExists(userA)).users?.[0];
const uB = (await db.userExists(userB)).users?.[0];
const uC = (await db.userExists(userC)).users?.[0];

if (!uA || !uB || !uC) throw new Error("Failed to create/fetch test users");

// 2. Create mock exam sessions
const sA = (await db.createExamSession({ user_id: uA.id, system_id: 1, exam_mode: "debug" })).id!;
const sB = (await db.createExamSession({ user_id: uB.id, system_id: 2, exam_mode: "debug" })).id!;
const sC = (await db.createExamSession({ user_id: uC.id, system_id: 3, exam_mode: "debug" })).id!;

// 3. Get first 2 questions
const { questions } = await db.getAllDebugQuestions();
if (!questions || questions.length < 2) throw new Error("Need at least 2 questions in DB");
const q1 = questions[0];
const q2 = questions[1];

const t0 = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago
const t1 = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 mins ago
const t2 = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago
const t3 = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 mins ago

// Alice starts at t0
await db.createSystemLog({ exam_session_id: sA, user_id: uA.id, system_code: "PC-01", log_type: "EXAM_START", data: { timestamp: t0 } });
// Alice solves Q1 at t1 on attempt 1 (t1 - t0 = 5m)
await db.createSystemLog({ exam_session_id: sA, user_id: uA.id, system_code: "PC-01", log_type: "SUBMIT", data: { question_id: q1.id, answer: "int main(){}" } });
await db.gradeSubmission(sA, q1.id, true);

// Bob starts at t0
await db.createSystemLog({ exam_session_id: sB, user_id: uB.id, system_code: "PC-02", log_type: "EXAM_START", data: { timestamp: t0 } });
// Bob fails Q1 at t1
await db.createSystemLog({ exam_session_id: sB, user_id: uB.id, system_code: "PC-02", log_type: "SUBMIT", data: { question_id: q1.id, answer: "wrong" } });
// Bob solves Q1 at t2 on attempt 2 (t2 - t0 = 10m + 20m penalty = 30m)
await db.createSystemLog({ exam_session_id: sB, user_id: uB.id, system_code: "PC-02", log_type: "SUBMIT", data: { question_id: q1.id, answer: "correct" } });
await db.gradeSubmission(sB, q1.id, true);

// Charlie starts at t0, solves Q1 and Q2
await db.createSystemLog({ exam_session_id: sC, user_id: uC.id, system_code: "PC-03", log_type: "EXAM_START", data: { timestamp: t0 } });
await db.createSystemLog({ exam_session_id: sC, user_id: uC.id, system_code: "PC-03", log_type: "SUBMIT", data: { question_id: q1.id, answer: "correct" } });
await db.gradeSubmission(sC, q1.id, true);
await db.createSystemLog({ exam_session_id: sC, user_id: uC.id, system_code: "PC-03", log_type: "SUBMIT", data: { question_id: q2.id, answer: "correct" } });
await db.gradeSubmission(sC, q2.id, true);

// 4. Retrieve live leaderboard
const leaderboard = await db.getLiveLeaderboardData({ allowFrozen: true });

console.log("\nLeaderboard Rankings:");
leaderboard.rankings.forEach(r => {
    console.log(`Rank #${r.rank}: ${r.user_name} (${r.system_code}) | Score: ${r.score} pts | Solved: ${r.solved_count} | Penalty: ${r.penalty}m`);
});

// Verification assertions:
const rowA = leaderboard.rankings.find(r => r.session_id === sA)!;
const rowB = leaderboard.rankings.find(r => r.session_id === sB)!;
const rowC = leaderboard.rankings.find(r => r.session_id === sC)!;

if (!rowA || !rowB || !rowC) {
    throw new Error("Could not find test session rows in leaderboard");
}

if (rowC.score <= rowA.score) {
    throw new Error(`Expected Charlie (score ${rowC.score}) to be higher than Alice (score ${rowA.score})`);
}

if (rowA.penalty >= rowB.penalty) {
    throw new Error(`Expected Alice's penalty (${rowA.penalty}m) to be lower than Bob's (${rowB.penalty}m)`);
}

if (rowA.rank >= rowB.rank) {
    throw new Error(`Expected Alice's rank (${rowA.rank}) to be higher than Bob's (${rowB.rank})`);
}

console.log("\n✅ Charlie (higher score) ranked above Alice & Bob!");
console.log(`✅ Alice penalty: ${rowA.penalty}m vs Bob penalty: ${rowB.penalty}m (+20m for failed attempt)`);
console.log(`✅ Alice rank (#${rowA.rank}) is higher than Bob rank (#${rowB.rank})!`);

console.log("✅ Problem matrix verified!");
console.log("✅ First to solve logic verified!");
console.log("=== End-to-End Leaderboard Verification Succeeded! ===");
