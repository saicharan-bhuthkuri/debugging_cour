import { WccRunner } from './wcc-lib';
import { join } from 'path';

const zipData = await Bun.file(join(process.cwd(), 'wcc-lib', 'wccfiles.zip')).arrayBuffer();
const workerPath = join(process.cwd(), 'wcc-lib', 'wasi_worker.js');

const runner = new WccRunner({
    zip: new Uint8Array(zipData),
    workerURL: workerPath
});

await runner.readyPromise;

const tests = [
    {
        name: "Basic printf and math",
        code: `
        #include <stdio.h>
        int main() {
            int a = 15, b = 27;
            printf("SUM: %d\\n", a + b);
            return 0;
        }
        `,
        input: "",
        expected: "SUM: 42"
    },
    {
        name: "Standard stdin scanf",
        code: `
        #include <stdio.h>
        int main() {
            int x, y;
            if (scanf("%d %d", &x, &y) == 2) {
                printf("PROD: %d\\n", x * y);
            }
            return 0;
        }
        `,
        input: "6 7\n",
        expected: "PROD: 42"
    },
    {
        name: "String manipulation & ctype",
        code: `
        #include <stdio.h>
        #include <string.h>
        #include <ctype.h>
        int main() {
            char str[] = "hello world";
            for (int i = 0; str[i]; i++) {
                str[i] = toupper(str[i]);
            }
            printf("LEN: %lu, STR: %s\\n", strlen(str), str);
            return 0;
        }
        `,
        input: "",
        expected: "LEN: 11, STR: HELLO WORLD"
    },
    {
        name: "Dynamic Memory (malloc/free) & Pointers",
        code: `
        #include <stdio.h>
        #include <stdlib.h>
        int main() {
            int n = 5;
            int *arr = (int*)malloc(n * sizeof(int));
            if (!arr) return 1;
            for (int i = 0; i < n; i++) arr[i] = (i + 1) * 10;
            int sum = 0;
            for (int i = 0; i < n; i++) sum += arr[i];
            printf("SUM: %d\\n", sum);
            free(arr);
            return 0;
        }
        `,
        input: "",
        expected: "SUM: 150"
    },
    {
        name: "Structs and qsort",
        code: `
        #include <stdio.h>
        #include <stdlib.h>
        #include <string.h>

        typedef struct {
            char name[20];
            int score;
        } Student;

        int compare(const void *a, const void *b) {
            return ((Student*)b)->score - ((Student*)a)->score;
        }

        int main() {
            Student list[3] = { {"Alice", 85}, {"Bob", 95}, {"Charlie", 70} };
            qsort(list, 3, sizeof(Student), compare);
            printf("TOP: %s (%d)\\n", list[0].name, list[0].score);
            return 0;
        }
        `,
        input: "",
        expected: "TOP: Bob (95)"
    },
    {
        name: "Recursion (Fibonacci)",
        code: `
        #include <stdio.h>
        int fib(int n) {
            if (n <= 1) return n;
            return fib(n - 1) + fib(n - 2);
        }
        int main() {
            printf("FIB(10): %d\\n", fib(10));
            return 0;
        }
        `,
        input: "",
        expected: "FIB(10): 55"
    }
];

let allPassed = true;
for (const t of tests) {
    try {
        const res = await runner.exec(t.code, { stdin: t.input, timeout: 5000 });
        const actual = res.stdout.trim();
        const match = actual === t.expected;
        if (match) {
            console.log(`[PASS] ${t.name}`);
        } else {
            console.error(`[FAIL] ${t.name}: expected '${t.expected}', got '${actual}', stderr: '${res.stderr}'`);
            allPassed = false;
        }
    } catch (e) {
        console.error(`[ERROR] ${t.name}:`, e);
        allPassed = false;
    }
}

runner.terminate();
if (!allPassed) process.exit(1);
console.log("\nALL C CAPABILITIES VERIFIED SUCCESSFULLY!");
