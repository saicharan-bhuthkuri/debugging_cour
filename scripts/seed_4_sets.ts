import * as db from '../db';
import { WccRunner } from '../wcc-lib';
import wccfiles from '../wcc-lib/wccfiles.zip' with { type: "file" };
import wasiWorkerURL from '../wcc-lib/wasi_worker.js' with { type: "file" };
import { execPythonBatch } from '../py-runner';

export interface QuestionData {
    set: 'C_A' | 'C_B' | 'C_C' | 'C_D' | 'PY_A' | 'PY_B' | 'PY_C' | 'PY_D';
    title: string;
    description: string;
    code_snippet: string;
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    question_type: 'full_edit';
    language: 'c' | 'python';
    test_cases: { input: string; output: string }[];
    order: number;
}

export const questions: QuestionData[] = [
    // ==========================================
    // C PROGRAMMING - SET A
    // ==========================================
    {
        set: 'C_A',
        title: "Sum and Average of Numbers",
        description: "Read an integer N followed by N integers. Print the SUM and AVG formatted to 2 decimal places.",
        code_snippet: `// Debug this C program to correctly calculate sum and average
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);

    int sum = 0;
    // BUG: Loop condition and float division
    for (int i = 0; i <= n; i++) {
        int val;
        scanf("%d", &val);
        sum += val;
    }

    double avg = sum / n;
    printf("SUM: %d\\nAVG: %.2f\\n", sum, avg);
    return 0;
}
`,
        answer: `#include <stdio.h>

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
        set: 'C_A',
        title: "Check String Palindrome",
        description: "Read a string (up to 100 characters) and determine if it is a palindrome. Output 'PALINDROME' or 'NOT PALINDROME'.",
        code_snippet: `// Fix the string palindrome checker
#include <stdio.h>
#include <string.h>

int main() {
    char s[100];
    scanf("%s", s);
    int len = strlen(s);

    // BUG: Incorrect indices and boundary check
    int is_pal = 1;
    for (int i = 0; i < len; i++) {
        if (s[i] != s[len - i]) {
            is_pal = 0;
            break;
        }
    }

    if (is_pal) printf("PALINDROME\\n");
    else printf("NOT PALINDROME\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>
#include <string.h>

int main() {
    char s[100];
    if (scanf("%s", s) != 1) return 0;
    int len = strlen(s);

    int is_pal = 1;
    for (int i = 0; i < len / 2; i++) {
        if (s[i] != s[len - 1 - i]) {
            is_pal = 0;
            break;
        }
    }

    if (is_pal) printf("PALINDROME\\n");
    else printf("NOT PALINDROME\\n");
    return 0;
}
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "radar\n", output: "PALINDROME" },
            { input: "level\n", output: "PALINDROME" },
            { input: "exam\n", output: "NOT PALINDROME" },
            { input: "a\n", output: "PALINDROME" }
        ],
        order: 2
    },
    {
        set: 'C_A',
        title: "Find Second Largest Number",
        description: "Read an integer N (N >= 2) followed by N integers. Print the second largest unique value: 'SECOND: <val>'. If all elements are equal, print 'NO SECOND'.",
        code_snippet: `// Fix this C program to find the second largest distinct number
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);

    // BUG: Fails with negative numbers and duplicate max values
    int max = 0, second = 0;
    for (int i = 0; i < n; i++) {
        if (arr[i] > max) {
            second = max;
            max = arr[i];
        } else if (arr[i] > second) {
            second = arr[i];
        }
    }

    printf("SECOND: %d\\n", second);
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n < 2) return 0;

    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);

    int has_max = 0, has_second = 0;
    int max_val = 0, second_val = 0;

    for (int i = 0; i < n; i++) {
        int v = arr[i];
        if (!has_max || v > max_val) {
            if (has_max) {
                second_val = max_val;
                has_second = 1;
            }
            max_val = v;
            has_max = 1;
        } else if (v < max_val) {
            if (!has_second || v > second_val) {
                second_val = v;
                has_second = 1;
            }
        }
    }

    if (has_second) {
        printf("SECOND: %d\\n", second_val);
    } else {
        printf("NO SECOND\\n");
    }
    return 0;
}
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "5\n10 50 20 50 30\n", output: "SECOND: 30" },
            { input: "4\n-10 -5 -20 -2\n", output: "SECOND: -5" },
            { input: "3\n7 7 7\n", output: "NO SECOND" },
            { input: "2\n100 200\n", output: "SECOND: 100" }
        ],
        order: 3
    },

    // ==========================================
    // C PROGRAMMING - SET B
    // ==========================================
    {
        set: 'C_B',
        title: "Reverse Integer and Check Palindrome",
        description: "Read an integer N. Print its reversed integer value and whether it is a palindrome: 'REVERSED: <val>\\nPALINDROME: YES/NO'.",
        code_snippet: `// Fix this C program to reverse an integer and check palindrome
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);

    // BUG: While loop mutates n so palindrome check fails
    int rev = 0;
    while (n != 0) {
        rev = rev * 10 + n % 10;
        n /= 10;
    }

    printf("REVERSED: %d\\n", rev);
    if (n == rev) printf("PALINDROME: YES\\n");
    else printf("PALINDROME: NO\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    int orig = n;
    int is_neg = n < 0;
    int temp = n < 0 ? -n : n;

    int rev = 0;
    while (temp > 0) {
        rev = rev * 10 + (temp % 10);
        temp /= 10;
    }
    if (is_neg) rev = -rev;

    printf("REVERSED: %d\\n", rev);
    if (orig >= 0 && orig == rev) printf("PALINDROME: YES\\n");
    else printf("PALINDROME: NO\\n");
    return 0;
}
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "12321\n", output: "REVERSED: 12321\nPALINDROME: YES" },
            { input: "1234\n", output: "REVERSED: 4321\nPALINDROME: NO" },
            { input: "7\n", output: "REVERSED: 7\nPALINDROME: YES" },
            { input: "100\n", output: "REVERSED: 1\nPALINDROME: NO" }
        ],
        order: 1
    },
    {
        set: 'C_B',
        title: "Find All Primes in Range",
        description: "Read two positive integers A and B (A <= B). Print all prime numbers between A and B inclusive separated by spaces. If none, print 'NONE'.",
        code_snippet: `// Fix this C program to find prime numbers in range
#include <stdio.h>

int main() {
    int a, b;
    scanf("%d %d", &a, &b);

    // BUG: Considers 1 as prime and inner loop limit is wrong
    int found = 0;
    for (int i = a; i <= b; i++) {
        int prime = 1;
        for (int j = 2; j < i; j++) {
            if (i % j == 0) { prime = 0; break; }
        }
        if (prime) {
            if (found) printf(" ");
            printf("%d", i);
            found++;
        }
    }
    if (!found) printf("NONE");
    printf("\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>

int is_prime(int n) {
    if (n < 2) return 0;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return 0;
    }
    return 1;
}

int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) != 2) return 0;

    int found = 0;
    for (int i = a; i <= b; i++) {
        if (is_prime(i)) {
            if (found > 0) printf(" ");
            printf("%d", i);
            found++;
        }
    }
    if (found == 0) printf("NONE");
    printf("\\n");
    return 0;
}
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "1 10\n", output: "2 3 5 7" },
            { input: "20 30\n", output: "23 29" },
            { input: "8 9\n", output: "NONE" },
            { input: "13 13\n", output: "13" }
        ],
        order: 2
    },
    {
        set: 'C_B',
        title: "Matrix Transpose 2D Array",
        description: "Read row count R and column count C, followed by R*C matrix integers. Output the transposed matrix (C rows, R columns).",
        code_snippet: `// Fix matrix transpose for non-square matrices
#include <stdio.h>

int main() {
    int r, c;
    scanf("%d %d", &r, &c);
    int mat[10][10];
    for (int i = 0; i < r; i++) {
        for (int j = 0; j < c; j++) {
            scanf("%d", &mat[i][j]);
        }
    }

    // BUG: Loop dimensions inverted
    for (int i = 0; i < r; i++) {
        for (int j = 0; j < c; j++) {
            printf("%d ", mat[j][i]);
        }
        printf("\\n");
    }
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int r, c;
    if (scanf("%d %d", &r, &c) != 2) return 0;

    int mat[10][10];
    for (int i = 0; i < r; i++) {
        for (int j = 0; j < c; j++) {
            scanf("%d", &mat[i][j]);
        }
    }

    for (int j = 0; j < c; j++) {
        for (int i = 0; i < r; i++) {
            printf("%d", mat[i][j]);
            if (i < r - 1) printf(" ");
        }
        printf("\\n");
    }
    return 0;
}
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "2 3\n1 2 3\n4 5 6\n", output: "1 4\n2 5\n3 6" },
            { input: "1 3\n7 8 9\n", output: "7\n8\n9" },
            { input: "2 2\n1 0\n0 1\n", output: "1 0\n0 1" }
        ],
        order: 3
    },

    // ==========================================
    // C PROGRAMMING - SET C
    // ==========================================
    {
        set: 'C_C',
        title: "Sort Array in Ascending Order",
        description: "Read an integer N followed by N integers. Print the sorted elements separated by single spaces.",
        code_snippet: `// Fix this bubble sort implementation
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int a[100];
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);

    // BUG: Index out of bounds in bubble sort
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (a[j] > a[j + 1]) {
                int t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;
            }
        }
    }

    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int a[100];
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);

    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                int t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;
            }
        }
    }

    for (int i = 0; i < n; i++) {
        printf("%d", a[i]);
        if (i < n - 1) printf(" ");
    }
    printf("\\n");
    return 0;
}
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "5\n4 2 5 1 3\n", output: "1 2 3 4 5" },
            { input: "4\n10 -2 3 0\n", output: "-2 0 3 10" },
            { input: "1\n99\n", output: "99" },
            { input: "3\n5 5 5\n", output: "5 5 5" }
        ],
        order: 1
    },
    {
        set: 'C_C',
        title: "Linear Search and Occurrence Counter",
        description: "Read N integers, followed by a target integer K. Output 'FOUND: <count> TIMES' or 'NOT FOUND'.",
        code_snippet: `// Fix this search program
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int k;
    scanf("%d", &k);

    // BUG: Breaks on first find instead of counting occurrences
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (arr[i] == k) {
            count++;
            break;
        }
    }

    if (count > 0) printf("FOUND: %d TIMES\\n", count);
    else printf("NOT FOUND\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int k;
    if (scanf("%d", &k) != 1) return 0;

    int count = 0;
    for (int i = 0; i < n; i++) {
        if (arr[i] == k) count++;
    }

    if (count > 0) printf("FOUND: %d TIMES\\n", count);
    else printf("NOT FOUND\\n");
    return 0;
}
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "6\n1 3 5 3 7 3\n3\n", output: "FOUND: 3 TIMES" },
            { input: "4\n10 20 30 40\n50\n", output: "NOT FOUND" },
            { input: "1\n42\n42\n", output: "FOUND: 1 TIMES" }
        ],
        order: 2
    },
    {
        set: 'C_C',
        title: "Sum of Square Matrix Diagonals",
        description: "Read integer N (size of N x N matrix), followed by N*N elements. Output the sum of the primary diagonal and secondary diagonal: 'PRIMARY: <p>\\nSECONDARY: <s>'.",
        code_snippet: `// Fix diagonal sum calculation
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int mat[10][10];
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) scanf("%d", &mat[i][j]);
    }

    // BUG: Secondary diagonal index out of bounds
    int p_sum = 0, s_sum = 0;
    for (int i = 0; i < n; i++) {
        p_sum += mat[i][i];
        s_sum += mat[i][n - i];
    }

    printf("PRIMARY: %d\\nSECONDARY: %d\\n", p_sum, s_sum);
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    int mat[10][10];
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) scanf("%d", &mat[i][j]);
    }

    int p_sum = 0, s_sum = 0;
    for (int i = 0; i < n; i++) {
        p_sum += mat[i][i];
        s_sum += mat[i][n - 1 - i];
    }

    printf("PRIMARY: %d\\nSECONDARY: %d\\n", p_sum, s_sum);
    return 0;
}
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "3\n1 2 3\n4 5 6\n7 8 9\n", output: "PRIMARY: 15\nSECONDARY: 15" },
            { input: "2\n1 2\n3 4\n", output: "PRIMARY: 5\nSECONDARY: 5" },
            { input: "1\n42\n", output: "PRIMARY: 42\nSECONDARY: 42" }
        ],
        order: 3
    },

    // ==========================================
    // C PROGRAMMING - SET D
    // ==========================================
    {
        set: 'C_D',
        title: "Count Vowels and Consonants in Word",
        description: "Read a word (up to 100 characters). Count and print: 'VOWELS: <v>\\nCONSONANTS: <c>'. Assume only alphabetic letters.",
        code_snippet: `// Fix vowel and consonant counter
#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main() {
    char s[100];
    scanf("%s", s);

    // BUG: Missing uppercase vowel checks
    int v = 0, c = 0;
    for (int i = 0; s[i] != '\\0'; i++) {
        char ch = s[i];
        if (ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u') v++;
        else c++;
    }

    printf("VOWELS: %d\\nCONSONANTS: %d\\n", v, c);
    return 0;
}
`,
        answer: `#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main() {
    char s[100];
    if (scanf("%s", s) != 1) return 0;

    int v = 0, c = 0;
    for (int i = 0; s[i] != '\\0'; i++) {
        char ch = tolower((unsigned char)s[i]);
        if (ch >= 'a' && ch <= 'z') {
            if (ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u') v++;
            else c++;
        }
    }

    printf("VOWELS: %d\\nCONSONANTS: %d\\n", v, c);
    return 0;
}
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "Programming\n", output: "VOWELS: 3\nCONSONANTS: 8" },
            { input: "AEIOU\n", output: "VOWELS: 5\nCONSONANTS: 0" },
            { input: "rhythm\n", output: "VOWELS: 0\nCONSONANTS: 6" }
        ],
        order: 1
    },
    {
        set: 'C_D',
        title: "Fibonacci Number at Position N",
        description: "Read an integer N (1-based index). Output 'FIB: <val>' where FIB(1)=1, FIB(2)=1, FIB(3)=2, FIB(4)=3, etc.",
        code_snippet: `// Fix Fibonacci calculation
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);

    // BUG: Off by one and fails for base cases
    int a = 0, b = 1, c = 0;
    for (int i = 1; i < n; i++) {
        c = a + b;
        a = b;
        b = c;
    }

    printf("FIB: %d\\n", c);
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    if (n == 1 || n == 2) {
        printf("FIB: 1\\n");
        return 0;
    }

    int a = 1, b = 1, c = 0;
    for (int i = 3; i <= n; i++) {
        c = a + b;
        a = b;
        b = c;
    }

    printf("FIB: %d\\n", c);
    return 0;
}
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "1\n", output: "FIB: 1" },
            { input: "5\n", output: "FIB: 5" },
            { input: "7\n", output: "FIB: 13" },
            { input: "10\n", output: "FIB: 55" }
        ],
        order: 2
    },
    {
        set: 'C_D',
        title: "Remove Duplicates from Sorted Array",
        description: "Read N, then N sorted integers. Print 'LEN: <k>' followed by the unique elements separated by spaces.",
        code_snippet: `// Fix remove duplicates from sorted array
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int a[100];
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);

    // BUG: Index logic corrupts unique elements
    int k = 0;
    for (int i = 1; i < n; i++) {
        if (a[i] == a[i - 1]) {
            a[k++] = a[i];
        }
    }

    printf("LEN: %d\\n", k);
    for (int i = 0; i < k; i++) printf("%d ", a[i]);
    printf("\\n");
    return 0;
}
`,
        answer: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) {
        printf("LEN: 0\\n\\n");
        return 0;
    }

    int a[100];
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);

    int k = 1;
    for (int i = 1; i < n; i++) {
        if (a[i] != a[k - 1]) {
            a[k++] = a[i];
        }
    }

    printf("LEN: %d\\n", k);
    for (int i = 0; i < k; i++) {
        printf("%d", a[i]);
        if (i < k - 1) printf(" ");
    }
    printf("\\n");
    return 0;
}
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "c",
        test_cases: [
            { input: "6\n1 1 2 2 3 4\n", output: "LEN: 4\n1 2 3 4" },
            { input: "5\n7 7 7 7 7\n", output: "LEN: 1\n7" },
            { input: "3\n10 20 30\n", output: "LEN: 3\n10 20 30" }
        ],
        order: 3
    },

    // ==========================================
    // PYTHON PROGRAMMING - SET A
    // ==========================================
    {
        set: 'PY_A',
        title: "Sum, Average, and Extrema of List",
        description: "Read an integer N on the first line, and N space-separated integers on the second line. Output:\\nSUM: <sum>\\nAVG: <avg with 2 decimals>\\nMAX: <max>\\nMIN: <min>",
        code_snippet: `# Fix Python sum, average and extrema calculation
