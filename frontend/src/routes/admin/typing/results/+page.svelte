<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";

  let results = $state<any[]>([]);
  let loading = $state(true);

  // Filters
  let filterCollege = $state("");
  let filterBranch = $state("");
  let filterYear = $state("");
  let searchQuery = $state("");

  // View states
  let expandedResult = $state<number | null>(null);

  // Filter options (derived from results)
  let colleges = $derived([...new Set(results.map(r => r.college).filter(Boolean))].sort());
  let branches = $derived([...new Set(results.map(r => r.branch).filter(Boolean))].sort());
  let years = $derived([...new Set(results.map(r => r.year).filter(Boolean))].sort());

  async function fetchResults() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const params = new URLSearchParams();
          if (filterCollege) params.set("college", filterCollege);
          if (filterBranch) params.set("branch", filterBranch);
          if (filterYear) params.set("year", filterYear);

          const res = await api(`/admin/typing/results?${params.toString()}`, "GET", null, token);
          if (Array.isArray(res)) results = res;
          else results = [];
      } catch (e) {
          console.error("Failed to fetch typing results", e);
      } finally {
          loading = false;
      }
  }

  function formatDate(d: string) {
      if (!d) return '—';
      return new Date(d).toLocaleString();
  }

  function formatTime(sec: number): string {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleFilter() {
      fetchResults();
  }

  function clearFilters() {
      filterCollege = "";
      filterBranch = "";
      filterYear = "";
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
      passed: filteredResults.filter(r => r.passed).length,
      failed: filteredResults.filter(r => !r.passed && r.total_attempts > 0).length,
      avgWpm: filteredResults.length > 0 
          ? Math.round(filteredResults.reduce((s, r) => s + (r.best_wpm || 0), 0) / filteredResults.length)
          : 0,
      avgAcc: filteredResults.length > 0
          ? Math.round(filteredResults.reduce((s, r) => s + (r.best_accuracy || 0), 0) / filteredResults.length)
          : 0
  });

  onMount(() => {
      fetchResults();
  });

  // Mini sparkline canvas drawing (Svelte action)
  function sparkline(canvas: HTMLCanvasElement, data: number[]) {
      function draw(data: number[]) {
          if (!canvas || !data || data.length === 0) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const dpr = window.devicePixelRatio || 1;
          canvas.width = canvas.offsetWidth * dpr;
          canvas.height = canvas.offsetHeight * dpr;
          ctx.scale(dpr, dpr);

          const w = canvas.offsetWidth;
          const h = canvas.offsetHeight;
          const max = Math.max(...data, 1);
          const step = w / Math.max(1, data.length - 1);

          ctx.beginPath();
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';

          data.forEach((val, i) => {
              const x = i * step;
              const y = h - (val / max) * (h - 4) - 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          });
          ctx.stroke();

          // Fill
          ctx.lineTo((data.length - 1) * step, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
          grad.addColorStop(1, 'rgba(99, 102, 241, 0)');
          ctx.fillStyle = grad;
          ctx.fill();
      }

      draw(data);

      return {
          update(newData: number[]) { draw(newData); },
          destroy() {}
      };
  }
</script>

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">Typing Test Results</h1>
    <button onclick={fetchResults} class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
      </svg>
      Refresh
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</div>
      <div class="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Passed</div>
      <div class="text-2xl font-bold text-green-600 mt-1">{stats.passed}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</div>
      <div class="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg WPM</div>
      <div class="text-2xl font-bold text-indigo-600 mt-1">{stats.avgWpm}</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Accuracy</div>
      <div class="text-2xl font-bold text-indigo-600 mt-1">{stats.avgAcc}%</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filter by Group</div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <div class="block text-xs text-gray-500 mb-1">College</div>
        <select bind:value={filterCollege} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Colleges</option>
          {#each colleges as c}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">Branch</div>
        <select bind:value={filterBranch} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Branches</option>
          {#each branches as b}
            <option value={b}>{b}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs text-gray-500 mb-1">Year</div>
        <select bind:value={filterYear} onchange={handleFilter} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Years</option>
          {#each years as y}
            <option value={y}>Year {y}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-end">
        <button onclick={clearFilters} class="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
          Clear Filters
        </button>
      </div>
    </div>
    <div class="mt-3">
      <input 
        type="text"
        bind:value={searchQuery}
        placeholder="Quick search by name, system, college..."
        class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 w-full md:w-80"
      />
    </div>
  </div>

  <!-- Results Table -->
  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">Loading typing results...</div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left table-auto min-w-[900px]">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider w-8"></th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Student</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">College / Branch</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Level</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Best WPM</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Best Acc</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Attempts</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
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
                <td class="px-4 py-3 text-sm text-gray-700">{r.level_name}</td>
                <td class="px-4 py-3">
                  <div class="text-lg font-bold text-indigo-600">{r.best_wpm || 0}</div>
                  <div class="text-[10px] text-gray-400 uppercase tracking-tighter">wpm</div>
                </td>
                <td class="px-4 py-3">
                  <div class="text-lg font-bold {r.best_accuracy >= 90 ? 'text-green-600' : r.best_accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'}">{r.best_accuracy || 0}%</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 font-mono">{r.total_attempts}</td>
                <td class="px-4 py-3">
                  {#if r.passed}
                    <span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">PASSED</span>
                  {:else if r.total_attempts > 0}
                    <span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">FAILED</span>
                  {:else}
                    <span class="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">ONGOING</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <button 
                    onclick={() => expandedResult = expandedResult === r.session_id ? null : r.session_id}
                    class="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
                  >
                    {expandedResult === r.session_id ? 'Hide' : 'Details'}
                  </button>
                </td>
              </tr>

              <!-- Expanded: Attempt Details -->
              {#if expandedResult === r.session_id}
                <tr class="bg-gray-50">
                  <td colspan="9" class="px-6 py-4">
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-semibold text-gray-700">
                          Typing Attempts for {r.user_name} (Session #{r.session_id})
                        </div>
                        <div class="text-xs text-gray-400">
                          System: {r.system_code || '—'} • Started: {formatDate(r.start_time)}
                        </div>
                      </div>
                      
                      {#if r.attempts.length === 0}
                        <div class="text-sm text-gray-400 py-4 text-center">No attempts recorded yet</div>
                      {:else}
                        <div class="grid gap-3">
                          {#each r.attempts as attempt, ai}
                            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                              <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                  <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                                    {attempt.attempt_num}
                                  </span>
                                  <div>
                                    <div class="text-sm font-medium text-gray-900">
                                      Attempt #{attempt.attempt_num}
                                      {#if attempt.passed}
                                        <span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Passed</span>
                                      {:else}
                                        <span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">Failed</span>
                                      {/if}
                                    </div>
                                    <div class="text-xs text-gray-400">{formatDate(attempt.timestamp)}</div>
                                  </div>
                                </div>
                              </div>

                              <!-- Attempt Stats Grid -->
                              <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold text-indigo-600">{attempt.wpm}</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">WPM</div>
                                </div>
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold text-gray-600">{attempt.raw_wpm}</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">Raw WPM</div>
                                </div>
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold {attempt.accuracy >= 90 ? 'text-green-600' : attempt.accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'}">{attempt.accuracy}%</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">Accuracy</div>
                                </div>
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold text-gray-700">{attempt.consistency}%</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">Consistency</div>
                                </div>
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold text-gray-600">{formatTime(attempt.time_elapsed)}</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">Time</div>
                                </div>
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                  <div class="text-lg font-bold text-gray-600">{attempt.words_completed}</div>
                                  <div class="text-[10px] text-gray-400 uppercase font-medium">Words</div>
                                </div>
                              </div>

                              <!-- Character Breakdown -->
                              <div class="mt-3 flex items-center gap-4 text-xs">
                                <span class="flex items-center gap-1">
                                  <span class="w-2 h-2 rounded-full bg-green-500"></span>
                                  <span class="text-gray-500">Correct:</span>
                                  <span class="font-bold text-green-600">{attempt.correct_chars}</span>
                                </span>
                                <span class="flex items-center gap-1">
                                  <span class="w-2 h-2 rounded-full bg-red-500"></span>
                                  <span class="text-gray-500">Incorrect:</span>
                                  <span class="font-bold text-red-600">{attempt.incorrect_chars}</span>
                                </span>
                                <span class="flex items-center gap-1">
                                  <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                                  <span class="text-gray-500">Extra:</span>
                                  <span class="font-bold text-orange-600">{attempt.extra_chars}</span>
                                </span>
                                <span class="flex items-center gap-1">
                                  <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                                  <span class="text-gray-500">Missed:</span>
                                  <span class="font-bold text-gray-600">{attempt.missed_chars}</span>
                                </span>
                              </div>

                              <!-- WPM Sparkline -->
                              {#if attempt.wpm_history && attempt.wpm_history.length > 1}
                                <div class="mt-3">
                                  <div class="text-[10px] text-gray-400 uppercase font-medium mb-1">WPM Over Time</div>
                                  <canvas 
                                    class="w-full h-10"
                                    use:sparkline={attempt.wpm_history}
                                  ></canvas>
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
            
            {#if filteredResults.length === 0}
              <tr>
                <td colspan="9" class="px-6 py-12 text-center text-gray-400">
                  No typing results found. Results will appear here after students complete their typing tests.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
