<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";

  // ── Tab state ──
  let activeTab = $state<'debug' | 'typing'>('debug');

  // ══════════════════════════════════════════════
  //  DEBUG TAB STATE
  // ══════════════════════════════════════════════
  let debugResults = $state<any[]>([]);
  let debugLoading = $state(true);
  let debugOptions = $state<any>({
      colleges: [], branches: [], years: [], levels: [], modes: []
  });

  // Debug Filters
  let debugFilterMode = $state("");
  let debugFilterCollege = $state("");
  let debugFilterBranch = $state("");
  let debugFilterYear = $state("");
  let debugFilterLevel = $state("");
  let debugSearch = $state("");

  // Debug view states
  let expandedDebugResult = $state<number | null>(null);
  let inspectingSubmission = $state<any>(null);
  let questionDetails = $state<Record<number, any>>({});

  // ══════════════════════════════════════════════
  //  TYPING TAB STATE
  // ══════════════════════════════════════════════
  let typingResults = $state<any[]>([]);
  let typingLoading = $state(true);
  let typingOptions = $state<any>({
      colleges: [], branches: [], years: [], levels: []
  });

  // Typing Filters
  let typingFilterCollege = $state("");
  let typingFilterBranch = $state("");
  let typingFilterYear = $state("");
  let typingFilterLevel = $state("");
  let typingFilterStatus = $state("");
  let typingSearch = $state("");

  // Typing sort
  let typingSortBy = $state<'best_wpm' | 'best_accuracy' | 'start_time'>('start_time');
  let typingSortDir = $state<'asc' | 'desc'>('desc');

  // Typing view states
  let expandedTypingResult = $state<number | null>(null);

  // ══════════════════════════════════════════════
  //  DEBUG FUNCTIONS
  // ══════════════════════════════════════════════
  async function fetchDebugOptions() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/admin/results/options", "GET", null, token);
          if (res) debugOptions = res;
      } catch (e) { console.error("Failed to fetch debug options", e); }
  }

  async function fetchDebugResults() {
      debugLoading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const params = new URLSearchParams();
          if (debugFilterMode) params.set("exam_mode", debugFilterMode);
          if (debugFilterCollege) params.set("college", debugFilterCollege);
          if (debugFilterBranch) params.set("branch", debugFilterBranch);
          if (debugFilterYear) params.set("year", debugFilterYear);
          if (debugFilterLevel) params.set("level_id", debugFilterLevel);

          const res = await api(`/admin/results?${params.toString()}`, "GET", null, token);
          if (Array.isArray(res)) debugResults = res;
          else debugResults = [];
      } catch (e) { console.error("Failed to fetch debug results", e); }
      finally { debugLoading = false; }
  }

  async function fetchQuestionDetail(questionId: number) {
      if (questionDetails[questionId]) return;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api(`/debug/question/get?id=${questionId}`, "GET", null, token);
          if (res) {
              questionDetails = { ...questionDetails, [questionId]: res };
          }
      } catch (e) { console.error("Failed to fetch question", e); }
  }

  function inspectAnswer(submission: any) {
      inspectingSubmission = submission;
      if (submission.question_id) {
          fetchQuestionDetail(submission.question_id);
      }
  }

  async function toggleGrade(sessionId: number, questionId: number, currentStatus: boolean) {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          await api("/admin/results/grade", "POST", {
              session_id: sessionId,
              question_id: questionId,
              is_correct: !currentStatus
          }, token);
          
          await fetchDebugResults();
          
          if (inspectingSubmission && inspectingSubmission.question_id === questionId) {
              inspectingSubmission = { ...inspectingSubmission, is_correct: !currentStatus };
          }
      } catch (e) { console.error("Failed to toggle grade", e); }
  }

  function clearDebugFilters() {
      debugFilterMode = "";
      debugFilterCollege = "";
      debugFilterBranch = "";
      debugFilterYear = "";
      debugFilterLevel = "";
      debugSearch = "";
      fetchDebugResults();
  }

  let filteredDebugResults = $derived(
      debugSearch
          ? debugResults.filter(r => 
              r.user_name?.toLowerCase().includes(debugSearch.toLowerCase()) ||
              r.system_code?.toLowerCase().includes(debugSearch.toLowerCase()) ||
              r.college?.toLowerCase().includes(debugSearch.toLowerCase()) ||
              r.branch?.toLowerCase().includes(debugSearch.toLowerCase())
          )
          : debugResults
  );

  let debugStats = $derived({
      total: filteredDebugResults.length,
      completed: filteredDebugResults.filter(r => r.status === 'ongoing' || r.status === 'completed').length,
      disqualified: filteredDebugResults.filter(r => r.disqualified).length,
      avgScore: filteredDebugResults.length > 0 
          ? (filteredDebugResults.reduce((s, r) => s + (r.total_score || 0), 0) / filteredDebugResults.length).toFixed(1)
          : 0
  });

  // ══════════════════════════════════════════════
  //  TYPING FUNCTIONS
  // ══════════════════════════════════════════════
  async function fetchTypingOptions() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/admin/typing/results/options", "GET", null, token);
          if (res) typingOptions = res;
      } catch (e) { console.error("Failed to fetch typing options", e); }
  }

  async function fetchTypingResults() {
      typingLoading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const params = new URLSearchParams();
          if (typingFilterCollege) params.set("college", typingFilterCollege);
          if (typingFilterBranch) params.set("branch", typingFilterBranch);
          if (typingFilterYear) params.set("year", typingFilterYear);
          if (typingFilterLevel) params.set("level_id", typingFilterLevel);
          if (typingFilterStatus) params.set("status", typingFilterStatus);

          const res = await api(`/admin/typing/results?${params.toString()}`, "GET", null, token);
          if (Array.isArray(res)) typingResults = res;
          else typingResults = [];
      } catch (e) { console.error("Failed to fetch typing results", e); }
      finally { typingLoading = false; }
  }

  function clearTypingFilters() {
      typingFilterCollege = "";
      typingFilterBranch = "";
      typingFilterYear = "";
      typingFilterLevel = "";
      typingFilterStatus = "";
      typingSearch = "";
      fetchTypingResults();
  }

  function toggleTypingSort(field: 'best_wpm' | 'best_accuracy' | 'start_time') {
      if (typingSortBy === field) {
          typingSortDir = typingSortDir === 'asc' ? 'desc' : 'asc';
      } else {
          typingSortBy = field;
          typingSortDir = 'desc';
      }
  }

  let filteredTypingResults = $derived(() => {
      let filtered = typingSearch
          ? typingResults.filter(r =>
              r.user_name?.toLowerCase().includes(typingSearch.toLowerCase()) ||
              r.system_code?.toLowerCase().includes(typingSearch.toLowerCase()) ||
              r.college?.toLowerCase().includes(typingSearch.toLowerCase()) ||
              r.branch?.toLowerCase().includes(typingSearch.toLowerCase())
          )
          : typingResults;

      // Sort
      const sorted = [...filtered].sort((a, b) => {
          let va = a[typingSortBy] || 0;
          let vb = b[typingSortBy] || 0;
          if (typingSortBy === 'start_time') {
              va = new Date(a.start_time).getTime();
              vb = new Date(b.start_time).getTime();
          }
          return typingSortDir === 'asc' ? va - vb : vb - va;
      });

      return sorted;
  });

  let typingStats = $derived(() => {
      const data = filteredTypingResults();
      return {
          total: data.length,
          passed: data.filter(r => r.passed).length,
          failed: data.filter(r => !r.passed).length,
          avgWpm: data.length > 0
              ? (data.reduce((s, r) => s + (r.best_wpm || 0), 0) / data.length).toFixed(0)
              : 0,
          avgAccuracy: data.length > 0
              ? (data.reduce((s, r) => s + (r.best_accuracy || 0), 0) / data.length).toFixed(1)
              : 0
      };
  });

  // ── Shared utils ──
  function formatDate(d: string) {
      if (!d) return '—';
      return new Date(d).toLocaleString();
  }

  function formatDuration(start: string, end: string): string {
      if (!start || !end) return '—';
      const ms = new Date(end).getTime() - new Date(start).getTime();
      if (ms < 0) return '—';
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}m ${secs}s`;
  }

  function formatTime(sec: number): string {
      if (!sec) return '—';
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function switchTab(tab: 'debug' | 'typing') {
      activeTab = tab;
  }

  // ── Contest / Leaderboard Settings ──
  let contestSettings = $state<any>({
      leaderboard_frozen: "false",
      leaderboard_visible: "true",
      contest_title: "Debugging Championship 2026"
  });
  let updatingSettings = $state(false);
  let isEditTitleModalOpen = $state(false);
  let newContestTitle = $state("");

  async function fetchContestSettings() {
      try {
          const token = localStorage.getItem("login_token") || localStorage.getItem("admin_token") || "";
          const res = await api("/admin/leaderboard/settings", "GET", null, token);
          if (res) contestSettings = res;
      } catch (e) { console.error("Failed to fetch contest settings", e); }
  }

  async function toggleFreezeScoreboard() {
      updatingSettings = true;
      try {
          const token = localStorage.getItem("login_token") || localStorage.getItem("admin_token") || "";
          const isCurrentlyFrozen = contestSettings.leaderboard_frozen === "true";
          const res = await api("/admin/leaderboard/settings", "POST", {
              leaderboard_frozen: !isCurrentlyFrozen
          }, token);
          if (res) contestSettings = res;
      } catch (e: any) {
          alert("Failed to update scoreboard settings: " + e.message);
      } finally {
          updatingSettings = false;
      }
  }

  async function saveContestTitle() {
      if (!newContestTitle.trim()) return;
      updatingSettings = true;
      try {
          const token = localStorage.getItem("login_token") || localStorage.getItem("admin_token") || "";
          const res = await api("/admin/leaderboard/settings", "POST", {
              contest_title: newContestTitle.trim()
          }, token);
          if (res) {
              contestSettings = res;
              isEditTitleModalOpen = false;
          }
      } catch (e: any) {
          alert("Failed to update arena title: " + e.message);
      } finally {
          updatingSettings = false;
      }
  }

  onMount(() => {
      fetchDebugOptions();
      fetchDebugResults();
      fetchTypingOptions();
      fetchTypingResults();
      fetchContestSettings();
  });
</script>

<div class="space-y-6">
  <!-- Page Header & Tab Switcher -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Exam Results</h1>
      <p class="text-sm text-gray-500 mt-0.5">Manage participant scores, review code submissions, and control live arena projector.</p>
    </div>

    <!-- Leaderboard Controls -->
    <div class="flex items-center gap-2.5 flex-wrap">
      <!-- Rename Contest Title Button -->
      <button
        onclick={() => { newContestTitle = contestSettings.contest_title || 'Debugging Championship 2026'; isEditTitleModalOpen = true; }}
        class="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm"
        title="Rename competition title displayed on the live projector"
      >
        <span>✏️</span>
        <span class="truncate max-w-40 md:max-w-none">Rename: <strong class="text-gray-900">{contestSettings.contest_title || 'Debugging Championship 2026'}</strong></span>
      </button>

      <!-- Freeze Toggle Button -->
      <button
        onclick={toggleFreezeScoreboard}
        disabled={updatingSettings}
        class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm {contestSettings.leaderboard_frozen === 'true'
          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        title="When frozen, student submissions are still accepted, but the public scoreboard stops updating."
      >
        <span>{contestSettings.leaderboard_frozen === 'true' ? '🧊' : '❄️'}</span>
        <span>{contestSettings.leaderboard_frozen === 'true' ? 'Scoreboard Frozen' : 'Freeze Scoreboard'}</span>
      </button>

      <!-- Open Projector Leaderboard -->
      <a
        href="/leaderboard"
        target="_blank"
        class="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg"
      >
        <span>⚡ Projector Leaderboard</span>
        <span>↗</span>
      </a>
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <!-- Tabs -->
    <div class="flex bg-gray-100 rounded-xl p-1 w-fit">
      <button
        onclick={() => switchTab('debug')}
        class="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
          {activeTab === 'debug'
            ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
            : 'text-gray-500 hover:text-gray-700'}"
      >
        <span class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          Debug Results
        </span>
      </button>
      <button
        onclick={() => switchTab('typing')}
        class="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
          {activeTab === 'typing'
            ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
            : 'text-gray-500 hover:text-gray-700'}"
      >
        <span class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd" />
          </svg>
          Typing Results
        </span>
      </button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════ -->
  <!--  DEBUG TAB                                      -->
  <!-- ═══════════════════════════════════════════════ -->
  {#if activeTab === 'debug'}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</div>
        <div class="text-2xl font-bold text-gray-900 mt-1">{debugStats.total}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</div>
        <div class="text-2xl font-bold text-green-600 mt-1">{debugStats.completed}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</div>
        <div class="text-2xl font-bold text-red-600 mt-1">{debugStats.disqualified}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</div>
        <div class="text-2xl font-bold text-blue-600 mt-1">{debugStats.avgScore} <span class="text-xs text-gray-400">Pts</span></div>
      </div>
    </div>

    <!-- Debug Filters -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</div>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <div class="block text-xs text-gray-500 mb-1">Exam Mode</div>
          <select bind:value={debugFilterMode} onchange={() => fetchDebugResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Modes</option>
            {#each debugOptions.modes as m}
              <option value={m}>{m}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">College</div>
          <select bind:value={debugFilterCollege} onchange={() => fetchDebugResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Colleges</option>
            {#each debugOptions.colleges as c}
              <option value={c}>{c}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Branch</div>
          <select bind:value={debugFilterBranch} onchange={() => fetchDebugResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Branches</option>
            {#each debugOptions.branches as b}
              <option value={b}>{b}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Year</div>
          <select bind:value={debugFilterYear} onchange={() => fetchDebugResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Years</option>
            {#each debugOptions.years as y}
              <option value={y}>Year {y}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Level</div>
          <select bind:value={debugFilterLevel} onchange={() => fetchDebugResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Levels</option>
            {#each debugOptions.levels as l}
              <option value={l.id}>{l.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="flex justify-between items-center mt-3">
        <button onclick={clearDebugFilters} class="text-sm text-gray-500 hover:text-gray-700 underline">
          Clear All Filters
        </button>
        <input 
          type="text"
          bind:value={debugSearch}
          placeholder="Quick search results..."
          class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 w-64"
        />
      </div>
    </div>

    <!-- Debug Results Table -->
    {#if debugLoading}
      <div class="py-12 text-center text-gray-500 animate-pulse">Loading results...</div>
    {:else}
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left table-auto min-w-[1000px]">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider w-8"></th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Student</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">College / Branch</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Mode</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Level</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Questions</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Duration</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Score</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each filteredDebugResults as r, i (r.session_id)}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-sm text-gray-500 font-mono">{i + 1}</td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{r.user_name || '—'}</div>
                    <div class="text-xs text-gray-400">{r.phone || ''} • Yr {r.year || '?'}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm text-gray-700">{r.college || '—'}</div>
                    <div class="text-xs text-gray-400">{r.branch || ''}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs font-bold {r.exam_mode === 'debug' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'} uppercase">
                      {r.exam_mode}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">{r.level_name}</td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{r.submitted} submitted</div>
                    {#if r.auto_submitted > 0}
                      <div class="text-xs text-orange-500">{r.auto_submitted} auto-submitted</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 font-mono">
                    {formatDuration(r.start_time, r.end_time)}
                  </td>
                  <td class="px-4 py-3">
                    {#if r.disqualified}
                      <span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">DISQUALIFIED</span>
                    {:else if r.status === 'ongoing'}
                      <span class="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">ONGOING</span>
                    {:else}
                      <span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">COMPLETED</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3">
                      <div class="text-lg font-bold text-blue-600">{r.total_score || 0}</div>
                      <div class="text-[10px] text-gray-400 uppercase tracking-tighter">Pts</div>
                  </td>
                  <td class="px-4 py-3">
                    <button 
                      onclick={() => expandedDebugResult = expandedDebugResult === r.session_id ? null : r.session_id}
                      class="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
                    >
                      {expandedDebugResult === r.session_id ? 'Hide' : 'Inspect'}
                    </button>
                  </td>
                </tr>

                <!-- Expanded: Submissions List -->
                {#if expandedDebugResult === r.session_id}
                  <tr class="bg-gray-50">
                    <td colspan="10" class="px-6 py-4">
                      <div class="space-y-3">
                        <div class="flex items-center justify-between">
                          <div class="text-sm font-semibold text-gray-700">
                            Submissions for {r.user_name} (Session #{r.session_id})
                          </div>
                          <div class="text-xs text-gray-400">
                            System: {r.system_code || '—'} • Started: {formatDate(r.start_time)}
                          </div>
                        </div>
                        
                        {#if r.submissions.length === 0}
                          <div class="text-sm text-gray-400 py-4 text-center">No submissions recorded</div>
                        {:else}
                          <div class="grid gap-2">
                            {#each r.submissions as sub, si}
                              <div class="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                                <div class="flex items-center gap-3">
                                  <span class="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">
                                    {si + 1}
                                  </span>
                                  <div>
                                    <div class="text-sm font-medium text-gray-900">
                                      {sub.question_title || `Question #${sub.question_id}`}
                                      {#if sub.difficulty}
                                        <span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                          {sub.difficulty.toLowerCase() === 'easy' ? 'bg-green-50 text-green-600 border border-green-200' : 
                                           sub.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 
                                           'bg-red-50 text-red-600 border border-red-200'}">
                                          {sub.difficulty}
                                        </span>
                                      {/if}
                                    </div>
                                    <div class="text-xs text-gray-400 flex items-center gap-2">
                                      <span class="capitalize">{sub.question_type || 'full_edit'}</span>
                                      {#if sub.auto}
                                        <span class="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold">AUTO</span>
                                      {/if}
                                      {#if sub.reason && sub.reason !== 'submitted'}
                                        <span class="text-red-400">{sub.reason}</span>
                                      {/if}
                                      <span>{formatDate(sub.timestamp)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div class="flex items-center gap-2">
                                  <button 
                                    onclick={() => toggleGrade(r.session_id, sub.question_id, sub.is_correct)}
                                    class="text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors
                                      {sub.is_correct ? 'bg-green-500 text-white border-green-600' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-600'}"
                                  >
                                    {sub.is_correct ? '✓ Correct' : 'Mark Correct'}
                                  </button>
                                  <button 
                                    onclick={() => inspectAnswer(sub)}
                                    class="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium"
                                  >
                                    View Answer
                                  </button>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
              
              {#if filteredDebugResults.length === 0}
                <tr>
                  <td colspan="10" class="px-6 py-12 text-center text-gray-400">
                    No results found. Adjust your filters or wait for exams to complete.
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

  <!-- ═══════════════════════════════════════════════ -->
  <!--  TYPING TAB                                     -->
  <!-- ═══════════════════════════════════════════════ -->
  {:else}
    <!-- Typing Stats Cards -->
    {@const ts = typingStats()}
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</div>
        <div class="text-2xl font-bold text-gray-900 mt-1">{ts.total}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Passed</div>
        <div class="text-2xl font-bold text-green-600 mt-1">{ts.passed}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</div>
        <div class="text-2xl font-bold text-red-600 mt-1">{ts.failed}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg WPM</div>
        <div class="text-2xl font-bold text-blue-600 mt-1">{ts.avgWpm} <span class="text-xs text-gray-400">wpm</span></div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Accuracy</div>
        <div class="text-2xl font-bold text-purple-600 mt-1">{ts.avgAccuracy}<span class="text-xs text-gray-400">%</span></div>
      </div>
    </div>

    <!-- Typing Filters -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</div>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <div class="block text-xs text-gray-500 mb-1">College</div>
          <select bind:value={typingFilterCollege} onchange={() => fetchTypingResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Colleges</option>
            {#each typingOptions.colleges as c}
              <option value={c}>{c}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Branch</div>
          <select bind:value={typingFilterBranch} onchange={() => fetchTypingResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Branches</option>
            {#each typingOptions.branches as b}
              <option value={b}>{b}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Year</div>
          <select bind:value={typingFilterYear} onchange={() => fetchTypingResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Years</option>
            {#each typingOptions.years as y}
              <option value={y}>Year {y}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Level</div>
          <select bind:value={typingFilterLevel} onchange={() => fetchTypingResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Levels</option>
            {#each typingOptions.levels as l}
              <option value={l.id}>{l.name}</option>
            {/each}
          </select>
        </div>
        <div>
          <div class="block text-xs text-gray-500 mb-1">Status</div>
          <select bind:value={typingFilterStatus} onchange={() => fetchTypingResults()} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </div>
      </div>
      <div class="flex justify-between items-center mt-3">
        <button onclick={clearTypingFilters} class="text-sm text-gray-500 hover:text-gray-700 underline">
          Clear All Filters
        </button>
        <input 
          type="text"
          bind:value={typingSearch}
          placeholder="Quick search results..."
          class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 w-64"
        />
      </div>
    </div>

    <!-- Typing Results Table -->
    {#if typingLoading}
      <div class="py-12 text-center text-gray-500 animate-pulse">Loading typing results...</div>
    {:else}
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left table-auto min-w-[1100px]">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider w-8"></th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Student</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">College / Branch</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Level</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider cursor-pointer select-none hover:text-gray-700" onclick={() => toggleTypingSort('best_wpm')}>
                  Best WPM
                  {#if typingSortBy === 'best_wpm'}
                    <span class="ml-1">{typingSortDir === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider cursor-pointer select-none hover:text-gray-700" onclick={() => toggleTypingSort('best_accuracy')}>
                  Best Accuracy
                  {#if typingSortBy === 'best_accuracy'}
                    <span class="ml-1">{typingSortDir === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Attempts</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Result</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Duration</th>
                <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each filteredTypingResults() as r, i (r.session_id)}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-sm text-gray-500 font-mono">{i + 1}</td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{r.user_name || '—'}</div>
                    <div class="text-xs text-gray-400">{r.phone || ''} • Yr {r.year || '?'}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm text-gray-700">{r.college || '—'}</div>
                    <div class="text-xs text-gray-400">{r.branch || ''}</div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">{r.level_name || '—'}</td>
                  <td class="px-4 py-3">
                    <div class="text-lg font-bold text-blue-600">{r.best_wpm || 0}</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-tighter">wpm</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-lg font-bold {r.best_accuracy >= 90 ? 'text-green-600' : r.best_accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'}">{r.best_accuracy || 0}%</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-tighter">accuracy</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{r.total_attempts || 0}</div>
                  </td>
                  <td class="px-4 py-3">
                    {#if r.passed}
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">PASSED</span>
                    {:else if r.status === 'ongoing'}
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">ONGOING</span>
                    {:else}
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">FAILED</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 font-mono">
                    {formatDuration(r.start_time, r.end_time)}
                  </td>
                  <td class="px-4 py-3">
                    <button 
                      onclick={() => expandedTypingResult = expandedTypingResult === r.session_id ? null : r.session_id}
                      class="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
                    >
                      {expandedTypingResult === r.session_id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>

                <!-- Expanded: Typing Attempts Detail -->
                {#if expandedTypingResult === r.session_id}
                  <tr class="bg-gray-50">
                    <td colspan="10" class="px-6 py-4">
                      <div class="space-y-3">
                        <div class="flex items-center justify-between">
                          <div class="text-sm font-semibold text-gray-700">
                            Attempts for {r.user_name} (Session #{r.session_id})
                          </div>
                          <div class="text-xs text-gray-400">
                            System: {r.system_code || '—'} • Started: {formatDate(r.start_time)}
                          </div>
                        </div>
                        
                        {#if !r.attempts || r.attempts.length === 0}
                          <div class="text-sm text-gray-400 py-4 text-center">No attempts recorded</div>
                        {:else}
                          <div class="grid gap-3">
                            {#each r.attempts as attempt, ai}
                              <div class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                                <div class="flex items-center justify-between mb-3">
                                  <div class="flex items-center gap-3">
                                    <span class="w-8 h-8 rounded-full {attempt.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} flex items-center justify-center text-xs font-bold">
                                      {ai + 1}
                                    </span>
                                    <div>
                                      <div class="text-sm font-medium text-gray-900">Attempt #{attempt.attempt_num || ai + 1}</div>
                                      <div class="text-xs text-gray-400">{formatDate(attempt.timestamp)}</div>
                                    </div>
                                  </div>
                                  <span class="px-2.5 py-1 rounded-full text-xs font-bold {attempt.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                    {attempt.passed ? '✓ PASSED' : '✗ FAILED'}
                                  </span>
                                </div>

                                <!-- Stats Grid -->
                                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-blue-600">{attempt.wpm}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">WPM</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-gray-600">{attempt.raw_wpm}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Raw WPM</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold {attempt.accuracy >= 90 ? 'text-green-600' : attempt.accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'}">{attempt.accuracy}%</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Accuracy</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-purple-600">{attempt.consistency}%</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Consistency</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-green-600">{attempt.correct_chars}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Correct</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-red-600">{attempt.incorrect_chars}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Incorrect</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-gray-700">{attempt.words_completed}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Words</div>
                                  </div>
                                  <div class="bg-gray-50 rounded-lg p-2.5 text-center">
                                    <div class="text-lg font-bold text-gray-700">{formatTime(attempt.time_elapsed)}</div>
                                    <div class="text-[10px] text-gray-400 uppercase">Time</div>
                                  </div>
                                </div>

                                <!-- Char breakdown bar -->
                                {#if attempt.correct_chars + attempt.incorrect_chars + attempt.extra_chars + attempt.missed_chars > 0}
                                  {@const totalChars = attempt.correct_chars + attempt.incorrect_chars + attempt.extra_chars + attempt.missed_chars}
                                  <div class="mt-3">
                                    <div class="flex rounded-full overflow-hidden h-2">
                                      <div class="bg-green-400" style="width: {(attempt.correct_chars / totalChars) * 100}%"></div>
                                      <div class="bg-red-400" style="width: {(attempt.incorrect_chars / totalChars) * 100}%"></div>
                                      <div class="bg-orange-400" style="width: {(attempt.extra_chars / totalChars) * 100}%"></div>
                                      <div class="bg-gray-300" style="width: {(attempt.missed_chars / totalChars) * 100}%"></div>
                                    </div>
                                    <div class="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                                      <span><span class="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span>Correct {attempt.correct_chars}</span>
                                      <span><span class="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"></span>Incorrect {attempt.incorrect_chars}</span>
                                      <span><span class="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>Extra {attempt.extra_chars}</span>
                                      <span><span class="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1"></span>Missed {attempt.missed_chars}</span>
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
              
              {#if filteredTypingResults().length === 0}
                <tr>
                  <td colspan="10" class="px-6 py-12 text-center text-gray-400">
                    No typing results found. Adjust your filters or wait for typing exams to complete.
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>

<svelte:window onkeydown={(e) => e.key === 'Escape' && inspectingSubmission && (inspectingSubmission = null)} />

<!-- Answer Inspector Modal (Debug only) -->
{#if inspectingSubmission}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Answer inspector">
    <button 
      type="button"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default w-full h-full border-0" 
      onclick={() => inspectingSubmission = null}
      aria-label="Close answer inspector backdrop"
      tabindex="-1"
    ></button>
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto z-10" role="document">
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900">
            {inspectingSubmission.question_title || `Question #${inspectingSubmission.question_id}`}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Type: <span class="capitalize font-medium">{inspectingSubmission.question_type || 'full_edit'}</span>
            {#if inspectingSubmission.auto}
              <span class="ml-2 px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-xs font-bold">AUTO-SUBMITTED</span>
            {/if}
          </p>
        </div>
        <button onclick={() => inspectingSubmission = null} class="text-gray-400 hover:text-gray-600 p-1" aria-label="Close answer inspector">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-6 space-y-4">
        <!-- Question Description (if loaded) -->
        {#if questionDetails[inspectingSubmission.question_id]}
          {@const q = questionDetails[inspectingSubmission.question_id]}
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Question Description</div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{q.description || 'No description'}</div>
          </div>
        {/if}

        <!-- Original Code vs Submitted Answer -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Original Code</div>
            <pre class="bg-gray-800 text-gray-300 p-4 rounded-lg text-xs overflow-x-auto max-h-[400px] overflow-y-auto font-mono leading-relaxed">{inspectingSubmission.original_code || questionDetails[inspectingSubmission.question_id]?.code_snippet || 'Not available'}</pre>
          </div>
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              Submitted Answer
              {#if inspectingSubmission.auto}
                <span class="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold">AUTO</span>
              {/if}
            </div>
            <pre class="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-[400px] overflow-y-auto font-mono leading-relaxed">{inspectingSubmission.answer || 'No answer submitted'}</pre>
          </div>
        </div>

        <!-- Marked Lines (for find_buggy_line) -->
        {#if inspectingSubmission.marked_lines?.length}
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Marked Buggy Lines</div>
            <div class="flex flex-wrap gap-2">
              {#each inspectingSubmission.marked_lines as line}
                <span class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-mono font-bold">Line {line}</span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Added Lines (for add_lines) -->
        {#if inspectingSubmission.added_lines?.length}
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Added Lines</div>
            <div class="space-y-1">
              {#each inspectingSubmission.added_lines as line}
                <div class="bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-sm font-mono">
                  <span class="text-green-600 font-bold">+ After line {line.afterLine}:</span> 
                  <code class="text-green-800 ml-2">{line.content}</code>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Submitted at -->
        <div class="text-xs text-gray-400 text-right">
          Submitted at: {formatDate(inspectingSubmission.timestamp)}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ═══════════════════════════════════════════════ -->
<!--  RENAME ARENA TITLE MODAL                       -->
<!-- ═══════════════════════════════════════════════ -->
{#if isEditTitleModalOpen}
  <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div class="p-6 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>⚡</span> Rename Contest Arena
        </h3>
        <button
          onclick={() => isEditTitleModalOpen = false}
          class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label for="contest-name-input" class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Contest / Leaderboard Name
          </label>
          <input
            id="contest-name-input"
            type="text"
            bind:value={newContestTitle}
            placeholder="e.g. Debugging Championship 2026"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm font-medium text-gray-900"
          />
          <p class="text-xs text-gray-500 mt-1.5">
            This title is displayed on the live projector screen at <code class="text-cyan-700 bg-cyan-50 px-1 py-0.5 rounded font-mono">/leaderboard</code>.
          </p>
        </div>
      </div>

      <div class="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
        <button
          onclick={() => isEditTitleModalOpen = false}
          class="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={saveContestTitle}
          disabled={updatingSettings || !newContestTitle.trim()}
          class="px-5 py-2 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-sm disabled:opacity-50"
        >
          {updatingSettings ? 'Saving...' : 'Update Title'}
        </button>
      </div>
    </div>
  </div>
{/if}
