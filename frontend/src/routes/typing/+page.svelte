<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import ExamGuard from "$lib/components/ExamGuard.svelte";
    import "./typing.css";

    // ── State ──
    let loading = $state(true);
    let testActive = $state(false);
    let testFinished = $state(false);
    let isFocused = $state(true);

    // Level config
    let levelName = $state("Typing Test");
    let timeLimit = $state(60);
    let passingAccuracy = $state(90);
    let attemptsAllowed = $state(2);
    let currentAttempt = $state(1);

    // Text & Typing State
    let fullText = $state("");
    let words: string[] = $state([]);
    let currentWordIndex = $state(0);
    let currentInput = $state("");
    let inputHistory: string[] = $state([]);

    // Per-second tracking for chart
    let wpmHistory: number[] = $state([]);
    let rawWpmHistory: number[] = $state([]);
    let accHistory: number[] = $state([]);

    // Stats
    let correctChars = $state(0);
    let incorrectChars = $state(0);
    let extraChars = $state(0);
    let missedChars = $state(0);
    let totalKeystrokes = $state(0);
    let timeElapsed = $state(0);
    let timeRemaining = $state(60);

    // Live Stats
    let liveWpm = $state(0);
    let liveAccuracy = $state(100);
    let liveRaw = $state(0);

    // Results
    let finalWpm = $state(0);
    let finalRaw = $state(0);
    let finalAccuracy = $state(0);
    let finalConsistency = $state(0);
    let passed = $state(false);

    // Timer
    let timerInterval: any = null;
    let lastInputTime = $state(0);
    let isTyping = $state(false);
    let typingTimeout: any = null;

    // DOM refs
    let inputRef = $state<HTMLInputElement>(null!);
    let wordsContainer = $state<HTMLDivElement>(null!);
    let caretRef = $state<HTMLDivElement>(null!);
    let wordsWrapperRef = $state<HTMLDivElement>(null!);

    // Line scroll state (like MonkeyType's lineJump)
    let currentTestLine = $state(0);
    let wordsMarginTop = $state(0);  // px margin-top for smooth scrolling
    let wordHeight = 0;              // height of one line of words

    // Session info
    let examSessionId: number | null = null;

    // Attempt history for "shadow" display
    let previousAttemptWords: { word: string; typed: string }[] = $state([]);

    onMount(async () => {
        const token = localStorage.getItem("login_token") || "";
        if (!token) { goto("/login"); return; }

        try {
            const system = await api("/system/status", "GET", null, token);
            if (!system || !system.assigned_to || system.status === 'completed') {
                goto("/thankyou");
                return;
            }

            examSessionId = parseInt(localStorage.getItem("exam_session_id") || "0") || null;

            // Fetch typing level from system
            try {
                const levelData = await api("/typing/level/current", "GET", null, token);
                if (levelData) {
                    levelName = levelData.name || "Typing Test";
                    timeLimit = levelData.time_limit || 60;
                    timeRemaining = timeLimit;
                    passingAccuracy = levelData.passing_accuracy || 90;
                    attemptsAllowed = levelData.attempts_allowed || 2;
                    
                    if (levelData.content && levelData.content.trim()) {
                        fullText = levelData.content.trim();
                    }
                }
            } catch (e) {
                console.warn("No typing level found, using defaults", e);
            }

            // If no content from level, use default text
            if (!fullText) {
                fullText = generateDefaultText();
            }

            initTest();
            loading = false;

        } catch (e) {
            console.error("Failed to load typing test", e);
            goto("/login");
        }
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval);
        if (typingTimeout) clearTimeout(typingTimeout);
    });

    function generateDefaultText(): string {
        const paragraphs = [
            "The quick brown fox jumps over the lazy dog. Every morning, the sun rises in the east and sets in the west. We often take the beauty of nature for granted.",
            "Programming is the art of telling a computer what to do. Variables store data, functions perform actions, and loops repeat tasks. Understanding these basics is key to mastery.",
            "Data structures organize information efficiently. Arrays store elements in sequence, linked lists connect nodes, and trees branch hierarchically. Choosing the right structure matters.",
            "Algorithms solve problems step by step. Sorting arranges data in order, searching finds specific values, and graphs model relationships. Efficiency is measured in time and space.",
            "The internet connects billions of devices worldwide. Protocols define communication rules, servers host content, and clients request resources. Every click triggers a chain of events.",
            "Debugging requires patience and careful observation. Read the error message, trace the execution path, and test your hypothesis. Most bugs are simple once you understand them.",
            "Version control tracks changes to code over time. Commits save snapshots, branches isolate features, and merges combine work. Git is the most widely used system today.",
            "Security protects systems from unauthorized access. Encryption scrambles data, authentication verifies identity, and authorization controls permissions. Every application needs security.",
        ];
        
        let text = "";
        const shuffled = [...paragraphs].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 5; i++) {
            text += shuffled[i % shuffled.length] + " ";
        }
        return text.trim();
    }

    function initTest() {
        words = fullText.split(/\s+/);
        currentWordIndex = 0;
        currentInput = "";
        inputHistory = [];
        wpmHistory = [];
        rawWpmHistory = [];
        accHistory = [];
        correctChars = 0;
        incorrectChars = 0;
        extraChars = 0;
        missedChars = 0;
        totalKeystrokes = 0;
        timeElapsed = 0;
        timeRemaining = timeLimit;
        liveWpm = 0;
        liveAccuracy = 100;
        liveRaw = 0;
        testActive = false;
        testFinished = false;
        currentTestLine = 0;
        wordsMarginTop = 0;
        wordHeight = 0;
        lastInputTime = 0;
        isFocused = true;
        isTyping = false;

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        tick().then(() => {
            if (inputRef) {
                inputRef.value = "";
                inputRef.focus();
            }
            measureWordHeight();
            updateCaretPosition();
        });
    }

    function measureWordHeight() {
        if (!wordsContainer) return;
        const firstWord = wordsContainer.querySelector('.word') as HTMLElement;
        if (!firstWord) return;
        const style = getComputedStyle(firstWord);
        wordHeight = firstWord.offsetHeight 
            + parseFloat(style.marginTop) 
            + parseFloat(style.marginBottom);
    }

    function startTimer() {
        if (timerInterval) return;
        testActive = true;
        lastInputTime = Date.now();

        timerInterval = setInterval(() => {
            timeElapsed++;
            timeRemaining = Math.max(0, timeLimit - timeElapsed);

            // Record stats per second
            if (timeElapsed > 0) {
                const wpm = Math.round((correctChars / 5) / (timeElapsed / 60));
                const raw = Math.round(((correctChars + incorrectChars) / 5) / (timeElapsed / 60));
                const total = correctChars + incorrectChars;
                const acc = total > 0 ? Math.round((correctChars / total) * 100) : 100;

                liveWpm = isFinite(wpm) && wpm >= 0 ? wpm : 0;
                liveRaw = isFinite(raw) && raw >= 0 ? raw : 0;
                liveAccuracy = acc;

                wpmHistory = [...wpmHistory, liveWpm];
                rawWpmHistory = [...rawWpmHistory, liveRaw];
                accHistory = [...accHistory, liveAccuracy];
            }

            if (timeRemaining <= 0) {
                finishTest();
            }
        }, 1000);
    }

    // ── Caret blink control ──
    function setTypingState() {
        isTyping = true;
        lastInputTime = Date.now();
        if (typingTimeout) clearTimeout(typingTimeout);
        // Resume blinking after 500ms of no input (like MonkeyType)
        typingTimeout = setTimeout(() => {
            isTyping = false;
        }, 500);
    }

    function handleInput(e: Event) {
        if (testFinished) return;

        const target = e.target as HTMLInputElement;
        currentInput = target.value;
        totalKeystrokes++;

        if (!testActive) {
            startTimer();
        }

        setTypingState();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (testFinished) return;

        if (e.key === " ") {
            e.preventDefault();
            if (currentInput.length === 0) return;

            // Process completed word
            processWord();
        } else if (e.key === "Backspace" && e.ctrlKey) {
            e.preventDefault();
            currentInput = "";
            if (inputRef) inputRef.value = "";
        } else if (e.key === "Backspace" && !e.ctrlKey) {
            // Allow normal backspace but also go back to previous word if at start
            if (currentInput.length === 0 && currentWordIndex > 0) {
                e.preventDefault();
                // Go back to previous word (MonkeyType behavior)
                currentWordIndex--;
                const prevTyped = inputHistory.pop() || "";
                inputHistory = [...inputHistory]; // trigger reactivity
                currentInput = prevTyped;
                if (inputRef) inputRef.value = prevTyped;
                
                // Recalculate chars for the word we're going back to
                // We need to undo the char counting from processWord
                const expected = words[currentWordIndex] || "";
                const minLen = Math.min(expected.length, prevTyped.length);
                for (let i = 0; i < minLen; i++) {
                    if (prevTyped[i] === expected[i]) correctChars--;
                    else incorrectChars--;
                }
                if (prevTyped.length > expected.length) {
                    const extra = prevTyped.length - expected.length;
                    extraChars -= extra;
                    incorrectChars -= extra;
                }
                if (prevTyped.length < expected.length) {
                    missedChars -= (expected.length - prevTyped.length);
                }
                correctChars--; // undo the space char

                tick().then(() => {
                    checkLineScroll();
                    updateCaretPosition();
                });
            }
        }
    }

    function processWord() {
        const expected = words[currentWordIndex] || "";
        const typed = currentInput;

        // Count chars
        const minLen = Math.min(expected.length, typed.length);
        for (let i = 0; i < minLen; i++) {
            if (typed[i] === expected[i]) {
                correctChars++;
            } else {
                incorrectChars++;
            }
        }

        // Extra chars typed
        if (typed.length > expected.length) {
            extraChars += typed.length - expected.length;
            incorrectChars += typed.length - expected.length;
        }

        // Missed chars
        if (typed.length < expected.length) {
            missedChars += expected.length - typed.length;
        }

        // Space counts as correct char
        correctChars++;

        inputHistory = [...inputHistory, typed];
        currentWordIndex++;
        currentInput = "";
        if (inputRef) inputRef.value = "";

        // Check if ALL words have been typed → stop immediately!
        if (currentWordIndex >= words.length) {
            finishTest();
            return;
        }

        // Handle line scrolling with animation
        tick().then(() => {
            checkLineScroll();
            updateCaretPosition();
        });
    }

    // ── Line scrolling (like MonkeyType's lineJump) ──
    function checkLineScroll() {
        if (!wordsContainer) return;
        
        const activeWord = wordsContainer.querySelector('.word.active') as HTMLElement;
        if (!activeWord) return;

        if (!wordHeight) measureWordHeight();

        const activeTop = activeWord.offsetTop;
        
        // MonkeyType shows 3 lines. When the active word moves to the 3rd line,
        // scroll up so it's on the 2nd line again.
        // We scroll when the active word is on line 3+ (after top exceeds 2 * wordHeight)
        const maxVisibleTop = wordHeight * 2;
        
        if (activeTop - wordsMarginTop * -1 > maxVisibleTop) { // correction for margin
            // Calculate new margin to hide the top line
            const newMarginTop = -(activeTop - wordHeight);
            
            // Animate the margin change (like MonkeyType's smooth line scroll)
            if (wordsContainer) {
                wordsContainer.style.transition = 'margin-top 125ms ease';
                wordsMarginTop = newMarginTop;
                wordsContainer.style.marginTop = `${newMarginTop}px`;
                
                // After animation, remove transition to avoid interfering
                setTimeout(() => {
                    if (wordsContainer) {
                        wordsContainer.style.transition = '';
                    }
                }, 130);
            }
            currentTestLine++;
        }
    }

    function updateCaretPosition() {
        if (!caretRef || !wordsContainer) return;

        const activeWord = wordsContainer.querySelector('.word.active') as HTMLElement;
        if (!activeWord) return;

        const letters = activeWord.querySelectorAll('.letter:not(.extra)');
        const inputLen = currentInput.length;

        // Get the words container position for relative calculation
        const containerRect = wordsContainer.getBoundingClientRect();

        if (inputLen < letters.length) {
            // Before a letter → caret goes on the left of that letter
            const letter = letters[inputLen] as HTMLElement;
            const letterRect = letter.getBoundingClientRect();

            caretRef.style.left = `${letterRect.left - containerRect.left}px`;
            caretRef.style.top = `${letterRect.top - containerRect.top}px`;
            caretRef.style.height = `${letterRect.height}px`;
            caretRef.style.width = `${letterRect.width}px`; // for block/outline style
        } else {
            // Past the word → go to right edge of last letter, or handle extra letters
            const allLetters = activeWord.querySelectorAll('.letter');
            if (allLetters.length > 0) {
                const lastLetter = allLetters[allLetters.length - 1] as HTMLElement;
                const lastRect = lastLetter.getBoundingClientRect();

                caretRef.style.left = `${lastRect.right - containerRect.left}px`;
                caretRef.style.top = `${lastRect.top - containerRect.top}px`;
                caretRef.style.height = `${lastRect.height}px`;
                caretRef.style.width = `2.5px`; // thin at end
            }
        }
    }

    // Reactive caret updates — track input + word index changes
    $effect(() => {
        currentInput;
        currentWordIndex;
        tick().then(() => updateCaretPosition());
    });

    function finishTest() {
        if (testFinished) return;
        testFinished = true;
        testActive = false;

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        // Process current incomplete word if any
        if (currentInput.length > 0 && currentWordIndex < words.length) {
            const expected = words[currentWordIndex] || "";
            const typed = currentInput;
            const minLen = Math.min(expected.length, typed.length);
            for (let i = 0; i < minLen; i++) {
                if (typed[i] === expected[i]) correctChars++;
                else incorrectChars++;
            }
            if (typed.length > expected.length) {
                extraChars += typed.length - expected.length;
                incorrectChars += typed.length - expected.length;
            }
            if (typed.length < expected.length) {
                missedChars += expected.length - typed.length;
            }
            // Don't forget to record this word too
            inputHistory = [...inputHistory, typed];
            currentWordIndex++;
        }

        // Save previous attempt data for "shadow" display
        previousAttemptWords = words.map((w, i) => ({
            word: w,
            typed: inputHistory[i] || ""
        }));

        // Calculate final stats
        const elapsed = timeElapsed > 0 ? timeElapsed : 1;
        finalWpm = Math.round((correctChars / 5) / (elapsed / 60));
        finalRaw = Math.round(((correctChars + incorrectChars) / 5) / (elapsed / 60));
        const total = correctChars + incorrectChars;
        finalAccuracy = total > 0 ? Math.round((correctChars / total) * 100) : 100;

        // Calculate consistency (std deviation of WPM history)
        if (wpmHistory.length > 1) {
            const mean = wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length;
            const variance = wpmHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / wpmHistory.length;
            const stdDev = Math.sqrt(variance);
            finalConsistency = mean > 0 ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / mean) * 100))) : 0;
        } else {
            finalConsistency = 100;
        }

        // Clamp values
        finalWpm = Math.max(0, finalWpm);
        finalRaw = Math.max(0, finalRaw);
        
        // Pass/Fail
        passed = finalAccuracy >= passingAccuracy;

        // Log result to server
        logResult();
    }

    async function logResult() {
        try {
            const token = localStorage.getItem("login_token") || "";
            const sessionId = examSessionId || parseInt(localStorage.getItem("exam_session_id") || "0");

            await api("/system/log", "POST", {
                session_id: sessionId,
                type: "TYPING_RESULT",
                data: {
                    timestamp: new Date().toISOString(),
                    level_name: levelName,
                    attempt: currentAttempt,
                    wpm: finalWpm,
                    raw_wpm: finalRaw,
                    accuracy: finalAccuracy,
                    consistency: finalConsistency,
                    correct_chars: correctChars,
                    incorrect_chars: incorrectChars,
                    extra_chars: extraChars,
                    missed_chars: missedChars,
                    total_keystrokes: totalKeystrokes,
                    time_elapsed: timeElapsed,
                    time_limit: timeLimit,
                    words_completed: currentWordIndex,
                    total_words: words.length,
                    passed: passed,
                    wpm_history: wpmHistory,
                    raw_wpm_history: rawWpmHistory,
                    acc_history: accHistory
                }
            }, token);
        } catch (e) {
            console.error("Failed to log typing result", e);
        }
    }

    function restartTest() {
        // Only increment attempt AFTER the test is finished and before restart
        if (testFinished && currentAttempt < attemptsAllowed) {
            currentAttempt++;
            initTest();
        }
    }

    async function finishExam() {
        try {
            const token = localStorage.getItem("login_token") || "";
            await api("/system/finish", "POST", { 
                session_id: examSessionId, 
                reason: "typing_complete" 
            }, token);
        } catch (e) {
            console.error("Failed to finish exam", e);
        }
        goto("/thankyou");
    }

    function focusInput() {
        if (inputRef && !testFinished) {
            inputRef.focus();
            isFocused = true;
        }
    }

    function handleBlur() {
        if (!testFinished) {
            isFocused = false;
        }
    }

    // Helpers
    function formatTime(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function getLetterClass(wordIndex: number, charIndex: number): string {
        if (wordIndex < currentWordIndex) {
            // Already typed word
            const typed = inputHistory[wordIndex] || "";
            const expected = words[wordIndex] || "";
            if (charIndex < typed.length) {
                return typed[charIndex] === expected[charIndex] ? "letter correct" : "letter incorrect";
            } else {
                return "letter incorrect"; // missed char
            }
        } else if (wordIndex === currentWordIndex) {
            // Current word
            const expected = words[wordIndex] || "";
            if (charIndex < currentInput.length) {
                return currentInput[charIndex] === expected[charIndex] ? "letter correct" : "letter incorrect";
            }
            return "letter";
        }
        return "letter";
    }

    function getExtraLetters(wordIndex: number): string {
        if (wordIndex < currentWordIndex) {
            const typed = inputHistory[wordIndex] || "";
            const expected = words[wordIndex] || "";
            if (typed.length > expected.length) {
                return typed.slice(expected.length);
            }
        } else if (wordIndex === currentWordIndex) {
            const expected = words[wordIndex] || "";
            if (currentInput.length > expected.length) {
                return currentInput.slice(expected.length);
            }
        }
        return "";
    }

    function isWordError(wordIndex: number): boolean {
        if (wordIndex >= currentWordIndex) return false;
        const typed = inputHistory[wordIndex] || "";
        return typed !== words[wordIndex];
    }

    // Draw chart when results are shown
    let chartCanvas = $state<HTMLCanvasElement>(null!);

    $effect(() => {
        if (testFinished && chartCanvas && wpmHistory.length > 0) {
            tick().then(() => drawChart());
        }
    });

    function drawChart() {
        if (!chartCanvas) return;
        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = chartCanvas.getBoundingClientRect();
        chartCanvas.width = rect.width * dpr;
        chartCanvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        // Clear
        ctx.clearRect(0, 0, w, h);

        if (wpmHistory.length === 0) return;

        const maxWpm = Math.max(...wpmHistory, ...rawWpmHistory, 10);
        const xStep = plotW / Math.max(1, wpmHistory.length - 1);

        // Grid lines
        ctx.strokeStyle = 'rgba(100, 102, 105, 0.2)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }

        // Y-axis labels
        ctx.fillStyle = '#646669';
        ctx.font = '10px "Lexend Deca", monospace';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxWpm * (1 - i / 4));
            const y = padding.top + (plotH / 4) * i;
            ctx.fillText(val.toString(), padding.left - 5, y + 3);
        }

        // X-axis labels
        ctx.textAlign = 'center';
        const xLabels = Math.min(wpmHistory.length, 10);
        const xLabelStep = Math.max(1, Math.floor(wpmHistory.length / xLabels));
        for (let i = 0; i < wpmHistory.length; i += xLabelStep) {
            const x = padding.left + i * xStep;
            ctx.fillText(`${i + 1}s`, x, h - padding.bottom + 15);
        }

        // Draw raw WPM line (faded)
        drawLine(ctx, rawWpmHistory, maxWpm, padding, plotW, plotH, xStep, 'rgba(100, 102, 105, 0.4)', 1.5);

        // Draw WPM line
        drawLine(ctx, wpmHistory, maxWpm, padding, plotW, plotH, xStep, '#e2b714', 2);

        // Draw WPM area fill
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + plotH);
        wpmHistory.forEach((val, i) => {
            const x = padding.left + i * xStep;
            const y = padding.top + plotH - (val / maxWpm) * plotH;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(padding.left + (wpmHistory.length - 1) * xStep, padding.top + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
        grad.addColorStop(0, 'rgba(226, 183, 20, 0.12)');
        grad.addColorStop(1, 'rgba(226, 183, 20, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    function drawLine(ctx: CanvasRenderingContext2D, data: number[], maxVal: number, padding: any, plotW: number, plotH: number, xStep: number, color: string, lineWidth: number) {
        if (data.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        data.forEach((val, i) => {
            const x = padding.left + i * xStep;
            const y = padding.top + plotH - (val / maxVal) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
</script>

<ExamGuard examMode={true} enableFullscreen={true} enableCopyPaste={true}>

{#if loading}
    <div class="mt-loading">
        <div class="mt-loading-spinner"></div>
        <span>loading...</span>
    </div>
{:else if testFinished}
    <!-- ═══ RESULTS SCREEN ═══ -->
    <div class="mt-result-overlay">
        <div class="mt-result">
            <div class="mt-result-header">
                <h1>{levelName} — Results</h1>
                <span class="pass-badge {passed ? 'passed' : 'failed'}">
                    {passed ? '✓ PASSED' : '✗ FAILED'}
                </span>
            </div>

            <div class="mt-result-stats">
                <div class="mt-result-big-stat">
                    <span class="value">{finalWpm}</span>
                    <span class="label">wpm</span>
                </div>
                <div class="mt-result-big-stat">
                    <span class="value" style="color: {finalAccuracy >= passingAccuracy ? '#a6e3a1' : 'var(--mt-error)'}">{finalAccuracy}%</span>
                    <span class="label">acc</span>
                </div>
                <div class="mt-result-chart">
                    <canvas bind:this={chartCanvas} style="width: 100%; height: 200px;"></canvas>
                </div>
            </div>

            <div class="mt-result-details">
                <div class="mt-result-detail-card accent">
                    <span class="value">{finalRaw}</span>
                    <span class="label">raw</span>
                </div>
                <div class="mt-result-detail-card">
                    <span class="value">{finalConsistency}%</span>
                    <span class="label">consistency</span>
                </div>
                <div class="mt-result-detail-card success">
                    <span class="value">{correctChars}</span>
                    <span class="label">correct</span>
                </div>
                <div class="mt-result-detail-card danger">
                    <span class="value">{incorrectChars}</span>
                    <span class="label">incorrect</span>
                </div>
                <div class="mt-result-detail-card">
                    <span class="value">{missedChars}</span>
                    <span class="label">missed</span>
                </div>
                <div class="mt-result-detail-card">
                    <span class="value">{formatTime(timeElapsed)}</span>
                    <span class="label">time</span>
                </div>
                <div class="mt-result-detail-card">
                    <span class="value">{currentWordIndex}</span>
                    <span class="label">words</span>
                </div>
                <div class="mt-result-detail-card">
                    <span class="value">{currentAttempt}/{attemptsAllowed}</span>
                    <span class="label">attempt</span>
                </div>
            </div>

            <!-- Character Breakdown -->
            <div class="mt-char-breakdown" style="margin-bottom: 1rem;">
                <span class="correct-chars">{correctChars}</span>
                <span class="sep">/</span>
                <span class="incorrect-chars">{incorrectChars}</span>
                <span class="sep">/</span>
                <span class="extra-chars">{extraChars}</span>
                <span style="color: var(--mt-sub); margin-left: 0.5rem; font-size: 0.65rem;">(correct / incorrect / extra)</span>
            </div>

            <div class="mt-result-actions">
                {#if currentAttempt < attemptsAllowed}
                    <button class="mt-action-btn primary" onclick={restartTest}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        next attempt ({currentAttempt + 1}/{attemptsAllowed})
                    </button>
                {/if}
                <button class="mt-action-btn" onclick={finishExam}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    finish exam
                </button>
            </div>
        </div>
    </div>
{:else}
    <!-- ═══ TEST SCREEN ═══ -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="typing-page" onclick={focusInput}>
        <!-- Header -->
        <div class="mt-header">
            <div class="mt-logo">
                <svg class="mt-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
                </svg>
                <span class="mt-logo-text"><span>type</span>test</span>
            </div>
            <div class="mt-user-info">
                <div class="mt-user-badge">
                    <span class="dot"></span>
                    {levelName}
                </div>
            </div>
        </div>

        <!-- Config Bar -->
        <div class="mt-config">
            <div class="mt-config-inner">
                <div class="mt-config-item">
                    <span class="label">mode</span>
                    <span class="value">time</span>
                </div>
                <div class="mt-config-sep"></div>
                <div class="mt-config-item">
                    <span class="label">time</span>
                    <span class="value">{timeLimit}s</span>
                </div>
                <div class="mt-config-sep"></div>
                <div class="mt-config-item">
                    <span class="label">min acc</span>
                    <span class="value">{passingAccuracy}%</span>
                </div>
                <div class="mt-config-sep"></div>
                <div class="mt-config-item">
                    <span class="label">attempt</span>
                    <span class="value">{currentAttempt}/{attemptsAllowed}</span>
                </div>
            </div>
        </div>

        <!-- Live Stats -->
        <div class="mt-live-stats" class:visible={testActive}>
            <div class="mt-stat">
                <span class="mt-stat-value">{timeRemaining}</span>
                <span class="mt-stat-label">time</span>
            </div>
            <div class="mt-stat">
                <span class="mt-stat-value" style="color: var(--mt-text)">{liveWpm}</span>
                <span class="mt-stat-label">wpm</span>
            </div>
            <div class="mt-stat">
                <span class="mt-stat-value" style="color: {liveAccuracy < passingAccuracy ? 'var(--mt-error)' : 'var(--mt-text)'}">{liveAccuracy}%</span>
                <span class="mt-stat-label">acc</span>
            </div>
            <div class="mt-stat">
                <span class="mt-stat-value" style="color: var(--mt-sub)">{liveRaw}</span>
                <span class="mt-stat-label">raw</span>
            </div>
        </div>

        <!-- Words Container -->
        <div class="mt-words-wrapper" bind:this={wordsWrapperRef}>
            <div
                class="mt-words"
                class:blurred={!isFocused}
                bind:this={wordsContainer}
            >
                <!-- Caret (outline style by default — like MonkeyType "block" but we use outline) -->
                <div
                    class="mt-caret style-outline"
                    class:typing={isTyping}
                    bind:this={caretRef}
                ></div>

                {#each words as word, wi}
                    <div 
                        class="word"
                        class:active={wi === currentWordIndex}
                        class:typed={wi < currentWordIndex}
                        class:error={isWordError(wi)}
                    >
                        {#each word.split('') as char, ci}
                            <span class={getLetterClass(wi, ci)}>{char}</span>
                        {/each}
                        <!-- Extra characters -->
                        {#each getExtraLetters(wi).split('') as extra}
                            {#if extra}
                                <span class="letter extra">{extra}</span>
                            {/if}
                        {/each}
                    </div>
                {/each}
            </div>

            <!-- Focus Overlay -->
            <div class="mt-focus-overlay" class:visible={!isFocused}>
                <span class="mt-focus-text">click here or start typing to focus</span>
            </div>
        </div>

        <!-- Hidden Input -->
        <input
            class="mt-input"
            bind:this={inputRef}
            oninput={handleInput}
            onkeydown={handleKeydown}
            onblur={handleBlur}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
        />

        <!-- Timer Bar -->
        <div class="mt-timer-bar">
            <div class="mt-timer-track" class:visible={testActive}>
                <div class="mt-timer-fill" style="width: {(timeRemaining / timeLimit) * 100}%"></div>
            </div>
        </div>

        <!-- Restart -->
        <div class="mt-restart-area">
            <button class="mt-restart-btn" onclick={(e) => { e.stopPropagation(); initTest(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                restart test
            </button>
        </div>
    </div>
{/if}

</ExamGuard>

<style>
    /* Word-level styles — matches MonkeyType's #words .word structure */
    .word {
        position: relative;
        font-size: var(--mt-font-size, 1.5rem);
        line-height: 1em;
        margin: 0.25em 0.6em 0.25em 0;
        display: inline-block;
        vertical-align: top;
        font-family: 'Lexend Deca', 'Roboto Mono', monospace;
        border-bottom: 2px solid transparent;
    }

    .word.typed.error {
        border-bottom-color: var(--mt-error, #ca4754);
    }

    .word .letter {
        display: inline;
        color: var(--mt-sub, #646669);
        transition: none;
    }

    .word .letter.correct {
        color: var(--mt-correct, #d1d0c5);
    }

    .word .letter.incorrect {
        color: var(--mt-error, #ca4754);
    }

    .word .letter.extra {
        color: var(--mt-error-extra, #7e2a33);
    }
</style>
