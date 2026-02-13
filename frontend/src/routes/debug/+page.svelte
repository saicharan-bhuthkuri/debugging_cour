<script lang="ts">
    import "./debug.css";
</script>

<header>
    <div class="brand">
        <svg viewBox="0 0 24 24">
            <path
                d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
            />
        </svg>
        DEBUG_PROTOCOL // IDE
    </div>
    <div class="timer">14:59</div>
</header>

<main>
    <!-- Problem Statement -->
    <section class="panel-left">
        <div class="panel-header">Problem Overview</div>
        <div class="question-content">
            <h2>Fix the Array Sort Logic</h2>
            <p>
                There is a bug in the sorting algorithm implementation below. It
                is supposed to sort the array in ascending order, but it seems
                to be failing for certain test cases involving negative numbers.
            </p>

            <p><strong>Input:</strong> <code>[5, 2, 9, 1, 5, 6]</code></p>
            <p>
                <strong>Expected Output:</strong>
                <code>[1, 2, 5, 5, 6, 9]</code>
            </p>

            <div class="code-block">// Current Output [1, 2, 5, 5, 6, 9]</div>

            <p>
                Analyze the code in the editor, identify the logical error, and
                fix it to pass all test cases.
            </p>
        </div>
    </section>

    <!-- Code Editor -->
    <section class="panel-right">
        <div class="editor-tabs">
            <div class="tab">
                <svg viewBox="0 0 32 32">
                    <path d="M0 0h32v32H0z" fill="none" />
                    <path
                        d="M16 2L3 9.5 5 29l11 3 11-3 2-19.5L16 2z m0 26.5l-8-2.2-1.5-14.7L16 4.5l9.5 7.1-1.5 14.7-8 2.2z"
                        fill="#5c6bc0"
                    />
                    <path
                        d="M16 25c-5 0-9-4-9-9s4-9 9-9 9 4 9 9h-3c0-3.3-2.7-6-6-6s-6 2.7-6 6 2.7 6 6 6v3z"
                        fill="#fff"
                    />
                </svg>
                solution.c
            </div>
        </div>

        <div
            class="code-editor"
            contenteditable="true"
            spellcheck="false"
        ></div>

        <div class="action-bar">
            <button class="btn-run"> ▶ Run Code </button>
            <button class="btn-submit"> ✓ Submit Solution </button>
        </div>
    </section>
</main>
