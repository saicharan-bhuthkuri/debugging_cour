import { runPythonCode, execPythonBatch } from './py-runner';

console.log("=== RUNNING PYTHON ENGINE COMPATIBILITY TEST SUITE ===");

const tests = [
    {
        name: "Test 1: Basic Python stdout and math",
        code: `
import math
r = 7.0
area = math.pi * (r ** 2)
print(f"AREA: {area:.2f}")
`,
        input: "",
        expected: "AREA: 153.94"
    },
    {
        name: "Test 2: Multiple input tokens with sys.stdin",
        code: `
import sys
tokens = sys.stdin.read().split()
name, age, gpa = tokens[0], int(tokens[1]), float(tokens[2])
print(f"NAME={name} AGE={age} GPA={gpa:.2f}")
`,
        input: "Alice 21 3.854\n",
        expected: "NAME=Alice AGE=21 GPA=3.85"
    },
    {
        name: "Test 3: List operations, sorting and formatting",
        code: `
nums = [45, 12, 89, 23, 5]
nums.sort()
print(" ".join(str(x) for x in nums))
`,
        input: "",
        expected: "5 12 23 45 89"
    },
    {
        name: "Test 4: Collections & Dictionary Counter",
        code: `
from collections import Counter
words = "apple banana apple cherry banana apple".split()
c = Counter(words)
for k in sorted(c.keys()):
    print(f"{k}: {c[k]}")
`,
        input: "",
        expected: "apple: 3\nbanana: 2\ncherry: 1"
    },
    {
        name: "Test 5: Recursion (Fibonacci)",
        code: `
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(f"FIB(10): {fib(10)}")
`,
        input: "",
        expected: "FIB(10): 55"
    }
];

let allPassed = true;

for (const t of tests) {
    try {
        const t0 = performance.now();
        const res = await runPythonCode(t.code, { stdin: t.input, timeout: 5000 });
        const elapsed = (performance.now() - t0).toFixed(1);
        const actual = res.stdout.trim();
        const expected = t.expected.trim();
        if (actual === expected) {
            console.log(`[PASS] ${t.name} (${elapsed}ms)`);
        } else {
            console.error(`[FAIL] ${t.name} (${elapsed}ms): expected '${expected}', got '${actual}', stderr: '${res.stderr}'`);
            allPassed = false;
        }
    } catch (e: any) {
        console.error(`[ERROR] ${t.name}:`, e.message);
        allPassed = false;
    }
}

// Test 6: Timeout enforcement
console.log("Test 6: Testing infinite loop timeout enforcement...");
try {
    const t0 = performance.now();
    await runPythonCode("while True: pass", { timeout: 1500 });
    console.error("[FAIL] Timeout test failed (did not timeout)");
    allPassed = false;
} catch (e: any) {
    console.log(`[PASS] Timeout correctly enforced: ${e.message}`);
}

// Test 7: Batch test cases evaluation
console.log("Test 7: Testing execPythonBatch with test cases...");
const batchResult = await execPythonBatch(
    "import sys; n = int(sys.stdin.read()); print(n * 2)",
    [
        { input: "5\n", output: "10" },
        { input: "20\n", output: "40" },
        { input: "-3\n", output: "-6" }
    ],
    { timeout: 3000 }
);

const batchPassed = batchResult.results.every(r => r.pass);
console.log(`[PASS] execPythonBatch all 3 test cases passed: ${batchPassed}`);
if (!batchPassed) allPassed = false;

if (!allPassed) {
    console.error("\nFAILED SOME PYTHON TESTS");
    process.exit(1);
}

console.log("\nALL PYTHON RUNNER TESTS PASSED 100%!");
process.exit(0);
