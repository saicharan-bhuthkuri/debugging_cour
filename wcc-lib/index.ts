import { W as Runner } from './wcc-runner.js';

export interface ExecResult {
	stdin: string;
	stdout: string;
	stderr: string;
	exitCode: number;
}

export interface WccRunnerOptions {
	/** Path/URL to the zip file, or the zip data itself as Uint8Array */
	zip?: string | Uint8Array;
	/** Path/URL to the worker file */
	workerURL?: string | URL;
	/** Raw worker code as string */
	workerCode?: string;
}

export interface ExecOptions {
	stdin?: string;
	args?: string[];
	/** Execution timeout in milliseconds. If reached, the runner is terminated and an error is thrown. */
	timeout?: number;
}

/**
 * WccRunner provides a clean API to compile and execute C code in a WebAssembly isolation layer.
 */
export const WccRunner = Runner as unknown as {
	new(options?: WccRunnerOptions): {
		/**
		 * Compiles and executes the provided C source code.
		 * @param source The C source code string.
		 * @param options Execution options including stdin, args, and timeout.
		 * @returns A promise that resolves to the execution results.
		 * @throws Error if compilation fails or execution times out.
		 */
		exec(source: string, options?: ExecOptions): Promise<ExecResult>;

		/**
		 * Compiles C source code once to a.wasm.
		 */
		compile(source: string, options?: ExecOptions): Promise<{ exitCode: number; stdout: string; stderr: string }>;

		/**
		 * Executes the previously compiled a.wasm binary.
		 */
		runBinary(options?: ExecOptions): Promise<ExecResult>;

		/**
		 * Compiles source code once and evaluates multiple test cases sequentially.
		 */
		execBatch(
			source: string,
			testCases: { input?: string; output?: string }[],
			options?: ExecOptions
		): Promise<{
			compiled: boolean;
			error?: string;
			results: {
				pass: boolean;
				error?: string | null;
				actualOutput?: string;
				expectedOutput?: string;
			}[];
		}>;

		/**
		 * Forcefully terminates the underlying worker process.
		 */
		terminate(): void;

		/**
		 * Internal ready promise that resolves when the compiler environment is set up.
		 */
		readyPromise: Promise<void>;
	};
};
