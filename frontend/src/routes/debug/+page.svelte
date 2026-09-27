<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import { openDB } from "idb";
    import CodeEditor from "$lib/components/CodeEditor.svelte";
    import ExamGuard from "$lib/components/ExamGuard.svelte";
    import "./debug.css";

    let questions: any[] = $state([]);
    let currentIndex = $state(0);
    let timeRemaining = $state(900); // default 15:00, overridden by level duration
    let examSessionId = $state<number | null>(null);
    let currentSystemCode = $state("");
    let loading = $state(true);
    let showSubmitDialog = $state(false);
    let hasAutoTriggeredConfirm = $state(false);
    let runOutput = $state("");
    let runResults = $state<any[]>([]);
    let isRunning = $state(false);
    
    // State Map: questionId -> { status, answer, markedLines?, addedLines? }
    let questionStates = $state<Record<number, {
        status: string;
        answer: string;
        markedLines?: number[];
        addedLines?: { afterLine: number; content: string }[];
    }>>({});
    
    let dbPromise: Promise<any>;
    let timerInterval: any;

    const DB_NAME = "exam_session_db";
    const STORE_LOGS = "logs";
    const STORE_STATE = "state";

    onMount(async () => {
        // Initialize IDB
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_LOGS)) db.createObjectStore(STORE_LOGS, { keyPath: "id", autoIncrement: true });
                if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
            },
        });

        const idStr = localStorage.getItem("exam_session_id");
        if (idStr) examSessionId = parseInt(idStr);
        currentSystemCode = localStorage.getItem("system_code") || "";

        // Get duration from localStorage (set during exam start from login page)
        const savedDuration = localStorage.getItem("exam_duration");
        if (savedDuration) timeRemaining = parseInt(savedDuration);

        const token = localStorage.getItem("login_token") || "";
        if (!token) {
            goto("/login");
            return;
        }

        try {
            // Verify System Assignment
            const system = await api("/system/status", "GET", null, token);
            if (!system || !system.assigned_to || system.status === 'completed') {
                goto("/thankyou");
                return;
            }

            // Restore State
            const db = await dbPromise;
            const savedState = await db.get(STORE_STATE, "current_session");
            
            if (savedState && savedState.sessionId === examSessionId) {
                 questions = savedState.questions;
                 questionStates = savedState.questionStates;
                 currentIndex = savedState.currentIndex;
                 if (savedState.timeRemaining) timeRemaining = savedState.timeRemaining;
            } else {
                 // Fetch New Data
                 const token = localStorage.getItem("login_token") || "";
                 const [qs, ls] = await Promise.all([
                     api("/debug/question", "GET", null, token),
                     api("/debug/level", "GET", null, token)
                 ]);
                 
                 if (ls && qs) {
                      const qMap = new Map(qs.map((q: any) => [q.id, q]));
                      let orderedQs: any[] = [];
                      
                      ls.sort((a: any, b: any) => a.order_num - b.order_num);
                      ls.forEach((l: any) => {
                          if (l.question_ids && Array.isArray(l.question_ids)) {
                              l.question_ids.forEach((qid: number) => {
                                  if (qMap.has(qid)) {
                                      const q = qMap.get(qid);
                                      if (typeof q === 'object') {
                                          orderedQs.push({ ...q, level_id: l.id });
                                      }
                                  }
                              });
                          }
                      });
                      
                      if (orderedQs.length === 0) orderedQs = qs;
                      
                      const initialStates: Record<number, any> = {};
                      orderedQs.forEach(q => {
                          if (q && q.id) {
                             initialStates[q.id] = {
                                 status: 'unvisited',
                                 answer: q.code_snippet || "",
                                 markedLines: [],
                                 addedLines: []
                             };
                          }
                      });
                      
                      questionStates = initialStates;
                      questions = orderedQs;
                 }
            }

            loading = false;
            startTimer();
            
            // Sync any pending logs from previous offline sessions
            syncPendingLogs();
        } catch (e) {
            console.error("Failed to init exam", e);
            alert("Failed to load exam. Please refresh.");
        }
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval);
    });

    function startTimer() {
        timerInterval = setInterval(() => {
            timeRemaining--;
            saveState();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                finishExam(true);
            }
        }, 1000);
    }
    
    async function saveState() {
        const db = await dbPromise;
        const stateToSave = $state.snapshot({
             sessionId: examSessionId,
             questions,
             questionStates,
             currentIndex,
             timeRemaining,
             timestamp: Date.now()
        });
        await db.put(STORE_STATE, stateToSave, "current_session");
    }

    async function logAction(type: string, data: any = {}) {
        const snapshottedData = $state.snapshot(data);
        const payload = {
            session_id: examSessionId,
            type,
            data: { ...snapshottedData, timestamp: new Date().toISOString() }
        };

        const db = await dbPromise;
        const logEntry = { ...payload, synced: false };
        const key = await db.add(STORE_LOGS, logEntry);

        try {
             await api("/system/log", "POST", payload, localStorage.getItem("login_token") || "");
             // Mark as synced
             const stored = await db.get(STORE_LOGS, key);
             if (stored) {
                 stored.synced = true;
                 await db.put(STORE_LOGS, stored);
             }
        } catch (e) {
             console.error("Log failed upload, queued for re-sync", e);
        }
    }

    async function syncPendingLogs() {
        try {
            const db = await dbPromise;
            const allLogs = await db.getAll(STORE_LOGS);
            const pending = allLogs.filter((l: any) => !l.synced);
            
            if (pending.length === 0) return;

            const token = localStorage.getItem("login_token") || "";
            for (const log of pending) {
                try {
                    await api("/system/log", "POST", {
                        session_id: log.session_id,
                        type: log.type,
                        data: log.data
                    }, token);
                    // Mark as synced
                    log.synced = true;
                    await db.put(STORE_LOGS, log);
                } catch (e) {
                    // Still offline, stop trying
                    break;
                }
            }
        } catch (e) {
            console.error("Failed to sync pending logs", e);
        }
    }

    // Navigation
    function gotoQuestion(index: number) {
        if (index >= 0 && index < questions.length) {
            currentIndex = index;
            runOutput = ""; // Clear output on navigation
            runResults = [];
            if (questions[index] && questions[index].id) {
                // logAction("NAVIGATE", { question_id: questions[index].id, from: currentIndex });
            }
        }
    }

    function next() {
        if (currentIndex < questions.length - 1) gotoQuestion(currentIndex + 1);
    }
    
    function prev() {
        if (currentIndex > 0) gotoQuestion(currentIndex - 1);
    }

    // Actions
    async function handleRun() {
        if (currentQ && questionStates[currentQ.id]) {
            isRunning = true;
            runResults = [];
            runOutput = "Compiling and running tests...";
            
            try {
                const token = localStorage.getItem("login_token") || "";
                const res = await api("/debug/run", "POST", {
                    source_code: questionStates[currentQ.id].answer,
                    question_id: currentQ.id,
                    language: currentLanguage
                }, token);
                
                if (res && res.results) {
                    runResults = res.results;
                    const passed = runResults.filter(r => r.pass).length;
                    runOutput = `Result: ${passed}/${runResults.length} test cases passed.`;
                    
                    logAction("RUN_CODE", { 
                        question_id: currentQ.id, 
                        code: questionStates[currentQ.id].answer,
                        passed,
                        total: runResults.length
                    });
                } else if (res && res.message) {
                    runOutput = res.message;
                } else {
                    runOutput = "No test cases configured.";
                }
            } catch (e: any) {
                console.error("Run fail", e);
                runOutput = "Error: " + (e.message || "Execution failed");
            } finally {
                isRunning = false;
            }
        }
    }

    function handleSkip() {
        const q = questions[currentIndex];
        if (q && questionStates[q.id]) {
            questionStates[q.id].status = 'skipped';
            logAction("SKIP", { question_id: q.id });
            saveState();
            if (currentIndex < questions.length - 1) next();
        }
    }

    function handleHold() {
        const q = questions[currentIndex];
        if (q && questionStates[q.id]) {
            questionStates[q.id].status = 'hold';
            logAction("HOLD", { question_id: q.id, answer: questionStates[q.id].answer });
            saveState();
            if (currentIndex < questions.length - 1) next();
        }
    }

    async function handleSubmit() {
        const q = questions[currentIndex];
         if (q && questionStates[q.id]) {
            questionStates[q.id].status = 'submitted';
            const logData: any = {
                question_id: q.id,
                question_title: q.title || '',
                original_code: q.code_snippet || '',
                answer: questionStates[q.id].answer,
                question_type: q.question_type || 'full_edit',
                language: (q as any).language || 'c'
            };
            // Include mode-specific data
            if (q.question_type === 'find_buggy_line') {
                logData.marked_lines = questionStates[q.id].markedLines || [];
            }
            if (q.question_type === 'add_lines') {
                logData.added_lines = questionStates[q.id].addedLines || [];
            }
            
            try {
                // Ensure data is snapshotted before passing to logAction/saveState
                const finalLogData = $state.snapshot(logData);
                await logAction("SUBMIT", finalLogData);
                await saveState();
            } catch (err) {
                console.error("Error submitting:", err);
            }
            
            if (currentIndex < questions.length - 1) next();
        }
    }
    
    function confirmFinish() {
        showSubmitDialog = true;
    }

    function cancelFinish() {
        showSubmitDialog = false;
    }

    async function finishExam(force = false) {
        // Auto-submit ALL unsubmitted questions on final finish (timeout or confirm)
        questions.forEach(q => {
            const state = questionStates[q.id];
            if (state && state.status !== 'submitted') {
                state.status = 'submitted';
                logAction(force ? "AUTO_SUBMIT_TIMEOUT" : "AUTO_SUBMIT_FINAL", { 
                    question_id: q.id, 
                    question_title: q.title || '',
                    original_code: q.code_snippet || '',
                    answer: state.answer,
                    question_type: q.question_type || 'full_edit',
                    reason: state.status // skipped, hold, or unvisited
                });
            }
        });

        logAction("EXAM_FINISH", { reason: force ? "TIMEOUT" : "USER_INITIATED" });
        
        try {
            await api("/system/finish", "POST", { session_id: examSessionId, reason: "normal" }, localStorage.getItem("login_token") || "");
        } catch (e) {
            console.error("Failed to finish exam on server", e);
        }

        const db = await dbPromise;
        await db.delete(STORE_STATE, "current_session");
        
        goto("/thankyou"); 
    }

    // Auto-trigger final submit dialog when everything is submitted
    $effect(() => {
        if (questions.length > 0 && stats.submitted === questions.length) {
            if (!hasAutoTriggeredConfirm && !showSubmitDialog) {
                hasAutoTriggeredConfirm = true;
                showSubmitDialog = true;
            }
        } else {
            hasAutoTriggeredConfirm = false;
        }
    });

    // CodeEditor callbacks
    function handleCodeChange(value: string) {
        if (currentQ && questionStates[currentQ.id]) {
            questionStates[currentQ.id].answer = value;
        }
    }

    function handleMarkedLines(lines: number[]) {
        if (currentQ && questionStates[currentQ.id]) {
            questionStates[currentQ.id].markedLines = lines;
        }
    }

    function handleAddedLines(data: { afterLine: number; content: string }[]) {
        if (currentQ && questionStates[currentQ.id]) {
            questionStates[currentQ.id].addedLines = data;
        }
    }

    // Computed
    let currentQ = $derived(questions[currentIndex]);
    let currentState = $derived(currentQ ? questionStates[currentQ.id] : null);
    let isLastQuestion = $derived(currentIndex === questions.length - 1);
    let currentQuestionType = $derived((currentQ?.question_type || 'full_edit') as 'full_edit' | 'find_buggy_line' | 'add_lines' | 'missing_lines');
    let currentLanguage = $derived(((currentQ as any)?.language || 'c') as 'c' | 'python');

    function formatTime(sec: number) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function getStatusColor(status: string) {
        if (!status) return 'bg-white/5 border-white/10 text-white/50';
        switch (status) {
            case 'submitted': return 'bg-green-500/20 border-green-500 text-green-500';
            case 'hold': return 'bg-yellow-500/20 border-yellow-500 text-yellow-500';
            case 'skipped': return 'bg-orange-500/20 border-orange-500 text-orange-500';
            default: return 'bg-white/5 border-white/10 text-white/50';
        }
    }

    function getQTypeLabel(type: string) {
        switch(type) {
            case 'full_edit': return 'EDIT';
            case 'find_buggy_line': return 'FIND BUG';
            case 'add_lines': return 'ADD LINE';
            case 'missing_lines': return 'FILL IN';
            default: return 'EDIT';
        }
    }

    function getQTypeColor(type: string) {
        switch(type) {
            case 'full_edit': return 'type-edit';
            case 'find_buggy_line': return 'type-buggy';
            case 'add_lines': return 'type-add';
            case 'missing_lines': return 'type-missing';
            default: return 'type-edit';
        }
    }

    // Unique key for editor re-mounting on question change 
    let editorKey = $derived(currentQ ? `editor-${currentQ.id}` : 'editor-none');

    // Stats derived
    let stats = $derived({
        unvisited: questions.filter(q => questionStates[q.id]?.status === 'unvisited').length,
        skipped: questions.filter(q => questionStates[q.id]?.status === 'skipped').length,
        hold: questions.filter(q => questionStates[q.id]?.status === 'hold').length,
        submitted: questions.filter(q => questionStates[q.id]?.status === 'submitted').length,
    });
