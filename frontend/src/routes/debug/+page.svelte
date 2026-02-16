<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import { openDB } from "idb";
    import "./debug.css";

    let questions: any[] = $state([]);
    let currentIndex = $state(0);
    let timeRemaining = $state(900); // default 15:00, overridden by level duration
    let examSessionId = $state<number | null>(null);
    let currentSystemCode = $state("");
    let loading = $state(true);
    let showSubmitDialog = $state(false);
    let runOutput = $state("");
    
    // State Map: questionId -> { status: 'unvisited' | 'skipped' | 'hold' | 'submitted', answer: string }
    let questionStates = $state<Record<number, { status: string; answer: string }>>({});
    
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

        try {
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
                             initialStates[q.id] = { status: 'unvisited', answer: q.code_snippet || "" };
                          }
                      });
                      
                      questionStates = initialStates;
                      questions = orderedQs;
                 }
            }

            loading = false;
            startTimer();
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
        const stateToSave = {
             sessionId: examSessionId,
             questions: JSON.parse(JSON.stringify(questions)),
             questionStates: JSON.parse(JSON.stringify(questionStates)),
             currentIndex,
             timeRemaining,
             timestamp: Date.now()
        };
        await db.put(STORE_STATE, stateToSave, "current_session");
    }

    async function logAction(type: string, data: any = {}) {
        const payload = {
            session_id: examSessionId,
            type,
            data: { ...data, timestamp: new Date().toISOString() }
        };

        const db = await dbPromise;
        await db.add(STORE_LOGS, payload);

        try {
             api("/system/log", "POST", payload, localStorage.getItem("login_token") || "");
        } catch (e) {
             console.error("Log failed upload", e);
        }
    }

    // Navigation
    function gotoQuestion(index: number) {
        if (index >= 0 && index < questions.length) {
            currentIndex = index;
            runOutput = ""; // Clear output on navigation
            if (questions[index] && questions[index].id) {
                logAction("NAVIGATE", { question_id: questions[index].id, from: currentIndex });
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
    function handleRun() {
        if (currentQ && questionStates[currentQ.id]) {
            logAction("RUN_CODE", { question_id: currentQ.id, code: questionStates[currentQ.id].answer });
            // Simulate run output
            runOutput = `> Running solution for Q${currentIndex + 1}...\n> Compilation successful.\n> Output: [Test results will appear here]`;
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

    function handleSubmit() {
        const q = questions[currentIndex];
         if (q && questionStates[q.id]) {
            questionStates[q.id].status = 'submitted';
            logAction("SUBMIT", { question_id: q.id, answer: questionStates[q.id].answer });
            saveState();
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
        if (force) {
            questions.forEach(q => {
                if (questionStates[q.id] && questionStates[q.id].status === 'hold') {
                    questionStates[q.id].status = 'submitted';
                    logAction("AUTO_SUBMIT_HOLD", { question_id: q.id, answer: questionStates[q.id].answer });
                }
            });
        }

        logAction("EXAM_FINISH", { reason: force ? "TIMEOUT" : "USER_INITIATED" });
        
        try {
            await api("/system/finish", "POST", { session_id: examSessionId }, localStorage.getItem("login_token") || "");
        } catch (e) {
            console.error("Failed to finish exam on server", e);
        }

        const db = await dbPromise;
        await db.delete(STORE_STATE, "current_session");
        
        goto("/thankyou"); 
    }

    // Computed
    let currentQ = $derived(questions[currentIndex]);
    let currentState = $derived(currentQ ? questionStates[currentQ.id] : null);
    let isLastQuestion = $derived(currentIndex === questions.length - 1);

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

    // Stats derived
    let stats = $derived({
        unvisited: questions.filter(q => questionStates[q.id]?.status === 'unvisited').length,
        skipped: questions.filter(q => questionStates[q.id]?.status === 'skipped').length,
        hold: questions.filter(q => questionStates[q.id]?.status === 'hold').length,
        submitted: questions.filter(q => questionStates[q.id]?.status === 'submitted').length,
    });
</script>

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
        </div>
        <div class="header-right">
            <button class="btn-finish-header" onclick={confirmFinish}>
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
            </div>

            <!-- Question Grid -->
            <div class="grid-section">
                <div class="grid-section-title">Questions</div>
                <div class="grid-nav">
                    {#each questions as q, i}
                        <button 
                            class="grid-item {getStatusColor(questionStates[q.id]?.status)} {i === currentIndex ? 'active-q' : ''}"
                            onclick={() => gotoQuestion(i)}
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
                    <svg viewBox="0 0 32 32">
                        <path d="M0 0h32v32H0z" fill="none" />
                        <path d="M16 2L3 9.5 5 29l11 3 11-3 2-19.5L16 2z m0 26.5l-8-2.2-1.5-14.7L16 4.5l9.5 7.1-1.5 14.7-8 2.2z" fill="#5c6bc0" />
                        <path d="M16 25c-5 0-9-4-9-9s4-9 9-9 9 4 9 9h-3c0-3.3-2.7-6-6-6s-6 2.7-6 6 2.7 6 6 6v3z" fill="#fff" />
                    </svg>
                    solution.c
                </div>
            </div>

            {#if currentQ && questionStates[currentQ.id]}
                <textarea 
                    class="code-editor"
                    spellcheck="false"
                    bind:value={questionStates[currentQ.id].answer}
                ></textarea>
            {/if}

            <!-- Bottom Panel: Output + Actions -->
            <div class="bottom-panel">
                {#if runOutput}
                    <div class="output-area has-output">
                        {runOutput}
                    </div>
                {/if}

                <div class="action-bar">
                    <button class="btn-run" onclick={handleRun}>▶ Run</button>
                    <div class="spacer"></div>
                    <button class="btn-submit" onclick={handleSubmit}>✓ Submit Answer</button>
                    {#if isLastQuestion}
                        <button class="btn-final-submit" onclick={confirmFinish}>⬡ Final Submit</button>
                    {/if}
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
