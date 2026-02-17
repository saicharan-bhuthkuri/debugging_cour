<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";

  let results = $state<any[]>([]);
  let loading = $state(true);
  
  // Group options
  let groupOptions = $state<any>({
      colleges: [], branches: [], years: [], levels: [], modes: []
  });

  // Filters
  let filterMode = $state("");
  let filterCollege = $state("");
  let filterBranch = $state("");
  let filterYear = $state("");
  let filterLevel = $state("");
  let searchQuery = $state("");

  // View states
  let expandedResult = $state<number | null>(null);
  let inspectingSubmission = $state<any>(null);
  let questionDetails = $state<Record<number, any>>({});

  async function fetchOptions() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/admin/results/options", "GET", null, token);
          if (res) groupOptions = res;
      } catch (e) {
          console.error("Failed to fetch options", e);
      }
  }

  async function fetchResults() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const params = new URLSearchParams();
          if (filterMode) params.set("exam_mode", filterMode);
          if (filterCollege) params.set("college", filterCollege);
          if (filterBranch) params.set("branch", filterBranch);
          if (filterYear) params.set("year", filterYear);
          if (filterLevel) params.set("level_id", filterLevel);

          const res = await api(`/admin/results?${params.toString()}`, "GET", null, token);
          if (Array.isArray(res)) results = res;
          else results = [];
      } catch (e) {
          console.error("Failed to fetch results", e);
      } finally {
          loading = false;
      }
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
      } catch (e) {
          console.error("Failed to fetch question", e);
      }
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
          
          // Refresh results to show new score
          await fetchResults();
          
          // If inspecting, update the inspectingSubmission state too
          if (inspectingSubmission && inspectingSubmission.question_id === questionId) {
              inspectingSubmission = { ...inspectingSubmission, is_correct: !currentStatus };
          }
      } catch (e) {
          console.error("Failed to toggle grade", e);
      }
  }

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

  function handleFilter() {
      fetchResults();
  }

  function clearFilters() {
      filterMode = "";
      filterCollege = "";
      filterBranch = "";
      filterYear = "";
      filterLevel = "";
      searchQuery = "";
      fetchResults();
  }

  // Filter results by search locally
  let filteredResults = $derived(
      searchQuery
          ? results.filter(r => 
              r.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.system_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.college?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.branch?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          : results
  );

  // Stats
  let stats = $derived({
      total: filteredResults.length,
      completed: filteredResults.filter(r => r.status === 'ongoing' || r.status === 'completed').length,
      disqualified: filteredResults.filter(r => r.disqualified).length,
      avgScore: filteredResults.length > 0 
          ? (filteredResults.reduce((s, r) => s + (r.total_score || 0), 0) / filteredResults.length).toFixed(1)
          : 0
  });

  onMount(() => {
      fetchOptions();
      fetchResults();
  });
</script>

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">Exam Results</h1>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</div>
      <div class="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</div>
      <div class="text-2xl font-bold text-green-600 mt-1">{stats.completed}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</div>
      <div class="text-2xl font-bold text-red-600 mt-1">{stats.disqualified}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</div>
      <div class="text-2xl font-bold text-blue-600 mt-1">{stats.avgScore} <span class="text-xs text-gray-400">Pts</span></div>
    </div>
  </div>

  <!-- Group Filters -->
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filter by Group</div>
    <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <div class="block text-xs text-gray-500 mb-1">Exam Mode</div>
        <select bind:value={filterMode} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Modes</option>
          {#each groupOptions.modes as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">College</div>
        <select bind:value={filterCollege} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Colleges</option>
          {#each groupOptions.colleges as c}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">Branch</div>
        <select bind:value={filterBranch} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Branches</option>
          {#each groupOptions.branches as b}
            <option value={b}>{b}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">Year</div>
        <select bind:value={filterYear} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Years</option>
          {#each groupOptions.years as y}
            <option value={y}>Year {y}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">Level</div>
        <select bind:value={filterLevel} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Levels</option>
          {#each groupOptions.levels as l}
            <option value={l.id}>{l.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="flex justify-between items-center mt-3">
      <button onclick={clearFilters} class="text-sm text-gray-500 hover:text-gray-700 underline">
        Clear All Filters
      </button>
      <input 
        type="text"
        bind:value={searchQuery}
        placeholder="Quick search results..."
        class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 w-64"
      />
    </div>
  </div>

  <!-- Results Table -->
  {#if loading}
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
            {#each filteredResults as r, i (r.session_id)}
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
                    onclick={() => expandedResult = expandedResult === r.session_id ? null : r.session_id}
                    class="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
                  >
                    {expandedResult === r.session_id ? 'Hide' : 'Inspect'}
                  </button>
                </td>
              </tr>

              <!-- Expanded: Submissions List -->
              {#if expandedResult === r.session_id}
                <tr class="bg-gray-50">
                  <td colspan="9" class="px-6 py-4">
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
            
            {#if filteredResults.length === 0}
              <tr>
                <td colspan="9" class="px-6 py-12 text-center text-gray-400">
                  No results found. Adjust your filters or wait for exams to complete.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Answer Inspector Modal -->
{#if inspectingSubmission}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick={() => inspectingSubmission = null} onkeydown={(e) => e.key === 'Escape' && (inspectingSubmission = null)} role="dialog" tabindex="-1" aria-label="Answer inspector">
    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()} role="document">
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

        <!-- Original Code vs Submitted Answer (side by side on desktop) -->
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
