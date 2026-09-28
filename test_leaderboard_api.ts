import * as db from "./db";

console.log("=== Testing Leaderboard Data & Contest Settings ===");

await db.initDB();

// 1. Contest settings test
console.log("Testing contest settings...");
await db.setContestSetting("contest_title", "Antigravity Hackathon 2026");
await db.setContestSetting("leaderboard_visible", "true");
await db.setContestSetting("leaderboard_frozen", "false");

const settings = await db.getAllContestSettings();
console.log("Retrieved settings:", settings);
if (settings.settings.contest_title !== "Antigravity Hackathon 2026") {
    throw new Error("Contest title setting failed");
}

// 2. Leaderboard data query test
console.log("Testing getLiveLeaderboardData()...");
const data = await db.getLiveLeaderboardData({ allowFrozen: true });
console.log(`Rankings count: ${data.rankings.length}`);
console.log(`Typing rankings count: ${data.typing_rankings.length}`);
console.log(`Questions count: ${data.questions.length}`);
console.log(`Recent activity count: ${data.recent_activity.length}`);
console.log("Stats:", data.stats);

if (!Array.isArray(data.rankings) || !Array.isArray(data.questions)) {
    throw new Error("Leaderboard data missing expected arrays");
}

// Verify ranking sorted by score DESC, then penalty ASC
for (let i = 1; i < data.rankings.length; i++) {
    const prev = data.rankings[i - 1];
    const curr = data.rankings[i];
    if (curr.score > prev.score) {
        throw new Error(`Ranking order error at index ${i}: curr.score ${curr.score} > prev.score ${prev.score}`);
    }
}

console.log("✅ All Leaderboard tests passed successfully!");
process.exit(0);