import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines:
        return
    n = int(lines[0])
    # BUG: Strings compared instead of integers
    nums = lines[1:n+1]
    
    total = sum(nums)
    avg = total / n
    print(f"SUM: {total}")
    print(f"AVG: {avg:.2f}")
    print(f"MAX: {max(nums)}")
    print(f"MIN: {min(nums)}")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines:
        return
    n = int(lines[0])
    nums = [int(x) for x in lines[1:n+1]]
    
    total = sum(nums)
    avg = total / n
    print(f"SUM: {total}")
    print(f"AVG: {avg:.2f}")
    print(f"MAX: {max(nums)}")
    print(f"MIN: {min(nums)}")

if __name__ == "__main__":
    solve()
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "5\n10 20 30 40 50\n", output: "SUM: 150\nAVG: 30.00\nMAX: 50\nMIN: 10" },
            { input: "4\n-5 0 5 10\n", output: "SUM: 10\nAVG: 2.50\nMAX: 10\nMIN: -5" },
            { input: "1\n42\n", output: "SUM: 42\nAVG: 42.00\nMAX: 42\nMIN: 42" }
        ],
        order: 1
    },
    {
        set: 'PY_A',
        title: "Clean String Palindrome",
        description: "Read a string from standard input. Check if it is a palindrome considering ONLY alphanumeric characters and ignoring case. Print 'YES' or 'NO'.",
        code_snippet: `# Fix clean string palindrome checker
import sys

def is_palindrome():
    s = sys.stdin.read().strip()
    # BUG: Direct check fails on case and punctuation
    if s == s[::-1]:
        print("YES")
    else:
        print("NO")

if __name__ == "__main__":
    is_palindrome()
`,
        answer: `import sys

def is_palindrome():
    s = sys.stdin.read().strip()
    clean = [ch.lower() for ch in s if ch.isalnum()]
    if clean == clean[::-1]:
        print("YES")
    else:
        print("NO")

if __name__ == "__main__":
    is_palindrome()
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "A man, a plan, a canal: Panama\n", output: "YES" },
            { input: "race a car\n", output: "NO" },
            { input: "Was it a car or a cat I saw?\n", output: "YES" },
            { input: "hello\n", output: "NO" }
        ],
        order: 2
    },
    {
        set: 'PY_A',
        title: "Second Largest Unique Element",
        description: "Read space-separated integers from input. Print 'SECOND: <val>' for the second largest UNIQUE element. If no second unique element exists, print 'NO SECOND'.",
        code_snippet: `# Fix second largest element finder
import sys

def solve():
    nums = [int(x) for x in sys.stdin.read().split()]
    # BUG: Fails when max element is repeated
    nums.sort()
    if len(nums) < 2:
        print("NO SECOND")
    else:
        print(f"SECOND: {nums[-2]}")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    nums = [int(x) for x in sys.stdin.read().split()]
    unique = sorted(list(set(nums)), reverse=True)
    if len(unique) < 2:
        print("NO SECOND")
    else:
        print(f"SECOND: {unique[1]}")

if __name__ == "__main__":
    solve()
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "10 50 20 50 30\n", output: "SECOND: 30" },
            { input: "7 7 7 7\n", output: "NO SECOND" },
            { input: "-10 -20 -5 -2\n", output: "SECOND: -5" },
            { input: "100 200\n", output: "SECOND: 100" }
        ],
        order: 3
    },

    // ==========================================
    // PYTHON PROGRAMMING - SET B
    // ==========================================
    {
        set: 'PY_B',
        title: "Even and Odd Number Counter",
        description: "Read an integer N followed by N integers. Print:\\nEVEN: <count>\\nODD: <count>",
        code_snippet: `# Fix even and odd counter
import sys

def solve():
    data = sys.stdin.read().split()
    if not data: return
    n = int(data[0])
    nums = [int(x) for x in data[1:n+1]]
    
    # BUG: Inverted conditions
    even = sum(1 for x in nums if x % 2 != 0)
    odd = sum(1 for x in nums if x % 2 == 0)
    print(f"EVEN: {even}\\nODD: {odd}")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    data = sys.stdin.read().split()
    if not data: return
    n = int(data[0])
    nums = [int(x) for x in data[1:n+1]]
    
    even = sum(1 for x in nums if x % 2 == 0)
    odd = sum(1 for x in nums if x % 2 != 0)
    print(f"EVEN: {even}\\nODD: {odd}")

if __name__ == "__main__":
    solve()
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "5\n1 2 3 4 5\n", output: "EVEN: 2\nODD: 3" },
            { input: "4\n2 4 6 8\n", output: "EVEN: 4\nODD: 0" },
            { input: "3\n0 1 -2\n", output: "EVEN: 2\nODD: 1" }
        ],
        order: 1
    },
    {
        set: 'PY_B',
        title: "Prime Numbers in Range",
        description: "Read two positive integers A and B (A <= B) on one line. Print all prime numbers between A and B inclusive separated by spaces, or 'NONE'.",
        code_snippet: `# Fix prime range filter in Python
import sys

def is_prime(n):
    # BUG: Considers 1 as prime and range limit
    for i in range(2, n):
        if n % i == 0: return False
    return True

def solve():
    a, b = map(int, sys.stdin.read().split())
    primes = [str(x) for x in range(a, b + 1) if is_prime(x)]
    if primes:
        print(" ".join(primes))
    else:
        print("NONE")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2: return
    a, b = int(tokens[0]), int(tokens[1])
    primes = [str(x) for x in range(a, b + 1) if is_prime(x)]
    if primes:
        print(" ".join(primes))
    else:
        print("NONE")

if __name__ == "__main__":
    solve()
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "1 10\n", output: "2 3 5 7" },
            { input: "20 30\n", output: "23 29" },
            { input: "8 9\n", output: "NONE" },
            { input: "13 13\n", output: "13" }
        ],
        order: 2
    },
    {
        set: 'PY_B',
        title: "2D Matrix Transpose",
        description: "Read row count R and column count C, followed by R lines of C integers. Print the transposed matrix of C rows and R columns.",
        code_snippet: `# Fix matrix transpose in Python
import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines: return
    r, c = int(lines[0]), int(lines[1])
    idx = 2
    matrix = []
    for _ in range(r):
        row = [int(x) for x in lines[idx:idx+c]]
        matrix.append(row)
        idx += c
        
    # BUG: Fails on non-square matrices
    for i in range(r):
        row_str = " ".join(str(matrix[j][i]) for j in range(c))
        print(row_str)

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines: return
    r, c = int(lines[0]), int(lines[1])
    idx = 2
    matrix = []
    for _ in range(r):
        row = [int(x) for x in lines[idx:idx+c]]
        matrix.append(row)
        idx += c
        
    for j in range(c):
        print(" ".join(str(matrix[i][j]) for i in range(r)))

if __name__ == "__main__":
    solve()
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "2 3\n1 2 3\n4 5 6\n", output: "1 4\n2 5\n3 6" },
            { input: "1 3\n7 8 9\n", output: "7\n8\n9" },
            { input: "2 2\n1 0\n0 1\n", output: "1 0\n0 1" }
        ],
        order: 3
    },

    // ==========================================
    // PYTHON PROGRAMMING - SET C
    // ==========================================
    {
        set: 'PY_C',
        title: "Character Frequency Counter",
        description: "Read a string from input. Count the frequencies of all alphabetic characters (case-insensitive). Print each character in alphabetical order formatted as '<char>: <count>' on a new line.",
        code_snippet: `# Fix character frequency counter
import sys

def solve():
    s = sys.stdin.read()
    counts = {}
    for ch in s:
        # BUG: Doesn't normalize case and counts punctuation/whitespace
        counts[ch] = counts.get(ch, 0) + 1
        
    for k, v in counts.items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    s = sys.stdin.read()
    counts = {}
    for ch in s.lower():
        if ch.isalpha():
            counts[ch] = counts.get(ch, 0) + 1
            
    for k in sorted(counts.keys()):
        print(f"{k}: {counts[k]}")

if __name__ == "__main__":
    solve()
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "Hello World!\n", output: "d: 1\ne: 1\nh: 1\nl: 3\no: 2\nr: 1\nw: 1" },
            { input: "aAbBcC\n", output: "a: 2\nb: 2\nc: 2" },
            { input: "Python 3.12\n", output: "h: 1\nn: 1\no: 1\np: 1\nt: 1\ny: 1" }
        ],
        order: 1
    },
    {
        set: 'PY_C',
        title: "Find Common Elements in Two Lists",
        description: "Read two lines of space-separated integers. Print their common unique elements in ascending order separated by spaces. If none exist, print 'NONE'.",
        code_snippet: `# Fix common elements finder
import sys

def solve():
    lines = sys.stdin.read().strip().split('\\n')
    if len(lines) < 2: return
    list1 = [int(x) for x in lines[0].split()]
    list2 = [int(x) for x in lines[1].split()]
    
    # BUG: Preserves duplicates and unordered
    common = [x for x in list1 if x in list2]
    if common:
        print(" ".join(map(str, common)))
    else:
        print("NONE")

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    raw = sys.stdin.read().strip().split('\\n')
    lines = [l for l in raw if l.strip()]
    if len(lines) < 2: return
    set1 = set(int(x) for x in lines[0].split())
    set2 = set(int(x) for x in lines[1].split())
    
    common = sorted(list(set1 & set2))
    if common:
        print(" ".join(map(str, common)))
    else:
        print("NONE")

if __name__ == "__main__":
    solve()
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "1 2 3 4 5\n3 4 5 6 7\n", output: "3 4 5" },
            { input: "10 20 30\n40 50 60\n", output: "NONE" },
            { input: "5 5 1 2\n2 5 9\n", output: "2 5" }
        ],
        order: 2
    },
    {
        set: 'PY_C',
        title: "Flatten and Sort Matrix Elements",
        description: "Read row count R and column count C on the first line, followed by R*C matrix integers. Output all elements flattened and sorted in ascending numerical order separated by single spaces.",
        code_snippet: `# Fix matrix flatten and sort in Python
import sys

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2: return
    r, c = int(tokens[0]), int(tokens[1])
    # BUG: Alphabetical string sorting instead of numerical sorting
    nums = tokens[2:2+r*c]
    nums.sort()
    print(" ".join(nums))

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2: return
    r, c = int(tokens[0]), int(tokens[1])
    nums = [int(x) for x in tokens[2:2+r*c]]
    nums.sort()
    print(" ".join(map(str, nums)))

if __name__ == "__main__":
    solve()
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "2 3\n5 1 9\n2 8 3\n", output: "1 2 3 5 8 9" },
            { input: "3 1\n10\n-2\n5\n", output: "-2 5 10" },
            { input: "2 2\n4 4\n4 4\n", output: "4 4 4 4" }
        ],
        order: 3
    },

    // ==========================================
    // PYTHON PROGRAMMING - SET D
    // ==========================================
    {
        set: 'PY_D',
        title: "Word Order Reversal",
        description: "Read a sentence from standard input. Output the sentence with the word order reversed, separated by single spaces.",
        code_snippet: `# Fix word order reversal
import sys

def solve():
    s = sys.stdin.read().strip()
    # BUG: Reverses characters instead of words
    print(s[::-1])

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    s = sys.stdin.read().strip()
    words = s.split()
    print(" ".join(reversed(words)))

if __name__ == "__main__":
    solve()
`,
        difficulty: "easy",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "the sky is blue\n", output: "blue is sky the" },
            { input: "  hello world  \n", output: "world hello" },
            { input: "Python\n", output: "Python" }
        ],
        order: 1
    },
    {
        set: 'PY_D',
        title: "Balanced Parentheses Checker",
        description: "Read a string of brackets '()[]{}'. Determine if the brackets are properly closed and nested. Print 'BALANCED' or 'UNBALANCED'.",
        code_snippet: `# Fix parentheses balance checker
import sys

def is_balanced():
    s = sys.stdin.read().strip()
    # BUG: Simple count fails for order like '([)]'
    if s.count('(') == s.count(')') and s.count('[') == s.count(']') and s.count('{') == s.count('}'):
        print("BALANCED")
    else:
        print("UNBALANCED")

if __name__ == "__main__":
    is_balanced()
`,
        answer: `import sys

def is_balanced():
    s = sys.stdin.read().strip()
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in mapping.values():
            stack.append(ch)
        elif ch in mapping:
            if not stack or stack[-1] != mapping[ch]:
                print("UNBALANCED")
                return
            stack.pop()
    if not stack:
        print("BALANCED")
    else:
        print("UNBALANCED")

if __name__ == "__main__":
    is_balanced()
`,
        difficulty: "medium",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "()[]{}\n", output: "BALANCED" },
            { input: "([)]\n", output: "UNBALANCED" },
            { input: "{[]}\n", output: "BALANCED" },
            { input: "(((\n", output: "UNBALANCED" }
        ],
        order: 2
    },
    {
        set: 'PY_D',
        title: "Rotate Array by K Positions",
        description: "Read N and K on the first line, followed by N space-separated integers on the second line. Rotate the array to the right by K positions. Print the rotated elements separated by single spaces.",
        code_snippet: `# Fix array rotation in Python
import sys

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2: return
    n, k = int(tokens[0]), int(tokens[1])
    nums = [int(x) for x in tokens[2:n+2]]
    
    # BUG: Fails when K > N and slice order
    rotated = nums[k:] + nums[:k]
    print(" ".join(map(str, rotated)))

if __name__ == "__main__":
    solve()
`,
        answer: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) < 2: return
    n, k = int(tokens[0]), int(tokens[1])
    nums = [int(x) for x in tokens[2:n+2]]
    if n == 0: return
    
    k = k % n
    if k == 0:
        rotated = nums
    else:
        rotated = nums[-k:] + nums[:-k]
    print(" ".join(map(str, rotated)))

