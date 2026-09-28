import * as db from '../db';

async function seed() {
    console.log("Seeding standard C examination questions into SQLite database...");
    await db.initDB();

    const questions = [
        {
            title: "Calculate Sum and Average of Elements",
            code: `// Fix or complete the program to read N integers and print the SUM and AVG (2 decimal places)
#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int sum = 0;
    for (int i = 0; i < n; i++) {
        int val;
        scanf("%d", &val);
        sum += val;
    }

    double avg = (double)sum / n;
    printf("SUM: %d\\nAVG: %.2f\\n", sum, avg);
    return 0;
}
`,
            answer: `// Reference solution
#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int sum = 0;
    for (int i = 0; i < n; i++) {
        int val;
        scanf("%d", &val);
        sum += val;
    }

    double avg = (double)sum / n;
    printf("SUM: %d\\nAVG: %.2f\\n", sum, avg);
    return 0;
}
`,
            question_type: "full_edit",
            test_cases: [
                { input: "5\n10 20 30 40 50\n", output: "SUM: 150\nAVG: 30.00" },
                { input: "4\n1 2 3 5\n", output: "SUM: 11\nAVG: 2.75" },
                { input: "3\n-10 0 10\n", output: "SUM: 0\nAVG: 0.00" },
                { input: "1\n42\n", output: "SUM: 42\nAVG: 42.00" }
            ],
            order: 1
        },
        {
            title: "Check String Palindrome",
            code: `// Fix or complete the program to check if the given word is a palindrome
#include <stdio.h>
#include <string.h>

int main() {
    char str[100];
    if (scanf("%s", str) != 1) return 0;

    int len = strlen(str);
    int is_palindrome = 1;
    for (int i = 0; i < len / 2; i++) {
        if (str[i] != str[len - 1 - i]) {
            is_palindrome = 0;
            break;
        }
    }

    if (is_palindrome) {
        printf("YES\\n");
    } else {
        printf("NO\\n");
    }
    return 0;
}
`,
            answer: `// Reference solution
#include <stdio.h>
#include <string.h>

int main() {
    char str[100];
    if (scanf("%s", str) != 1) return 0;

    int len = strlen(str);
    int is_palindrome = 1;
    for (int i = 0; i < len / 2; i++) {
        if (str[i] != str[len - 1 - i]) {
            is_palindrome = 0;
            break;
        }
    }

    if (is_palindrome) {
        printf("YES\\n");
    } else {
        printf("NO\\n");
    }
    return 0;
}
`,
            question_type: "full_edit",
            test_cases: [
                { input: "radar\n", output: "YES" },
                { input: "hello\n", output: "NO" },
                { input: "madam\n", output: "YES" },
                { input: "a\n", output: "YES" }
            ],
            order: 2
        },
        {
            title: "Find All Primes in Range",
            code: `// Print all prime numbers between L and R inclusive separated by space, or NONE if no primes
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
    if (count == 0) {
        printf("NONE");
    }
    printf("\\n");
    return 0;
}
`,
            answer: `// Reference solution
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
    if (count == 0) {
        printf("NONE");
    }
    printf("\\n");
    return 0;
}
`,
            question_type: "full_edit",
            test_cases: [
                { input: "10 30\n", output: "11 13 17 19 23 29" },
                { input: "1 10\n", output: "2 3 5 7" },
                { input: "14 16\n", output: "NONE" }
            ],
            order: 3
        },
        {
            title: "Matrix Transpose 2D Array",
            code: `// Read rows R and cols C, then read matrix and print its transpose
#include <stdio.h>

int main() {
    int R, C;
    if (scanf("%d %d", &R, &C) != 2) return 0;

    int mat[50][50];
    for (int i = 0; i < R; i++) {
        for (int j = 0; j < C; j++) {
            scanf("%d", &mat[i][j]);
        }
    }

    for (int j = 0; j < C; j++) {
        for (int i = 0; i < R; i++) {
            printf("%d%s", mat[i][j], (i == R - 1) ? "" : " ");
        }
        printf("\\n");
    }
    return 0;
}
`,
            answer: `// Reference solution
#include <stdio.h>

int main() {
    int R, C;
    if (scanf("%d %d", &R, &C) != 2) return 0;

    int mat[50][50];
    for (int i = 0; i < R; i++) {
        for (int j = 0; j < C; j++) {
            scanf("%d", &mat[i][j]);
        }
    }

    for (int j = 0; j < C; j++) {
        for (int i = 0; i < R; i++) {
            printf("%d%s", mat[i][j], (i == R - 1) ? "" : " ");
        }
        printf("\\n");
    }
    return 0;
}
`,
            question_type: "full_edit",
            test_cases: [
                { input: "2 3\n1 2 3\n4 5 6\n", output: "1 4\n2 5\n3 6" },
                { input: "2 2\n9 8\n7 6\n", output: "9 7\n8 6" }
            ],
            order: 4
        },
        {
            title: "Sort Array in Ascending Order",
            code: `// Read N and N integers, print them sorted in ascending order separated by spaces
#include <stdio.h>
#include <stdlib.h>

int compare(const void *a, const void *b) {
    return (*(int*)a - *(int*)b);
}

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int arr[100];
    for (int i = 0; i < n; i++) {
        scanf("%d", &arr[i]);
    }

    qsort(arr, n, sizeof(int), compare);

    for (int i = 0; i < n; i++) {
        printf("%d%s", arr[i], (i == n - 1) ? "" : " ");
    }
    printf("\\n");
    return 0;
}
`,
            answer: `// Reference solution
#include <stdio.h>
#include <stdlib.h>

int compare(const void *a, const void *b) {
    return (*(int*)a - *(int*)b);
}

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int arr[100];
    for (int i = 0; i < n; i++) {
        scanf("%d", &arr[i]);
    }

    qsort(arr, n, sizeof(int), compare);

    for (int i = 0; i < n; i++) {
        printf("%d%s", arr[i], (i == n - 1) ? "" : " ");
    }
    printf("\\n");
    return 0;
}
`,
            question_type: "full_edit",
            test_cases: [
                { input: "5\n64 34 25 12 22\n", output: "12 22 25 34 64" },
                { input: "3\n5 1 4\n", output: "1 4 5" },
                { input: "1\n99\n", output: "99" }
            ],
            order: 5
        }
    ];

    const insertedIds: number[] = [];
    for (const q of questions) {
        const res = await db.createDebugQuestion(q);
        if (res.error) {
            console.error(`Failed to create question ${q.title}:`, res.error);
        } else {
            console.log(`Created question: ${q.title}`);
        }
    }

    const { questions: allQ } = await db.getAllDebugQuestions();
    const qIds = (allQ || []).map((q: any) => q.id);

    // Create a debug level if none exists
    const { levels } = await db.getAllDebugLevels();
    if (!levels || levels.length === 0) {
        await db.createDebugLevel({
            name: "Level 1 - Core C Programming",
            order: 1,
            question_ids: qIds,
            duration: 900
        });
        console.log("Created debug level 'Level 1 - Core C Programming' with questions:", qIds);
    } else {
        await db.updateDebugLevel(levels[0].id, {
            name: levels[0].name || "Level 1 - Core C Programming",
            order: levels[0].order_num || 1,
            question_ids: qIds,
            duration: levels[0].duration || 900
        });
        console.log(`Updated debug level ${levels[0].id} with questions:`, qIds);
    }

    console.log("\nDATABASE SEEDING COMPLETE!");
    process.exit(0);
}

seed().catch(err => {
    console.error("Seed error:", err);
    process.exit(1);
});
