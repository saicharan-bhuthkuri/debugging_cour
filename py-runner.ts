import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export interface PythonExecOptions {
    stdin?: string;
    timeout?: number; // ms, defaults to 5000
    args?: string[];
}

export interface PythonExecResult {
    stdin: string;
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface TestCaseResult {
    pass: boolean;
    actualOutput: string;
    expectedOutput: string;
    error: string | null;
}

export interface BatchResult {
    compiled: boolean;
    error?: string;
    results: TestCaseResult[];
}

/**
 * Executes Python code using the system's Python runtime in an isolated temporary file environment.
 */
export async function runPythonCode(source: string, options: PythonExecOptions = {}): Promise<PythonExecResult> {
    const timeout = options.timeout || 5000;
    const tempFile = join(tmpdir(), `eval_${randomUUID()}.py`);
    await Bun.write(tempFile, source);

    try {
        const proc = Bun.spawn(["cmd.exe", "/c", "python", tempFile, ...(options.args || [])], {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe"
        });

        if (options.stdin != null && options.stdin.length > 0) {
            proc.stdin.write(options.stdin);
        }
        proc.stdin.end();

        let timer: any;
        const timeoutPromise = new Promise<{ timeout: boolean }>((resolve) => {
            timer = setTimeout(() => {
                try { proc.kill(); } catch {}
                resolve({ timeout: true });
            }, timeout);
        });

        const runPromise = (async () => {
            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();
            const exitCode = await proc.exited;
            return { timeout: false, stdout, stderr, exitCode };
        })();

        const result = await Promise.race([runPromise, timeoutPromise]);
        clearTimeout(timer);

        if (result.timeout) {
            throw new Error(`Execution timed out after ${timeout}ms`);
        }

        const out = result as { stdout: string; stderr: string; exitCode: number };
        return {
            stdin: options.stdin || "",
            stdout: out.stdout.replace(/\r\n/g, '\n'),
            stderr: out.stderr.replace(/\r\n/g, '\n'),
            exitCode: out.exitCode
        };
    } finally {
        try {
            await Bun.file(tempFile).delete();
        } catch {}
    }
}

/**
 * Evaluates Python source code against an array of test cases.
 */
export async function execPythonBatch(
    source: string,
    testCases: { input?: string; output?: string }[],
    options: PythonExecOptions = {}
): Promise<BatchResult> {
    const results: TestCaseResult[] = [];

    for (const tc of testCases) {
        try {
            const res = await runPythonCode(source, {
                stdin: tc.input || "",
                timeout: options.timeout || 5000
            });

            const actualOutput = res.stdout.trim();
            const expectedOutput = (tc.output || "").replace(/\r\n/g, '\n').trim();
            const pass = actualOutput === expectedOutput;

            results.push({
                pass,
                actualOutput,
                expectedOutput,
                error: pass
                    ? null
                    : (res.stderr || (res.exitCode !== 0 ? `Exit code ${res.exitCode}` : "Wrong Answer"))
            });
        } catch (err: any) {
            results.push({
                pass: false,
                actualOutput: "",
                expectedOutput: (tc.output || "").trim(),
                error: err.message || "Time limit exceeded or execution error"
            });
        }
    }

    return { compiled: true, results };
}