</script>

<ExamGuard examMode={true} enableFullscreen={true} enableCopyPaste={true}>
{#if loading}
    <div class="full-screen">Loading Exam...</div>
{:else}
    <header>
        <div class="header-left">
            <div class="brand">
                <svg viewBox="0 0 24 24">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                </svg>
                {currentSystemCode}
            </div>
            <span class="question-indicator">Q{currentIndex + 1}/{questions.length}</span>
            <span class="status-badge {getStatusColor(currentState?.status || 'unvisited')}">
                 {currentState?.status?.toUpperCase() || "UNVISITED"}
            </span>
            {#if currentQ}
                <span class="question-type-badge {getQTypeColor(currentQ.question_type || 'full_edit')}">
                    {getQTypeLabel(currentQ.question_type || 'full_edit')}
                </span>
            {/if}
        </div>
        <div class="header-right">
            <button class="btn-finish-header" onclick={confirmFinish}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right: 4px;">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                Final Submit
            </button>
            <div class="timer {timeRemaining < 60 ? 'danger' : ''}">
                {formatTime(timeRemaining)}
            </div>
        </div>
    </header>

    <main>
        <!-- Problem & Nav Panel -->
        <section class="panel-left">
            <div class="panel-header">
                <span>Problem {currentIndex + 1}</span>
            </div>
            
            <div class="question-content">
                <h2>{currentQ?.title}</h2>
                <div class="desc">
                    {@html currentQ?.description}
                </div>
                
                {#if currentQ?.question_type && currentQ.question_type !== 'full_edit'}
                    <div class="question-type-hint">
                        {#if currentQ.question_type === 'find_buggy_line'}
                            <div class="hint-icon">🐛</div>
                            <div>
                                <strong>Find the Bug</strong>
                                <p>Click on the lines you think contain bugs to mark them. Click again to unmark.</p>
                            </div>
                        {:else if currentQ.question_type === 'add_lines'}
                            <div class="hint-icon">➕</div>
                            <div>
                                <strong>Add Missing Lines</strong>
                                <p>Right-click on a line to insert a new editable line after it. Only added lines are editable.</p>
                            </div>
                        {:else if currentQ.question_type === 'missing_lines'}
                            <div class="hint-icon">📝</div>
                            <div>
                                <strong>Fill in the Blanks</strong>
                                <p>Only the highlighted lines are editable. Fill in the correct code for each blank line.</p>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Question Grid -->
            <div class="grid-section">
                <div class="grid-section-title">Questions</div>
                <div class="grid-nav">
                    {#each questions as q, i}
                        <button 
                            class="grid-item {getStatusColor(questionStates[q.id]?.status)} {i === currentIndex ? 'active-q' : ''}"
                            onclick={() => gotoQuestion(i)}
                            title="{getQTypeLabel(q.question_type || 'full_edit')}"
                        >
                            {i + 1}
                        </button>
                    {/each}
                </div>
            </div>
            
            <!-- Navigation -->
            <div class="nav-controls">
                <button class="btn-nav" onclick={prev} disabled={currentIndex === 0}>← Prev</button>
                <button class="btn-skip" onclick={handleSkip}>Skip</button>
                <button class="btn-hold" onclick={handleHold}>Hold</button>
                <div style="flex:1;"></div>
                <button class="btn-nav" onclick={next} disabled={isLastQuestion}>Next →</button>
            </div>
        </section>

        <!-- Code Editor Panel -->
        <section class="panel-right">
            <div class="editor-tabs">
                <div class="tab">
                    {#if currentLanguage === 'python'}
                        <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none">
                            <path d="M11.9 1.5c-3.1 0-5.4.6-5.4 2.7v2.3h5.6v.8H4.3c-2.4 0-4.3 1.9-4.3 4.3 0 2.2 1.6 3.9 3.7 4.2v-2.3c0-2.4 2-4.3 4.4-4.3h5.5v-.8H8v-2.3c0-1.8 1.8-3.1 3.9-3.1h4.6c1.3 0 2.3.9 2.3 2.1V7h.8c2.1 0 3.7 1.7 3.7 3.8v3.5c0 2.1-1.7 3.8-3.8 3.8h-1.6v-2.3c0-2.4-2-4.3-4.4-4.3H8.1v.8h5.6c1.7 0 3.1 1.4 3.1 3.1v3.9c0 1.9-1.9 3.1-3.9 3.1h-4.6c-1.3 0-2.3-.9-2.3-2.1V21h-.8C3.1 21 1.5 19.3 1.5 17.2V13.7" fill="#3776AB"/>
                        </svg>
                        solution.py
                    {:else}
                        <svg viewBox="0 0 32 32">
                            <path d="M0 0h32v32H0z" fill="none" />
                            <path d="M16 2L3 9.5 5 29l11 3 11-3 2-19.5L16 2z m0 26.5l-8-2.2-1.5-14.7L16 4.5l9.5 7.1-1.5 14.7-8 2.2z" fill="#5c6bc0" />
                            <path d="M16 25c-5 0-9-4-9-9s4-9 9-9 9 4 9 9h-3c0-3.3-2.7-6-6-6s-6 2.7-6 6 2.7 6 6 6v3z" fill="#fff" />
                        </svg>
                        solution.c
                    {/if}
                </div>
                <div class="ml-auto flex items-center pr-3">
                    <span class="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded {currentLanguage === 'python' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">
                        {currentLanguage === 'python' ? 'Python 3' : 'C99'}
                    </span>
                </div>
            </div>

            {#if currentQ && questionStates[currentQ.id]}
                {#key editorKey}
                    <CodeEditor
                        code={questionStates[currentQ.id].answer}
                        mode={currentQuestionType}
                        language={currentLanguage}
                        answerMeta={currentQ.answer_meta}
                        onchange={handleCodeChange}
                        onmarkedlines={handleMarkedLines}
                        onaddedlines={handleAddedLines}
                        addedLines={questionStates[currentQ.id].addedLines || []}
                    />
                {/key}
            {/if}

            <!-- Bottom Panel: Output + Actions -->
            <div class="bottom-panel">
                {#if runOutput || runResults.length > 0}
                    <div class="output-area {runResults.length > 0 ? 'has-results' : ''}">
                        <div class="results-header">
                            <div class="run-status">
                                <span class="prompt">&gt;</span> 
                                <span class="status-text">{runOutput}</span>
                            </div>
                            {#if runResults.length > 0}
                                <div class="stats-pills">
                                    <span class="pill pass">{runResults.filter(r => r.pass).length} Passed</span>
                                    <span class="pill fail">{runResults.filter(r => !r.pass).length} Failed</span>
                                </div>
                            {/if}
                        </div>
                        
                        {#if runResults.length > 0}
                            <div class="test-grid">
                                {#each runResults as res, i}
                                    <div class="test-item {res.pass ? 'pass' : 'fail'}" title={res.error || (res.pass ? 'Passed' : 'Failed')}>
                                        <div class="test-icon">
                                            {#if res.pass}
                                                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                                            {:else}
                                                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                                            {/if}
                                        </div>
                                        <span class="test-label">T{i+1}</span>
                                    </div>
                                {/each}
                            </div>
                            
                            <!-- Detailed error for the first failure -->
                            {@const firstFail = runResults.find(r => !r.pass)}
                            {#if firstFail && firstFail.error}
                                <div class="error-detail">
                                    <span class="error-prefix">Failure Trace:</span>
                                    <span class="error-msg">{firstFail.error}</span>
                                </div>
                            {/if}
                        {/if}
                    </div>
                {/if}

                <div class="action-bar">
                    <button class="btn-run {isRunning ? 'loading' : ''}" onclick={handleRun} disabled={isRunning}>
                        {#if isRunning}
                            <svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                        {:else}
                            ▶ Run
                        {/if}
                    </button>
                    {#if currentQuestionType === 'find_buggy_line' && currentState?.markedLines}
                        <span class="marked-lines-status">
                            🐛 {currentState.markedLines.length} line{currentState.markedLines.length !== 1 ? 's' : ''} marked
                        </span>
                    {/if}
                    <div class="spacer"></div>
                    <button class="btn-submit" onclick={handleSubmit}>✓ Submit Answer</button>
                </div>
            </div>
        </section>
    </main>

    <!-- Final Submit Dialog -->
    {#if showSubmitDialog}
        <div class="dialog-overlay">
            <div class="dialog">
                <h2>Confirm Submission</h2>
                <div class="stats-summary">
                     <p>Unvisited <span class="text-white">{stats.unvisited}</span></p>
                     <p>Skipped <span class="text-orange-500">{stats.skipped}</span></p>
                     <p>On Hold <span class="text-yellow-500">{stats.hold}</span></p>
                     <p>Submitted <span class="text-green-500">{stats.submitted}</span></p>
                </div>
                <p>Are you sure you want to finish the exam? This action cannot be undone. All held answers will be auto-submitted.</p>
                <div class="dialog-actions">
                    <button class="btn-cancel" onclick={cancelFinish}>Return</button>
                    <button class="btn-confirm" onclick={() => finishExam(false)}>Confirm Submit</button>
                </div>
            </div>
        </div>
    {/if}
{/if}
</ExamGuard>
