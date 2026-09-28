<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { api } from "$lib/api";

    // ── Mode & Tab State ──
    let activeMode = $state<'debug' | 'typing'>('debug');

    // ── Leaderboard Data State ──
    let rankings = $state<any[]>([]);
    let typingRankings = $state<any[]>([]);
    let questions = $state<any[]>([]);
    let recentActivity = $state<any[]>([]);
    let settings = $state({
        is_frozen: false,
        visible: true,
        title: "Lab Coding Competition",
        freeze_time: null as string | null
    });
    let stats = $state({
        total_participants: 0,
        total_solves: 0,
        total_submissions: 0
    });

    let loading = $state(true);
    let error = $state("");
    let lastUpdated = $state<Date>(new Date());
    let timeAgoSec = $state(0);

    // ── Search & Filter State ──
    let searchQuery = $state("");
    let filterCollege = $state("");
    let filterBranch = $state("");

    // ── Spectator & Projector Controls ──
    let isFullscreen = $state(false);
    let isAutoScroll = $state(false);
    let soundEnabled = $state(true);
    let autoScrollSpeed = $state<'slow' | 'normal' | 'fast'>('normal');

    // ── Audio Synthesizer (Web Audio API) ──
    let audioCtx: AudioContext | null = null;

    function playSolveChime() {
        if (!soundEnabled || typeof window === "undefined") return;
        try {
            if (!audioCtx) {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtxClass) audioCtx = new AudioCtxClass();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (audioCtx) {
                const now = audioCtx.currentTime;
                // Play chord: C5 -> E5 -> G5
                [523.25, 659.25, 783.99].forEach((freq, idx) => {
                    const osc = audioCtx!.createOscillator();
                    const gain = audioCtx!.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

                    gain.gain.setValueAtTime(0.001, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

                    osc.connect(gain);
                    gain.connect(audioCtx!.destination);

                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.45);
                });
            }
        } catch (e) {
            console.warn("Audio chime failed:", e);
        }
    }

    // ── WebSocket Connection ──
    let socket: WebSocket | null = null;
    let wsReconnectTimeout: any = null;
    let timeAgoInterval: any = null;
    let autoScrollInterval: any = null;
    let tableContainer: HTMLDivElement | null = $state(null);

    async function fetchLeaderboard(isInitial = false) {
        if (isInitial) loading = true;
        try {
            const res = await api("/leaderboard/data", "GET");
            if (res) {
                // Check if new solves occurred to trigger chime
                if (!isInitial && res.stats?.total_solves > stats.total_solves) {
                    playSolveChime();
                }

                rankings = res.rankings || [];
                typingRankings = res.typing_rankings || [];
                questions = res.questions || [];
                recentActivity = res.recent_activity || [];
                if (res.settings) settings = res.settings;
                if (res.stats) stats = res.stats;

                lastUpdated = new Date();
                timeAgoSec = 0;
                error = "";
            }
        } catch (err: any) {
            console.error("Failed to load leaderboard:", err);
            error = err.message || "Unable to load leaderboard data";
        } finally {
            loading = false;
        }
    }

    function initWebSocket() {
        if (typeof window === "undefined") return;

        const isDev = import.meta.env.DEV;
        const port = isDev ? "3000" : window.location.port;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.hostname}${port ? `:${port}` : ""}?spectator=true`;

        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("[WS] Leaderboard spectator stream connected.");
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "leaderboard_update" || data.type === "system_updated") {
                        fetchLeaderboard();
                    }
                } catch {}
            };

            socket.onclose = () => {
                console.log("[WS] Disconnected, scheduling reconnect in 3s...");
                wsReconnectTimeout = setTimeout(initWebSocket, 3000);
            };

            socket.onerror = (err) => {
                console.warn("[WS] Error:", err);
            };
        } catch (e) {
            console.error("WS init failed:", e);
            wsReconnectTimeout = setTimeout(initWebSocket, 5000);
        }
    }

    // ── Fullscreen Toggle ──
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                isFullscreen = true;
            }).catch(() => {});
        } else {
            document.exitFullscreen().then(() => {
                isFullscreen = false;
            }).catch(() => {});
        }
    }

    // ── Auto-Scroll Logic for Projectors ──
    let scrollDirection: 'down' | 'up' = 'down';

    function toggleAutoScroll() {
        isAutoScroll = !isAutoScroll;
        if (isAutoScroll) {
            startAutoScroll();
        } else {
            stopAutoScroll();
        }
    }

    function startAutoScroll() {
        stopAutoScroll();
        const stepMs = autoScrollSpeed === 'slow' ? 60 : autoScrollSpeed === 'normal' ? 40 : 25;

        autoScrollInterval = setInterval(() => {
            if (!tableContainer) return;
            const maxScroll = tableContainer.scrollHeight - tableContainer.clientHeight;
            if (maxScroll <= 0) return;

            if (scrollDirection === 'down') {
                tableContainer.scrollTop += 1.5;
                if (tableContainer.scrollTop >= maxScroll - 4) {
                    scrollDirection = 'up';
                    // Pause briefly at bottom
                    clearInterval(autoScrollInterval);
                    setTimeout(() => { if (isAutoScroll) startAutoScroll(); }, 3000);
                }
            } else {
                tableContainer.scrollTop -= 2.5;
                if (tableContainer.scrollTop <= 4) {
                    scrollDirection = 'down';
                    // Pause briefly at top
                    clearInterval(autoScrollInterval);
                    setTimeout(() => { if (isAutoScroll) startAutoScroll(); }, 3000);
                }
            }
        }, stepMs);
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    // ── Filtered derived lists ──
    let uniqueColleges = $derived(
        Array.from(new Set(rankings.map(r => r.college).filter(Boolean))).sort()
    );

    let uniqueBranches = $derived(
        Array.from(new Set(rankings.map(r => r.branch).filter(Boolean))).sort()
    );

    let filteredRankings = $derived(
        rankings.filter(r => {
            const matchesSearch = !searchQuery || 
                r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.system_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.college.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCollege = !filterCollege || r.college === filterCollege;
            const matchesBranch = !filterBranch || r.branch === filterBranch;
            return matchesSearch && matchesCollege && matchesBranch;
        })
    );

    let filteredTypingRankings = $derived(
        typingRankings.filter(r => {
            const matchesSearch = !searchQuery || 
                r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.system_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.college.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCollege = !filterCollege || r.college === filterCollege;
            const matchesBranch = !filterBranch || r.branch === filterBranch;
            return matchesSearch && matchesCollege && matchesBranch;
        })
    );

    // Top 3 Podium
    let topThree = $derived(
        activeMode === 'debug'
            ? filteredRankings.slice(0, 3)
            : filteredTypingRankings.slice(0, 3)
    );

    onMount(() => {
        fetchLeaderboard(true);
        initWebSocket();

        // Update elapsed timer counter
        timeAgoInterval = setInterval(() => {
            timeAgoSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        }, 1000);

        // Fallback polling every 8s in case WS drops
        const pollInterval = setInterval(() => fetchLeaderboard(false), 8000);

        const onFsChange = () => {
            isFullscreen = !!document.fullscreenElement;
        };
        document.addEventListener("fullscreenchange", onFsChange);

        return () => {
            clearInterval(pollInterval);
            if (timeAgoInterval) clearInterval(timeAgoInterval);
            stopAutoScroll();
            if (wsReconnectTimeout) clearTimeout(wsReconnectTimeout);
            if (socket) socket.close();
            document.removeEventListener("fullscreenchange", onFsChange);
        };
    });
</script>

<svelte:head>
    <title>{settings.title} | Live Leaderboard</title>
</svelte:head>

<div class="leaderboard-root min-h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
    <!-- ═════════════════════════════════════════════════════════════ -->
    <!--  TOP BANNER: FROZEN STATE (IF ACTIVE)                         -->
    <!-- ═════════════════════════════════════════════════════════════ -->
    {#if settings.is_frozen}
        <div class="bg-linear-to-r from-amber-600 via-orange-500 to-amber-700 text-slate-950 font-bold px-4 py-2 text-center text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 animate-pulse">
            <span class="text-lg">🧊</span>
            <span>SCOREBOARD FROZEN: Rankings are currently locked for the final reveal! Submissions are still evaluated server-side.</span>
            {#if settings.freeze_time}
                <span class="text-xs opacity-80 font-mono">({new Date(settings.freeze_time).toLocaleTimeString()})</span>
            {/if}
        </div>
    {/if}

    <!-- ═════════════════════════════════════════════════════════════ -->
    <!--  TOP HEADER & LIVE STATUS BAR                                -->
    <!-- ═════════════════════════════════════════════════════════════ -->
    <header class="border-b border-cyan-500/15 bg-[#0a0f1d]/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 shadow-2xl">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Brand & Contest Title -->
            <div class="flex items-center gap-3.5">
                <div class="relative flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-cyan-500/20 via-blue-600/30 to-purple-600/20 border border-cyan-400/30 shadow-[0_0_20px_rgba(0,243,255,0.25)]">
                    <span class="text-2xl">⚡</span>
                    <span class="absolute -top-1 -right-1 flex h-3 w-3">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </span>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            {settings.title}
                        </h1>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE
                        </span>
                    </div>
                    <p class="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>Real-Time Arena Matrix</span>
                        <span>•</span>
                        <span class="text-cyan-400/90">Updated {timeAgoSec}s ago</span>
                    </p>
                </div>
            </div>

            <!-- Mode Switcher (Debugging vs Typing) -->
            <div class="flex items-center bg-[#0e1628] p-1 rounded-xl border border-white/10 shadow-inner">
                <button
                    onclick={() => activeMode = 'debug'}
                    class="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 {activeMode === 'debug' ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}"
                >
                    <span>⚡</span> Coding Arena
                    {#if stats.total_solves > 0}
                        <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/40 text-current">{stats.total_solves}</span>
                    {/if}
                </button>
                <button
                    onclick={() => activeMode = 'typing'}
                    class="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 {activeMode === 'typing' ? 'bg-linear-to-r from-purple-500 to-pink-600 text-white font-bold shadow-md shadow-purple-500/20' : 'text-slate-400 hover:text-white'}"
                >
                    <span>⌨</span> Typing Speed
                    {#if typingRankings.length > 0}
                        <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/40 text-current">{typingRankings.length}</span>
                    {/if}
                </button>
            </div>

            <!-- Quick Action & Projector Controls -->
            <div class="flex items-center gap-2">
                <!-- Sound Toggle -->
                <button
                    onclick={() => { soundEnabled = !soundEnabled; if (soundEnabled) playSolveChime(); }}
                    title={soundEnabled ? "Mute solve sounds" : "Enable solve audio chimes"}
                    class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-white transition-colors"
                >
                    {#if soundEnabled}
                        <span class="text-sm">🔔</span>
                    {:else}
                        <span class="text-sm opacity-50">🔕</span>
                    {/if}
                </button>

                <!-- Auto-Scroll Toggle -->
                <button
                    onclick={toggleAutoScroll}
                    title="Toggle hands-free auto-scrolling for projectors"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 {isAutoScroll ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,243,255,0.25)]' : 'bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-700/80'}"
                >
                    <span class="text-xs {isAutoScroll ? 'animate-bounce' : ''}">↕</span>
                    <span class="hidden sm:inline">Auto-Scroll</span>
                </button>

                <!-- Fullscreen Toggle -->
                <button
                    onclick={toggleFullscreen}
                    title="Fullscreen Projector Mode"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                    <span>{isFullscreen ? '✕' : '⛶'}</span>
                    <span class="hidden sm:inline">{isFullscreen ? 'Exit' : 'Projector'}</span>
                </button>

                <!-- Refresh Button -->
                <button
                    onclick={() => fetchLeaderboard(false)}
                    title="Refresh Now"
                    class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-cyan-400 transition-colors"
                >
                    <svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>

                <!-- Admin Link -->
                <a
                    href="/admin/results"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-400 hover:text-white transition-colors hidden md:inline-flex items-center gap-1"
                >
                    <span>Admin ↗</span>
                </a>
            </div>
        </div>
    </header>

    <!-- ═════════════════════════════════════════════════════════════ -->
    <!--  LIVE METRICS BAR                                             -->
    <!-- ═════════════════════════════════════════════════════════════ -->
    <div class="bg-[#0b101e] border-b border-white/5 px-4 lg:px-8 py-2.5">
        <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div class="flex items-center gap-6 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="text-slate-400">Contestants:</span>
                    <span class="text-white font-bold px-2 py-0.5 rounded bg-slate-800/70 border border-white/10">
                        {activeMode === 'debug' ? rankings.length : typingRankings.length}
                    </span>
                </div>
                {#if activeMode === 'debug'}
                    <div class="flex items-center gap-2">
                        <span class="text-slate-400">Total Solves:</span>
                        <span class="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30">
                            {stats.total_solves}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-slate-400">Submissions:</span>
                        <span class="text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
                            {stats.total_submissions}
                        </span>
                    </div>
                {/if}
                <div class="flex items-center gap-2">
                    <span class="text-slate-400">Problems Available:</span>
                    <span class="text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-950/40 border border-purple-500/30">
                        {questions.length}
                    </span>
                </div>
            </div>

            <!-- ICPC Legend -->
            {#if activeMode === 'debug'}
                <div class="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span class="flex items-center gap-1.5">
                        <span class="w-3.5 h-3.5 rounded bg-emerald-600/80 border border-emerald-400 inline-flex items-center justify-center text-[10px] text-white font-bold">✔</span>
                        <span>Solved (+attempts)</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="w-3.5 h-3.5 rounded bg-rose-600/60 border border-rose-400 inline-flex items-center justify-center text-[10px] text-white font-bold">✖</span>
                        <span>Failed (-attempts)</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="text-amber-400">⚡</span>
                        <span>First to Solve</span>
                    </span>
                </div>
            {/if}
        </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════ -->
    <!--  MAIN LEADERBOARD CONTAINER                                   -->
    <!-- ═════════════════════════════════════════════════════════════ -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6">
        <!-- ── PODIUM DISPLAY (TOP 3) ── -->
        {#if topThree.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 pb-2 items-end">
                <!-- 2nd Place (Silver - Left) -->
                {#if topThree[1]}
                    {@const p = topThree[1]}
                    <div class="order-2 md:order-1 relative rounded-2xl bg-linear-to-b from-slate-800/70 to-slate-900/90 border border-slate-600/40 p-5 backdrop-blur-xl shadow-xl hover:border-slate-400 transition-all flex flex-col items-center text-center">
                        <div class="w-14 h-14 rounded-full bg-linear-to-tr from-slate-500 to-slate-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-[0_0_15px_rgba(203,213,225,0.4)] mb-3">
                            2
                        </div>
                        <span class="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold bg-slate-700/60 px-2.5 py-0.5 rounded-full border border-slate-500/30 mb-1">
                            🥈 Silver Medal
                        </span>
                        <h3 class="text-lg font-black text-white truncate max-w-full">{p.user_name}</h3>
                        <p class="text-xs text-slate-400 font-mono mt-0.5">{p.system_code} • {p.branch || p.college}</p>

                        <div class="mt-4 pt-3 border-t border-white/10 w-full flex justify-around font-mono">
                            {#if activeMode === 'debug'}
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Score</div>
                                    <div class="text-base font-black text-cyan-400">{p.score} pts</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Solved</div>
                                    <div class="text-base font-black text-emerald-400">{p.solved_count} / {questions.length}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Penalty</div>
                                    <div class="text-base font-black text-slate-300">{p.penalty}m</div>
                                </div>
                            {:else}
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Speed</div>
                                    <div class="text-base font-black text-cyan-400">{p.wpm} WPM</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Accuracy</div>
                                    <div class="text-base font-black text-emerald-400">{p.accuracy}%</div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="order-2 md:order-1"></div>
                {/if}

                <!-- 1st Place (Gold - Center, Elevated) -->
                {#if topThree[0]}
                    {@const p = topThree[0]}
                    <div class="order-1 md:order-2 relative rounded-2xl bg-linear-to-b from-amber-950/40 via-slate-900/90 to-amber-950/30 border-2 border-amber-400/60 p-6 backdrop-blur-2xl shadow-[0_0_35px_rgba(251,191,36,0.25)] hover:border-amber-300 transition-all flex flex-col items-center text-center scale-100 md:-translate-y-3">
                        <div class="absolute -top-5 flex items-center justify-center">
                            <span class="text-3xl filter drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">👑</span>
                        </div>
                        <div class="w-16 h-16 rounded-full bg-linear-to-tr from-amber-500 via-yellow-400 to-amber-200 flex items-center justify-center text-slate-950 font-black text-2xl shadow-[0_0_25px_rgba(251,191,36,0.6)] mb-3 mt-1">
                            1
                        </div>
                        <span class="text-xs font-mono uppercase tracking-wider text-amber-300 font-extrabold bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/40 mb-1">
                            🥇 Contest Leader
                        </span>
                        <h3 class="text-xl font-black text-white truncate max-w-full drop-shadow">{p.user_name}</h3>
                        <p class="text-xs text-amber-200/80 font-mono mt-0.5 font-semibold">{p.system_code} • {p.branch || p.college}</p>

                        <div class="mt-4 pt-3 border-t border-amber-500/20 w-full flex justify-around font-mono">
                            {#if activeMode === 'debug'}
                                <div>
                                    <div class="text-[10px] text-amber-300/70 uppercase">Score</div>
                                    <div class="text-lg font-black text-amber-300">{p.score} pts</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-amber-300/70 uppercase">Solved</div>
                                    <div class="text-lg font-black text-emerald-400">{p.solved_count} / {questions.length}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-amber-300/70 uppercase">Penalty</div>
                                    <div class="text-lg font-black text-slate-200">{p.penalty}m</div>
                                </div>
                            {:else}
                                <div>
                                    <div class="text-[10px] text-amber-300/70 uppercase">Speed</div>
                                    <div class="text-lg font-black text-amber-300">{p.wpm} WPM</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-amber-300/70 uppercase">Accuracy</div>
                                    <div class="text-lg font-black text-emerald-400">{p.accuracy}%</div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}

                <!-- 3rd Place (Bronze - Right) -->
                {#if topThree[2]}
                    {@const p = topThree[2]}
                    <div class="order-3 relative rounded-2xl bg-linear-to-b from-amber-950/20 to-slate-900/90 border border-amber-700/40 p-5 backdrop-blur-xl shadow-xl hover:border-amber-600 transition-all flex flex-col items-center text-center">
                        <div class="w-14 h-14 rounded-full bg-linear-to-tr from-amber-700 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(217,119,6,0.3)] mb-3">
                            3
                        </div>
                        <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold bg-amber-900/40 px-2.5 py-0.5 rounded-full border border-amber-700/30 mb-1">
                            🥉 Bronze Medal
                        </span>
                        <h3 class="text-lg font-black text-white truncate max-w-full">{p.user_name}</h3>
                        <p class="text-xs text-slate-400 font-mono mt-0.5">{p.system_code} • {p.branch || p.college}</p>

                        <div class="mt-4 pt-3 border-t border-white/10 w-full flex justify-around font-mono">
                            {#if activeMode === 'debug'}
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Score</div>
                                    <div class="text-base font-black text-cyan-400">{p.score} pts</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Solved</div>
                                    <div class="text-base font-black text-emerald-400">{p.solved_count} / {questions.length}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Penalty</div>
                                    <div class="text-base font-black text-slate-300">{p.penalty}m</div>
                                </div>
                            {:else}
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Speed</div>
                                    <div class="text-base font-black text-cyan-400">{p.wpm} WPM</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-slate-400 uppercase">Accuracy</div>
                                    <div class="text-base font-black text-emerald-400">{p.accuracy}%</div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="order-3"></div>
                {/if}
            </div>
        {/if}

        <!-- ── FILTER & SEARCH BAR ── -->
        <div class="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0d1424] p-3 rounded-xl border border-white/10 shadow-lg">
            <div class="relative w-full md:w-80">
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search candidate, PC, or college..."
                    class="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans"
                />
                <span class="absolute left-3 top-2.5 text-slate-500 text-sm">🔍</span>
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto">
                {#if uniqueColleges.length > 0}
                    <select
                        bind:value={filterCollege}
                        class="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                    >
                        <option value="">All Colleges ({uniqueColleges.length})</option>
                        {#each uniqueColleges as col}
                            <option value={col}>{col}</option>
                        {/each}
                    </select>
                {/if}

                {#if uniqueBranches.length > 0}
                    <select
                        bind:value={filterBranch}
                        class="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                    >
                        <option value="">All Branches ({uniqueBranches.length})</option>
                        {#each uniqueBranches as br}
                            <option value={br}>{br}</option>
                        {/each}
                    </select>
                {/if}

                {#if filterCollege || filterBranch || searchQuery}
                    <button
                        onclick={() => { filterCollege = ""; filterBranch = ""; searchQuery = ""; }}
                        class="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 rounded-lg border border-rose-800/40"
                    >
                        Reset
                    </button>
                {/if}
            </div>
        </div>

        <!-- ── LEADERBOARD MATRIX TABLE ── -->
        <div class="rounded-2xl border border-white/10 bg-[#0c1222]/90 backdrop-blur-md shadow-2xl overflow-hidden">
            <div
                bind:this={tableContainer}
                class="overflow-x-auto max-h-150 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent"
            >
                {#if activeMode === 'debug'}
                    <!-- ── DEBUG MATRIX TABLE ── -->
                    <table class="w-full text-left border-collapse font-sans text-xs">
                        <thead class="sticky top-0 bg-[#090d19] z-20 shadow-md border-b border-white/10 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th class="py-3 px-3 w-14 text-center">Rank</th>
                                <th class="py-3 px-4 min-w-50">Contestant</th>
                                <th class="py-3 px-3 text-center w-24">Score</th>
                                <th class="py-3 px-3 text-center w-20">Solved</th>
                                <th class="py-3 px-3 text-center w-20">Penalty</th>

                                <!-- Dynamic Question Columns -->
                                {#each questions as q, idx}
                                    <th
                                        class="py-3 px-2 text-center w-16 border-l border-white/5"
                                        title="{q.title} ({q.difficulty} • {q.language?.toUpperCase()})"
                                    >
                                        <div class="font-bold text-white flex flex-col items-center">
                                            <span>P{idx + 1}</span>
                                            <span class="text-[9px] font-normal opacity-60">
                                                {q.difficulty === 'easy' ? '5p' : q.difficulty === 'medium' ? '10p' : '15p'}
                                            </span>
                                        </div>
                                    </th>
                                {/each}
                            </tr>
                        </thead>

                        <tbody class="divide-y divide-white/5 font-mono">
                            {#if loading && rankings.length === 0}
                                <tr>
                                    <td colspan={5 + questions.length} class="py-16 text-center text-slate-500">
                                        <div class="flex flex-col items-center gap-2">
                                            <svg class="w-8 h-8 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Loading real-time arena data...</span>
                                        </div>
                                    </td>
                                </tr>
                            {:else if filteredRankings.length === 0}
                                <tr>
                                    <td colspan={5 + questions.length} class="py-16 text-center text-slate-500">
                                        <div class="text-3xl mb-2">⚡</div>
                                        <p class="text-sm font-sans font-medium text-slate-400">No contestant submissions recorded yet.</p>
                                        <p class="text-xs text-slate-600 font-sans mt-1">Live updates will populate automatically as participants code.</p>
                                    </td>
                                </tr>
                            {:else}
                                {#each filteredRankings as r}
                                    <tr class="hover:bg-cyan-500/4 transition-colors {r.rank === 1 ? 'bg-amber-500/3' : r.rank === 2 ? 'bg-slate-400/2' : r.rank === 3 ? 'bg-amber-700/2' : ''}">
                                        <!-- Rank -->
                                        <td class="py-3 px-3 text-center font-bold">
                                            {#if r.rank === 1}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-linear-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]">1</span>
                                            {:else if r.rank === 2}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-slate-950 font-black shadow-[0_0_8px_rgba(203,213,225,0.4)]">2</span>
                                            {:else if r.rank === 3}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black shadow-[0_0_8px_rgba(217,119,6,0.3)]">3</span>
                                            {:else}
                                                <span class="text-slate-400">#{r.rank}</span>
                                            {/if}
                                        </td>

                                        <!-- Contestant -->
                                        <td class="py-3 px-4">
                                            <div class="font-sans font-bold text-white text-sm truncate">{r.user_name}</div>
                                            <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                <span class="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] border border-cyan-500/20">{r.system_code}</span>
                                                <span class="truncate">{r.branch}</span>
                                                {#if r.college}
                                                    <span>•</span>
                                                    <span class="truncate opacity-80">{r.college}</span>
                                                {/if}
                                            </div>
                                        </td>

                                        <!-- Total Score -->
                                        <td class="py-3 px-3 text-center">
                                            <span class="inline-block px-2.5 py-1 rounded-lg text-sm font-black {r.score > 0 ? 'bg-linear-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}">
                                                {r.score}
                                            </span>
                                        </td>

                                        <!-- Solved Count -->
                                        <td class="py-3 px-3 text-center">
                                            <span class="font-bold text-sm {r.solved_count > 0 ? 'text-emerald-400' : 'text-slate-600'}">
                                                {r.solved_count}
                                            </span>
                                        </td>

                                        <!-- Penalty Time (min) -->
                                        <td class="py-3 px-3 text-center text-slate-400">
                                            {r.penalty}m
                                        </td>

                                        <!-- Dynamic Question Status Cells -->
                                        {#each questions as q}
                                            {@const prob = r.problems?.[q.id]}
                                            <td class="py-2 px-1 text-center border-l border-white/5">
                                                {#if prob && prob.solved}
                                                    <div
                                                        class="mx-auto w-12 py-1 rounded border text-center transition-all {prob.isFirstSolve ? 'bg-amber-950/60 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'}"
                                                        title="Solved: Attempt {prob.attempts} at {prob.solveTimeMinutes}m {prob.isFirstSolve ? '(FIRST TO SOLVE ⚡)' : ''}"
                                                    >
                                                        <div class="font-bold text-[11px] flex items-center justify-center gap-0.5">
                                                            {#if prob.isFirstSolve}
                                                                <span class="text-amber-400 text-[10px]">⚡</span>
                                                            {/if}
                                                            <span>+{prob.attempts}</span>
                                                        </div>
                                                        <div class="text-[9px] opacity-75">{prob.solveTimeMinutes}m</div>
                                                    </div>
                                                {:else if prob && prob.attempts > 0}
                                                    <div
                                                        class="mx-auto w-12 py-1.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-400 text-center"
                                                        title="{prob.attempts} failed attempts"
                                                    >
                                                        <span class="font-bold text-[11px]">-{prob.attempts}</span>
                                                    </div>
                                                {:else}
                                                    <span class="text-slate-700 text-xs font-mono">·</span>
                                                {/if}
                                            </td>
                                        {/each}
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                {:else}
                    <!-- ── TYPING TEST TABLE ── -->
                    <table class="w-full text-left border-collapse font-sans text-xs">
                        <thead class="sticky top-0 bg-[#090d19] z-20 shadow-md border-b border-white/10 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th class="py-3 px-3 w-16 text-center">Rank</th>
                                <th class="py-3 px-4 min-w-50">Contestant</th>
                                <th class="py-3 px-3 text-center w-28">Speed (WPM)</th>
                                <th class="py-3 px-3 text-center w-28">Accuracy</th>
                                <th class="py-3 px-3 text-center w-28">Raw WPM</th>
                                <th class="py-3 px-3 text-center w-28">Consistency</th>
                                <th class="py-3 px-3 text-center w-24">Attempts</th>
                                <th class="py-3 px-3 text-center w-24">Status</th>
                            </tr>
                        </thead>

                        <tbody class="divide-y divide-white/5 font-mono">
                            {#if filteredTypingRankings.length === 0}
                                <tr>
                                    <td colspan="8" class="py-16 text-center text-slate-500">
                                        <div class="text-3xl mb-2">⌨</div>
                                        <p class="text-sm font-sans font-medium text-slate-400">No typing speed results recorded yet.</p>
                                    </td>
                                </tr>
                            {:else}
                                {#each filteredTypingRankings as r}
                                    <tr class="hover:bg-purple-500/4 transition-colors">
                                        <td class="py-3 px-3 text-center font-bold">
                                            {#if r.rank === 1}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-linear-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black">1</span>
                                            {:else if r.rank === 2}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400 text-slate-950 font-black">2</span>
                                            {:else if r.rank === 3}
                                                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black">3</span>
                                            {:else}
                                                <span class="text-slate-400">#{r.rank}</span>
                                            {/if}
                                        </td>

                                        <td class="py-3 px-4">
                                            <div class="font-sans font-bold text-white text-sm">{r.user_name}</div>
                                            <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                <span class="px-1.5 py-0.2 rounded bg-slate-800 text-purple-300 font-mono text-[10px] border border-purple-500/20">{r.system_code}</span>
                                                <span>{r.branch}</span>
                                                {#if r.college}
                                                    <span>•</span>
                                                    <span>{r.college}</span>
                                                {/if}
                                            </div>
                                        </td>

                                        <td class="py-3 px-3 text-center">
                                            <span class="text-base font-black text-cyan-400">{r.wpm}</span>
                                        </td>

                                        <td class="py-3 px-3 text-center">
                                            <span class="font-bold text-emerald-400">{r.accuracy}%</span>
                                        </td>

                                        <td class="py-3 px-3 text-center text-slate-400">
                                            {r.raw_wpm}
                                        </td>

                                        <td class="py-3 px-3 text-center text-slate-400">
                                            {r.consistency}%
                                        </td>

                                        <td class="py-3 px-3 text-center text-slate-300">
                                            {r.attempts}
                                        </td>

                                        <td class="py-3 px-3 text-center">
                                            {#if r.passed}
                                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PASSED</span>
                                            {:else}
                                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>
                                            {/if}
                                        </td>
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                {/if}
            </div>
        </div>

        <!-- ═════════════════════════════════════════════════════════ -->
        <!--  LIVE SOLVE ACTIVITY STREAM TICKER                        -->
        <!-- ═════════════════════════════════════════════════════════ -->
        {#if recentActivity.length > 0 && activeMode === 'debug'}
            <div class="rounded-xl bg-[#090e1a] border border-cyan-500/20 p-3 shadow-lg">
                <div class="flex items-center gap-2 mb-2 text-xs font-mono font-bold text-cyan-400">
                    <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>LATEST ARENA SOLVES (LIVE FEED)</span>
                </div>
                <div class="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none">
                    {#each recentActivity as act}
                        <div class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs font-mono flex items-center gap-2 shadow-sm">
                            <span class="text-emerald-400 font-bold">✔</span>
                            <span class="text-white font-sans font-bold">{act.user_name}</span>
                            <span class="text-slate-500">({act.system_code})</span>
                            <span class="text-slate-400">solved</span>
                            <span class="text-cyan-300 font-bold truncate max-w-35">{act.question_title}</span>
                            <span class="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">+{act.points}p</span>
                            <span class="text-[10px] text-slate-500">at {act.time_minutes}m</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>

    <!-- ═════════════════════════════════════════════════════════════ -->
    <!--  FOOTER                                                       -->
    <!-- ═════════════════════════════════════════════════════════════ -->
    <footer class="border-t border-white/5 py-3 px-4 text-center text-xs text-slate-500 font-mono">
        <span>Debugging Course & Lab Exam Platform</span>
        <span>•</span>
        <span>Spectator Terminal View</span>
        <span>•</span>
        <span>WebSocket Stream Active</span>
    </footer>
</div>

<style>
    /* Hide scrollbar for clean ticker */
    .scrollbar-none::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-none {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
