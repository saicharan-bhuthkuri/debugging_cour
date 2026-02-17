# WCC Runner Library

A lightweight, high-performance C compiler and execution engine for Bun, Node.js, and the Browser. Powered by WebAssembly and WASI.

## Features
- **Isolated Execution**: Runs in a dedicated Web Worker using a virtualized filesystem.
- **Async API**: Simple `exec(source)` pattern.
- **Interactive**: Supports `stdin`, `stdout`, `stderr`, and `args`.
- **Security**: Built-in `timeout` support to kill long-running or infinite loops.

## Setup
Copy the `wcc-lib` folder into your project.

## Usage (Bun)
```typescript
import { WccRunner } from './wcc-lib';
import { join } from 'path';

// Load zip once
const zipData = await Bun.file(join(import.meta.dir, 'wcc-lib/wccfiles.zip')).arrayBuffer();

const runner = new WccRunner({
    zip: new Uint8Array(zipData)
});

const res = await runner.exec('#include <stdio.h>\nint main() { printf("Hello!\\n"); return 0; }', {
    timeout: 5000 // 5 second safety limit
});

console.log(res.stdout);
```

## API Reference

### `new WccRunner(options)`
- `zip`: URL string or `Uint8Array` of `wccfiles.zip`.

### `runner.exec(source, options)`
- `source`: C code string.
- `options`: 
    - `stdin`: Input string.
    - `args`: Command line arguments array.
    - `timeout`: Max execution time in ms.
- **Returns**: `{ stdin, stdout, stderr, exitCode }`

### `runner.terminate()`
Forcefully kills the runner's underlying worker.
