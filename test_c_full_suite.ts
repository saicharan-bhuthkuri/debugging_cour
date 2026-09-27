import { WccRunner } from './wcc-lib';
import { join } from 'path';

console.log("=== RUNNING FULL C ENGINE COMPATIBILITY SUITE ===");

const zipData = await Bun.file(join(process.cwd(), 'wcc-lib', 'wccfiles.zip')).arrayBuffer();
const workerPath = join(process.cwd(), 'wcc-lib', 'wasi_worker.js');

const runner = new WccRunner({
    zip: new Uint8Array(zipData),
    workerURL: workerPath
});
await runner.readyPromise;

const testCases = [
    {
        name: "Test 1: Standard printf, math, and formatted float/int output",
        code: `
        #include <stdio.h>
        #include <math.h>
        int main() {
            double r = 7.0;
            double area = 3.14159 * pow(r, 2.0);
            printf("AREA: %.2f\\n", area);
            return 0;
        }
        `,
        input: "",
        expected: "AREA: 153.94"
    },
    {
        name: "Test 2: Multi-type scanf (%d, %lf, %s, %c)",
        code: `
        #include <stdio.h>
        int main() {
            int age;
            double gpa;
            char name[30];
            char grade;
            int n = scanf("%d %lf %s %c", &age, &gpa, name, &grade);
            printf("MATCH=%d: name=%s, age=%d, gpa=%.2f, grade=%c\\n", n, name, age, gpa, grade);
            return 0;
        }
        `,
        input: "21 3.85 Alice A\n",
        expected: "MATCH=4: name=Alice, age=21, gpa=3.85, grade=A"
    },
    {
        name: "Test 3: Hex, Octal, and negative numbers with scanf",
        code: `
        #include <stdio.h>
        int main() {
            int hx, oc, neg;
            scanf("%x %o %d", &hx, &oc, &neg);
            printf("HEX=%d OCT=%d NEG=%d\\n", hx, oc, neg);
            return 0;
        }
        `,
        input: "ff 77 -450\n",
        expected: "HEX=255 OCT=63 NEG=-450"
    },
    {
        name: "Test 4: Dynamic memory allocation (malloc/calloc/free) & qsort",
        code: `
        #include <stdio.h>
        #include <stdlib.h>
        int cmp(const void *a, const void *b) { return (*(int*)a - *(int*)b); }
        int main() {
            int n = 5;
            int *arr = (int*)calloc(n, sizeof(int));
            arr[0] = 50; arr[1] = 10; arr[2] = 40; arr[3] = 20; arr[4] = 30;
            qsort(arr, n, sizeof(int), cmp);
            for (int i = 0; i < n; i++) printf("%d%s", arr[i], (i == n - 1) ? "\\n" : " ");
            free(arr);
            return 0;
        }
        `,
        input: "",
        expected: "10 20 30 40 50"
    },
    {
        name: "Test 5: String functions (strlen, strcpy, strcat, strcmp, strstr)",
        code: `
        #include <stdio.h>
        #include <string.h>
        int main() {
            char a[50] = "Hello";
            char b[] = " World";
            strcat(a, b);
            int len = strlen(a);
            char *found = strstr(a, "World");
            printf("STR='%s', LEN=%d, FOUND='%s'\\n", a, len, found);
            return 0;
        }
        `,
        input: "",
        expected: "STR='Hello World', LEN=11, FOUND='World'"
    },
    {
        name: "Test 6: sscanf string parsing",
        code: `
        #include <stdio.h>
        int main() {
            const char *input = "SCORE: 98.5 OUT_OF 100";
            double score;
            int total;
            int matched = sscanf(input, "SCORE: %lf OUT_OF %d", &score, &total);
            printf("MATCHED=%d: %.1f/%d\\n", matched, score, total);
            return 0;
        }
        `,
        input: "",
        expected: "MATCHED=2: 98.5/100"
    },
    {
        name: "Test 7: Beginners without #include <stdio.h> (auto-include safety guard)",
        code: `
        int main() {
            int x = 25;
            printf("AUTO_INCLUDE_VAL: %d\\n", x * 4);
            return 0;
        }
        `,
        input: "",
        expected: "AUTO_INCLUDE_VAL: 100"
    }
];

let allPassed = true;
for (const tc of testCases) {
    try {
        const t0 = performance.now();
        const res = await runner.exec(tc.code, { stdin: tc.input, timeout: 5000 });
        const elapsed = (performance.now() - t0).toFixed(1);
        const actual = res.stdout.trim();
        if (actual === tc.expected) {
            console.log(`[PASS] ${tc.name} (${elapsed}ms)`);
        } else {
            console.error(`[FAIL] ${tc.name} (${elapsed}ms): expected '${tc.expected}', got '${actual}', stderr: '${res.stderr}'`);
            allPassed = false;
        }
    } catch (e: any) {
        console.error(`[ERROR] ${tc.name}:`, e.message || e);
        allPassed = false;
    }
}

runner.terminate();
if (!allPassed) {
    console.error("\nFAILED SOME TESTS IN C SUITE");
    process.exit(1);
}
console.log("\nALL 7 TESTS IN FULL C SUITE PASSED SUCCESSFULLY!");