if __name__ == "__main__":
    solve()
`,
        difficulty: "hard",
        question_type: "full_edit",
        language: "python",
        test_cases: [
            { input: "7 3\n1 2 3 4 5 6 7\n", output: "5 6 7 1 2 3 4" },
            { input: "4 2\n-1 -100 3 99\n", output: "3 99 -1 -100" },
            { input: "3 0\n10 20 30\n", output: "10 20 30" },
            { input: "2 5\n1 2\n", output: "2 1" }
        ],
        order: 3
    }
];

async function main() {
    console.log(`\n=== VERIFYING ALL 24 QUESTIONS BEFORE DATABASE INSERTION ===\n`);
    
    const zipData = new Uint8Array(await Bun.file(wccfiles).arrayBuffer());
    
    let allPassed = true;
    for (const q of questions) {
        process.stdout.write(`Testing [${q.set}] ${q.title} (${q.language.toUpperCase()})... `);
        
        let batchRes: { results: any[] };
        if (q.language === "python") {
            batchRes = await execPythonBatch(q.answer, q.test_cases, { timeout: 5000 });
        } else {
            const runner = new WccRunner({
                zip: zipData,
                workerURL: wasiWorkerURL as any
            });
            await runner.readyPromise;
            batchRes = await runner.execBatch(q.answer, q.test_cases, { timeout: 5000 });
            runner.terminate();
        }
        
        const passedCount = batchRes.results.filter((r: any) => r.pass).length;
        if (passedCount === q.test_cases.length) {
            console.log(`PASS (${passedCount}/${q.test_cases.length})`);
        } else {
            console.log(`FAILED (${passedCount}/${q.test_cases.length})`);
            console.error(JSON.stringify(batchRes.results, null, 2));
            allPassed = false;
        }
    }
    
    if (!allPassed) {
        console.error("Some questions failed reference verification! Aborting seed.");
        process.exit(1);
    }
    
    console.log(`\n100% of questions passed verification! Seeding database now...\n`);
    await db.initDB();
    
    // Clear old debug questions and levels
    const { questions: oldQ } = await db.getAllDebugQuestions();
    for (const q of oldQ || []) {
        await db.deleteDebugQuestion(q.id);
    }
    const { levels: oldL } = await db.getAllDebugLevels();
    for (const l of oldL || []) {
        await db.deleteDebugLevel(l.id);
    }
    
    // Map titles + language to sets
    const titleToSet: Record<string, string> = {};
    for (const q of questions) {
        const setLabel = q.set.endsWith('_A') ? 'Set A' :
                         q.set.endsWith('_B') ? 'Set B' :
                         q.set.endsWith('_C') ? 'Set C' : 'Set D';
        const formattedTitle = `[${setLabel}] ${q.title}`;
        titleToSet[`${formattedTitle}_${q.language}`] = q.set;
        const { error } = await db.createDebugQuestion({
            title: formattedTitle,
            description: q.description,
            code_snippet: q.code_snippet,
            answer: q.answer,
            difficulty: q.difficulty,
            question_type: q.question_type,
            language: q.language,
            set_name: setLabel,
            test_cases: q.test_cases,
            order: q.order
        });
        if (error) {
            console.error(`Error inserting ${formattedTitle}:`, error);
            process.exit(1);
        }
    }

    // Reload inserted questions to obtain their assigned IDs
    const { questions: newQuestions } = await db.getAllDebugQuestions();
    const setIds: Record<string, number[]> = {
        C_A: [], C_B: [], C_C: [], C_D: [],
        PY_A: [], PY_B: [], PY_C: [], PY_D: []
    };
    for (const q of newQuestions || []) {
        const setKey = titleToSet[`${q.title}_${q.language}`];
        if (setKey && setIds[setKey]) {
            setIds[setKey].push(q.id);
        }
    }
    
    // Now create 8 Exam Levels for the 4 C Sets and 4 Python Sets
    const levelsToCreate = [
        { name: "C Programming - Set A", order: 1, setKey: 'C_A' },
        { name: "C Programming - Set B", order: 2, setKey: 'C_B' },
        { name: "C Programming - Set C", order: 3, setKey: 'C_C' },
        { name: "C Programming - Set D", order: 4, setKey: 'C_D' },
        { name: "Python Programming - Set A", order: 5, setKey: 'PY_A' },
        { name: "Python Programming - Set B", order: 6, setKey: 'PY_B' },
        { name: "Python Programming - Set C", order: 7, setKey: 'PY_C' },
        { name: "Python Programming - Set D", order: 8, setKey: 'PY_D' }
    ];
    
    console.log(`Creating 8 exam levels...`);
    for (const l of levelsToCreate) {
        const qids = setIds[l.setKey] || [];
        await db.createDebugLevel({
            name: l.name,
            order: l.order,
            question_ids: qids,
            duration: 3600
        });
        console.log(`Created '${l.name}' (IDs: ${qids.join(', ')})`);
    }
    
    console.log(`\n=== 4 SETS OF C AND 4 SETS OF PYTHON SUCCESSFULLY SEEDED INTO DB! ===\n`);
    process.exit(0);
}

main().catch(err => {
    console.error("Execution failed:", err);
    process.exit(1);
});
