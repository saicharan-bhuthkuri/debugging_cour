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

// --- TEST 1: C Question Evaluation ---
console.log("\n1. Testing C Question (ID: 6, Sum and Average)...");
const cSolution = `
#include <stdio.h>
int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int v;
        scanf("%d", &v);
        sum += v;
    }
    printf("SUM: %d\\nAVG: %.2f\\n", sum, (double)sum / n);
    return 0;
}
`;

let t0 = performance.now();
let res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: 6, source_code: cSolution, language: "c" })
});
let data = await res.json();
let elapsed = (performance.now() - t0).toFixed(1);
console.log(`C Question response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results?.every((r: any) => r.pass)) {
    console.error("C Question evaluation failed!");
    process.exit(1);
}
console.log("[PASS] C Question: all test cases passed!");

// --- TEST 2: Python Question Evaluation ---
console.log("\n2. Testing Python Question (ID: 11, Sum and Average)...");
const pySolution = `
import sys

def main():
    lines = sys.stdin.read().split()
    if not lines:
        return
    n = int(lines[0])
    nums = [int(x) for x in lines[1:n+1]]
    total = sum(nums)
    avg = total / n
    print(f"SUM: {total}")
    print(f"AVG: {avg:.2f}")

if __name__ == '__main__':
    main()
`;

t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: 11, source_code: pySolution, language: "python" })
});
data = await res.json();
elapsed = (performance.now() - t0).toFixed(1);
console.log(`Python Question response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results?.every((r: any) => r.pass)) {
    console.error("Python Question evaluation failed!");
    process.exit(1);
}
console.log("[PASS] Python Question: all test cases passed!");

// --- TEST 3: Python String Palindrome ---
console.log("\n3. Testing Python Question (ID: 12, String Palindrome)...");
const pyPalSolution = `
import sys
w = sys.stdin.read().strip()
print("YES" if w == w[::-1] else "NO")
`;
t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: 12, source_code: pyPalSolution, language: "python" })
});
data = await res.json();
elapsed = (performance.now() - t0).toFixed(1);
console.log(`Python Palindrome response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results?.every((r: any) => r.pass)) {
    console.error("Python Palindrome failed!");
    process.exit(1);
}
console.log("[PASS] Python Palindrome: all test cases passed!");

// --- TEST 4: Wrong Answer Handling in Python ---
console.log("\n4. Testing Python Wrong Answer...");
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify({ question_id: 11, source_code: "print('WRONG')", language: "python" })
});
data = await res.json();
const allWrong = data.result?.results?.every((r: any) => !r.pass);
console.log(`Correctly flagged as wrong: ${allWrong}`);
if (!allWrong) process.exit(1);

// --- TEST 5: Debug Questions API (checks language field returned) ---
console.log("\n5. Testing GET /debug/question for language field...");
res = await fetch(`${API_BASE}/debug/question`, {
    headers: { Authorization: `Bearer ${adminToken}` }
});
data = await res.json();
const questions = data.result || [];
const hasC = questions.some((q: any) => q.language === "c");
const hasPy = questions.some((q: any) => q.language === "python");
console.log(`Questions API returned ${questions.length} questions. Has C: ${hasC}, Has Python: ${hasPy}`);
if (!hasC || !hasPy) {
    console.error("Missing language differentiation in questions API!");
    process.exit(1);
}

console.log("\nALL DUAL-LANGUAGE (C & PYTHON) API TESTS PASSED SUCCESSFULLY 100%!");
process.exit(0);
