import { SignJWT } from "jose";

console.log("=== RUNNING API END-TO-END EVALUATION TESTS ===");

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "miaow_trinity");
const adminToken = await new SignJWT({
    id: 1,
    name: "Admin Tester",
    role: "admin",
    college: "Test College",
    branch: "CSE",
    year: 4,
    phone: "1234567890"
}).setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h").sign(secret);

const API_BASE = "http://localhost:3000";

// Test 1: Question 1 - Correct Solution
const q1Solution = `
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

console.log("\nTesting Question 1 (Sum and Average) with correct code...");
let t0 = performance.now();
let res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
        question_id: 1,
        source_code: q1Solution
    })
});

let data = await res.json();
let elapsed = (performance.now() - t0).toFixed(1);
console.log(`Response in ${elapsed}ms:`, JSON.stringify(data));
if (!data.result?.results || data.result.results.length === 0) {
    console.error("No results returned for Q1!");
    process.exit(1);
}
const allPassedQ1 = data.result.results.every((r: any) => r.pass);
console.log(`Q1 All 4 Test Cases Passed: ${allPassedQ1}`);
if (!allPassedQ1) process.exit(1);

// Test 2: Question 1 - Wrong Solution (fails test cases)
console.log("\nTesting Question 1 with intentionally wrong code...");
const q1Wrong = `
#include <stdio.h>
int main() {
    printf("WRONG ANSWER\\n");
    return 0;
}
`;
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
        question_id: 1,
        source_code: q1Wrong
    })
});
data = await res.json();
console.log("Wrong answer response:", JSON.stringify(data));
const nonePassed = data.result.results.every((r: any) => !r.pass);
console.log(`Correctly marked wrong: ${nonePassed}`);
if (!nonePassed) process.exit(1);

// Test 3: Question 2 - String Palindrome
console.log("\nTesting Question 2 (String Palindrome)...");
const q2Solution = `
#include <stdio.h>
#include <string.h>
int main() {
    char s[100];
    if (scanf("%s", s) != 1) return 0;
    int len = strlen(s);
    for (int i = 0; i < len / 2; i++) {
        if (s[i] != s[len - 1 - i]) {
            printf("NO\\n");
            return 0;
        }
    }
    printf("YES\\n");
    return 0;
}
`;
t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
        question_id: 2,
        source_code: q2Solution
    })
});
data = await res.json();
elapsed = (performance.now() - t0).toFixed(1);
console.log(`Q2 response in ${elapsed}ms:`, JSON.stringify(data));
const allPassedQ2 = data.result.results.every((r: any) => r.pass);
console.log(`Q2 All 4 Test Cases Passed: ${allPassedQ2}`);
if (!allPassedQ2) process.exit(1);

// Test 4: Question 3 - Prime Numbers
console.log("\nTesting Question 3 (Prime Numbers Range)...");
const q3Solution = `
#include <stdio.h>
#include <stdbool.h>

bool is_prime(int n) {
    if (n < 2) return false;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    int L, R;
    if (scanf("%d %d", &L, &R) != 2) return 0;
    int count = 0;
    for (int i = L; i <= R; i++) {
        if (is_prime(i)) {
            if (count > 0) printf(" ");
            printf("%d", i);
            count++;
        }
    }
    if (count == 0) printf("NONE");
    printf("\\n");
    return 0;
}
`;
t0 = performance.now();
res = await fetch(`${API_BASE}/debug/run`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
        question_id: 3,
        source_code: q3Solution
    })
});
data = await res.json();
elapsed = (performance.now() - t0).toFixed(1);
console.log(`Q3 response in ${elapsed}ms:`, JSON.stringify(data));
const allPassedQ3 = data.result.results.every((r: any) => r.pass);
console.log(`Q3 All 3 Test Cases Passed: ${allPassedQ3}`);
if (!allPassedQ3) process.exit(1);

console.log("\nALL BACKEND API TESTS COMPLETED AND PASSED WITH 100% SUCCESS!");
process.exit(0);
