import * as db from '../db';

async function seed() {
    console.log("Seeding C and Python examination questions into database...");
    await db.initDB();

    const questions = [
        // --- C QUESTIONS ---
        {
            title: "Calculate Sum and Average of Elements",
            description: "Read an integer N followed by N integers. Print the SUM and AVG (rounded to 2 decimal places).",
            code_snippet: `// Fix or complete the C program to calculate sum and average
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
            difficulty: "easy",
            question_type: "full_edit",
            language: "c",
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
            description: "Given a single word string, check whether it is a palindrome. Output YES or NO.",
            code_snippet: `// Fix or complete the C program to check palindrome
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
            difficulty: "easy",
            question_type: "full_edit",
            language: "c",
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
            description: "Print all prime numbers between L and R inclusive separated by space, or NONE if no primes exist.",
            code_snippet: `// Fix or complete the C program to find prime numbers
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
            difficulty: "medium",
            question_type: "full_edit",
            language: "c",
            test_cases: [
                { input: "10 30\n", output: "11 13 17 19 23 29" },
                { input: "1 10\n", output: "2 3 5 7" },
                { input: "14 16\n", output: "NONE" }
            ],
            order: 3
        },
        {
            title: "Matrix Transpose 2D Array",
            description: "Read rows R and columns C, followed by the matrix elements. Print its transpose.",
            code_snippet: `// Fix or complete the C program to transpose a matrix
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
            difficulty: "medium",
            question_type: "full_edit",
            language: "c",
            test_cases: [
                { input: "2 3\n1 2 3\n4 5 6\n", output: "1 4\n2 5\n3 6" },
                { input: "2 2\n9 8\n7 6\n", output: "9 7\n8 6" }
            ],
            order: 4
        },
        {
            title: "Sort Array in Ascending Order",
            description: "Read N and N integers, and print the sorted array in ascending order separated by spaces.",
            code_snippet: `// Fix or complete the C program to sort an array
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
            difficulty: "easy",
            question_type: "full_edit",
            language: "c",
            test_cases: [
                { input: "5\n64 34 25 12 22\n", output: "12 22 25 34 64" },
                { input: "3\n5 1 4\n", output: "1 4 5" },
                { input: "1\n99\n", output: "99" }
            ],
            order: 5
        },

        // --- PYTHON QUESTIONS ---
        {
            title: "Python: Sum and Average of Elements",
            description: "Read an integer N followed by N integers from standard input. Output SUM: <sum> and AVG: <avg:.2f> on separate lines.",
            code_snippet: `# Complete the program to calculate sum and average
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
`,
            answer: `# Reference solution
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
`,
            difficulty: "easy",
            question_type: "full_edit",
            language: "python",
            test_cases: [
                { input: "5\n10 20 30 40 50\n", output: "SUM: 150\nAVG: 30.00" },
                { input: "4\n1 2 3 5\n", output: "SUM: 11\nAVG: 2.75" },
                { input: "3\n-10 0 10\n", output: "SUM: 0\nAVG: 0.00" },
                { input: "1\n42\n", output: "SUM: 42\nAVG: 42.00" }
            ],
            order: 6
        },
        {
            title: "Python: Check String Palindrome",
            description: "Read a single word and check whether it is a palindrome using string slicing. Output YES or NO.",
            code_snippet: `# Complete the program to check palindrome
import sys

def main():
    word = sys.stdin.read().strip()
    if not word:
        return
    if word == word[::-1]:
        print("YES")
    else:
        print("NO")

if __name__ == '__main__':
    main()
`,
            answer: `# Reference solution
import sys

def main():
    word = sys.stdin.read().strip()
    if not word:
        return
    if word == word[::-1]:
        print("YES")
    else:
        print("NO")

if __name__ == '__main__':
    main()
`,
            difficulty: "easy",
            question_type: "full_edit",
            language: "python",
            test_cases: [
                { input: "radar\n", output: "YES" },
                { input: "python\n", output: "NO" },
                { input: "madam\n", output: "YES" },
                { input: "z\n", output: "YES" }
            ],
            order: 7
        },
        {
            title: "Python: Prime Numbers in Range",
            description: "Given two integers L and R, print all prime numbers in [L, R] separated by spaces, or NONE if no primes exist.",
            code_snippet: `# Complete the program to find primes in range
import sys

def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def main():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2:
        return
    L, R = int(tokens[0]), int(tokens[1])
    primes = [str(x) for x in range(L, R + 1) if is_prime(x)]
    if primes:
        print(" ".join(primes))
    else:
        print("NONE")

if __name__ == '__main__':
    main()
`,
            answer: `# Reference solution
import sys

def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def main():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2:
        return
    L, R = int(tokens[0]), int(tokens[1])
    primes = [str(x) for x in range(L, R + 1) if is_prime(x)]
    if primes:
        print(" ".join(primes))
    else:
        print("NONE")

if __name__ == '__main__':
    main()
`,
            difficulty: "medium",
            question_type: "full_edit",
            language: "python",
            test_cases: [
                { input: "10 30\n", output: "11 13 17 19 23 29" },
                { input: "1 10\n", output: "2 3 5 7" },
                { input: "14 16\n", output: "NONE" }
            ],
            order: 8
        },
        {
            title: "Python: Word Frequency Counter",
            description: "Read text and count the frequency of each word. Output each unique word and its count formatted as 'word: count', sorted alphabetically by word.",
            code_snippet: `# Complete the program to count word frequencies
import sys
from collections import Counter

def main():
    text = sys.stdin.read().split()
    counts = Counter(text)
    for word in sorted(counts.keys()):
        print(f"{word}: {counts[word]}")

if __name__ == '__main__':
    main()
`,
            answer: `# Reference solution
import sys
from collections import Counter

def main():
    text = sys.stdin.read().split()
    counts = Counter(text)
    for word in sorted(counts.keys()):
        print(f"{word}: {counts[word]}")

if __name__ == '__main__':
    main()
`,
            difficulty: "medium",
            question_type: "full_edit",
            language: "python",
            test_cases: [
                { input: "apple banana apple cherry banana apple\n", output: "apple: 3\nbanana: 2\ncherry: 1" },
                { input: "one two two three three three\n", output: "one: 1\nthree: 3\ntwo: 2" }
            ],
            order: 9
        },
        {
            title: "Python: Matrix Diagonal Sum",
            description: "Read dimension N and an N x N matrix. Output the sum of primary and secondary diagonals formatted as PRIMARY: <p> and SECONDARY: <s> on separate lines.",
            code_snippet: `# Complete the program to calculate matrix diagonal sums
import sys

def main():
    tokens = [int(x) for x in sys.stdin.read().split()]
    if not tokens:
        return
    n = tokens[0]
    mat = []
    idx = 1
    for i in range(n):
        mat.append(tokens[idx:idx+n])
        idx += n

    primary = sum(mat[i][i] for i in range(n))
    secondary = sum(mat[i][n - 1 - i] for i in range(n))

    print(f"PRIMARY: {primary}")
    print(f"SECONDARY: {secondary}")

if __name__ == '__main__':
    main()
`,
            answer: `# Reference solution
import sys

def main():
    tokens = [int(x) for x in sys.stdin.read().split()]
    if not tokens:
        return
    n = tokens[0]
    mat = []
    idx = 1
    for i in range(n):
        mat.append(tokens[idx:idx+n])
        idx += n

    primary = sum(mat[i][i] for i in range(n))
    secondary = sum(mat[i][n - 1 - i] for i in range(n))

    print(f"PRIMARY: {primary}")
    print(f"SECONDARY: {secondary}")

if __name__ == '__main__':
    main()
`,
            difficulty: "medium",
            question_type: "full_edit",
            language: "python",
            test_cases: [
                { input: "3\n1 2 3\n4 5 6\n7 8 9\n", output: "PRIMARY: 15\nSECONDARY: 15" },
                { input: "2\n5 8\n3 2\n", output: "PRIMARY: 7\nSECONDARY: 11" }
            ],
            order: 10
        }
    ];

    // Clear existing questions and seed fresh list
    const { questions: existingQ } = await db.getAllDebugQuestions();
    for (const eq of existingQ || []) {
        await db.deleteDebugQuestion(eq.id);
    }

    const cIds: number[] = [];
    const pyIds: number[] = [];

    for (const q of questions) {
        await db.createDebugQuestion(q);
    }

    const { questions: reloadedQ } = await db.getAllDebugQuestions();
    for (const q of reloadedQ || []) {
        if (q.language === "python") pyIds.push(q.id);
        else cIds.push(q.id);
    }

    // Configure Exam Levels: Level 1 (C) and Level 2 (Python)
    const { levels } = await db.getAllDebugLevels();
    for (const l of levels || []) {
        await db.deleteDebugLevel(l.id);
    }

    await db.createDebugLevel({
        name: "Level 1 - Core C Programming",
        order: 1,
        question_ids: cIds,
        duration: 3600
    });

    await db.createDebugLevel({
        name: "Level 2 - Core Python Programming",
        order: 2,
        question_ids: pyIds,
        duration: 3600
    });

    console.log(`\nSuccessfully seeded:`);
    console.log(`- ${cIds.length} C questions (IDs: ${cIds.join(', ')}) in 'Level 1 - Core C Programming'`);
    console.log(`- ${pyIds.length} Python questions (IDs: ${pyIds.join(', ')}) in 'Level 2 - Core Python Programming'`);
    console.log("\nDATABASE SEEDING COMPLETE!");
    process.exit(0);
}

seed().catch(err => {
    console.error("Seed error:", err);
    process.exit(1);
});
