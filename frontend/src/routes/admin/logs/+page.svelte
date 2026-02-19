<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";

  let logs = $state<any[]>([]);
  let total = $state(0);
  let loading = $state(true);
  let logTypes = $state<string[]>([]);

  // Filters
  let filterType = $state("");
  let filterSessionId = $state("");
  let filterSystemCode = $state("");
  let searchQuery = $state("");
  let currentPage = $state(1);
  const pageSize = 50;

  // Expanded rows
  let expandedRows = $state<Set<number>>(new Set());

  // Session detail modal
  let showSessionModal = $state(false);
  let sessionDetail = $state<any>(null);
  let sessionLogs = $state<any[]>([]);
  let loadingSession = $state(false);

  async function fetchLogs() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const params = new URLSearchParams();
          if (filterType) params.set("log_type", filterType);
          if (filterSessionId) params.set("session_id", filterSessionId);
          if (filterSystemCode) params.set("system_code", filterSystemCode);
          if (searchQuery) params.set("search", searchQuery);
          params.set("limit", String(pageSize));
          params.set("offset", String((currentPage - 1) * pageSize));

          const res = await api(`/admin/logs?${params.toString()}`, "GET", null, token);
          if (res?.logs) {
              logs = res.logs;
              total = res.total || 0;
          }
      } catch (e) {
          console.error("Failed to fetch logs", e);
      } finally {
          loading = false;
      }
  }

  async function fetchLogTypes() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/admin/logs/types", "GET", null, token);
          if (Array.isArray(res)) logTypes = res;
      } catch (e) {
          console.error("Failed to fetch log types", e);
      }
  }

  async function viewSession(sessionId: number) {
      loadingSession = true;
      showSessionModal = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api(`/admin/session/detail?id=${sessionId}`, "GET", null, token);
          if (res) {
              sessionDetail = res.session;
              sessionLogs = res.logs || [];
          }
      } catch (e) {
          console.error("Failed to fetch session", e);
      } finally {
          loadingSession = false;
      }
  }

  function toggleRow(id: number) {
      const newSet = new Set(expandedRows);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      expandedRows = newSet;
  }

  function getLogTypeColor(type: string): string {
      const colors: Record<string, string> = {
          'EXAM_START': 'bg-green-100 text-green-700',
          'EXAM_FINISH': 'bg-blue-100 text-blue-700',
          'SUBMIT': 'bg-purple-100 text-purple-700',
          'AUTO_SUBMIT_TIMEOUT': 'bg-orange-100 text-orange-700',
          'AUTO_SUBMIT_FINAL': 'bg-orange-100 text-orange-700',
          'NAVIGATE': 'bg-gray-100 text-gray-600',
          'SKIP': 'bg-yellow-100 text-yellow-700',
          'HOLD': 'bg-yellow-100 text-yellow-700',
          'RUN_CODE': 'bg-cyan-100 text-cyan-700',
          'TAB_SWITCH_WARNING': 'bg-red-100 text-red-700',
          'WINDOW_BLUR_WARNING': 'bg-red-100 text-red-700',
          'DISQUALIFIED': 'bg-red-200 text-red-900',
      };
      return colors[type] || 'bg-gray-100 text-gray-600';
  }

  function formatDate(d: string) {
      if (!d) return '—';
      return new Date(d).toLocaleString();
  }

  function handleSearch() {
      currentPage = 1;
      fetchLogs();
  }

  function prevPage() {
      if (currentPage > 1) { currentPage--; fetchLogs(); }
  }

  function nextPage() {
      if (currentPage * pageSize < total) { currentPage++; fetchLogs(); }
  }

  onMount(() => {
      fetchLogs();
      fetchLogTypes();
  });
</script>

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">System Logs</h1>
    <div class="text-sm text-gray-500">
      {total} total logs
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <div class="block text-xs font-medium text-gray-500 mb-1">Search</div>
        <input 
          type="text" 
          bind:value={searchQuery}
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="User, system, type..." 
          class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </div>
      <div>
        <div class="block text-xs font-medium text-gray-500 mb-1">Log Type</div>
        <select bind:value={filterType} onchange={handleSearch} class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="">All Types</option>
          {#each logTypes as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>
      <div>
        <div class="block text-xs font-medium text-gray-500 mb-1">Session ID</div>
        <input 
          type="text"
          bind:value={filterSessionId}
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Session ID"
          class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </div>
      <div>
        <div class="block text-xs font-medium text-gray-500 mb-1">System Code</div>
        <input 
          type="text"
          bind:value={filterSystemCode}
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="SYS-001"
          class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </div>
    </div>
    <div class="mt-3 flex justify-end">
      <button onclick={handleSearch} class="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors">
        Apply Filters
      </button>
    </div>
  </div>

  <!-- Logs Table -->
  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">Loading logs...</div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left table-auto min-w-[900px]">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider w-8"></th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Time</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Type</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">User</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">System</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Session</th>
              <th class="px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Summary</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each logs as log (log.id)}
              <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick={() => toggleRow(log.id)}>
                <td class="px-4 py-3 text-sm">
                  <span class="text-gray-400 transition-transform inline-block {expandedRows.has(log.id) ? 'rotate-90' : ''}">▶</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                  {formatDate(log.timestamp)}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-xs font-bold {getLogTypeColor(log.log_type)}">
                    {log.log_type}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  {log.user_name || '—'}
                  {#if log.branch}
                    <span class="text-xs text-gray-400 ml-1">({log.branch})</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 font-mono">{log.system_code || '—'}</td>
                <td class="px-4 py-3">
                  {#if log.exam_session_id}
                    <button 
                      onclick={(e) => { e.stopPropagation(); viewSession(log.exam_session_id); }}
                      class="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      #{log.exam_session_id}
                    </button>
                  {:else}
                    <span class="text-sm text-gray-400">—</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 truncate max-w-[250px]">
                  {#if log.data?.question_title}
                    Q: {log.data.question_title}
                  {:else if log.data?.msg}
                    {log.data.msg}
                  {:else if log.data?.reason}
                    {log.data.reason}
                  {:else}
                    —
                  {/if}
                </td>
              </tr>

              <!-- Expanded Row -->
              {#if expandedRows.has(log.id)}
                <tr class="bg-gray-50">
                  <td colspan="7" class="px-6 py-4">
                    <div class="space-y-3">
                      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Log Data</div>
                      
                      {#if log.data?.answer}
                        <div>
                          <div class="text-xs font-medium text-gray-500 mb-1">Submitted Answer:</div>
                          <pre class="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto max-h-[300px] overflow-y-auto font-mono">{log.data.answer}</pre>
                        </div>
                      {/if}

                      {#if log.data?.original_code}
                        <div>
                          <div class="text-xs font-medium text-gray-500 mb-1">Original Code:</div>
                          <pre class="bg-gray-800 text-gray-300 p-3 rounded-lg text-xs overflow-x-auto max-h-[200px] overflow-y-auto font-mono">{log.data.original_code}</pre>
                        </div>
                      {/if}

                      {#if log.data?.marked_lines?.length}
                        <div>
                          <span class="text-xs font-medium text-gray-500">Marked Lines: </span>
                          <span class="text-sm font-mono text-purple-600">{log.data.marked_lines.join(', ')}</span>
                        </div>
                      {/if}

                      {#if log.data?.added_lines?.length}
                        <div>
                          <div class="text-xs font-medium text-gray-500 mb-1">Added Lines:</div>
                          {#each log.data.added_lines as line}
                            <div class="text-xs font-mono bg-green-50 border border-green-200 px-2 py-1 rounded mb-1">
                              After line {line.afterLine}: <code>{line.content}</code>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <!-- Full JSON data -->
                      <details class="mt-2">
                        <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Raw JSON</summary>
                        <pre class="mt-1 bg-gray-100 text-gray-700 p-2 rounded text-xs overflow-x-auto max-h-[200px] overflow-y-auto font-mono">{JSON.stringify(log.data, null, 2)}</pre>
                      </details>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
            
            {#if logs.length === 0}
              <tr>
                <td colspan="7" class="px-6 py-12 text-center text-gray-400">No logs found</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div class="text-sm text-gray-500">
          Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, total)} of {total}
        </div>
        <div class="flex gap-2">
          <button onclick={prevPage} disabled={currentPage <= 1} class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
            ← Prev
          </button>
          <span class="px-3 py-1 text-sm text-gray-600">Page {currentPage}</span>
          <button onclick={nextPage} disabled={currentPage * pageSize >= total} class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
            Next →
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Session Detail Modal -->
{#if showSessionModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick={() => showSessionModal = false} onkeydown={(e) => e.key === 'Escape' && (showSessionModal = false)} role="dialog" tabindex="-1" aria-label="Session detail">
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onclick={(e) => e.stopPropagation()} role="document">
      {#if loadingSession}
        <div class="p-12 text-center text-gray-500 animate-pulse">Loading session...</div>
      {:else if sessionDetail}
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-gray-900">Session #{sessionDetail.id}</h2>
            <p class="text-sm text-gray-500 mt-1">{sessionDetail.user_name || 'Unknown'} • {sessionDetail.system_code || '—'} • {sessionDetail.exam_mode}</p>
          </div>
          <button onclick={() => showSessionModal = false} class="text-gray-400 hover:text-gray-600 p-1" aria-label="Close session detail">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200 bg-gray-50">
          <div>
            <div class="text-xs text-gray-500">Status</div>
            <div class="text-sm font-semibold text-gray-900 capitalize">{sessionDetail.status}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Exam Type</div>
            <div class="text-sm font-semibold text-gray-900 capitalize">{sessionDetail.exam_mode}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Started</div>
            <div class="text-xs font-mono text-gray-700">{formatDate(sessionDetail.start_time)}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">User Info</div>
            <div class="text-xs text-gray-700">{sessionDetail.college || ''} • {sessionDetail.branch || ''} • Year {sessionDetail.user_year || '?'}</div>
          </div>
        </div>

        <div class="p-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Session Timeline ({sessionLogs.length} events)</h3>
          <div class="space-y-2 max-h-[400px] overflow-y-auto">
            {#each sessionLogs as log}
              <div class="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <span class="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap {getLogTypeColor(log.log_type)}">
                  {log.log_type}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-gray-400 font-mono">{formatDate(log.timestamp)}</div>
                  {#if log.data?.question_title}
                    <div class="text-sm text-gray-700 mt-0.5">Q: {log.data.question_title}</div>
                  {/if}
                  {#if log.data?.msg}
                    <div class="text-sm text-gray-600 mt-0.5">{log.data.msg}</div>
                  {/if}
                  {#if log.data?.answer}
                    <details class="mt-1">
                      <summary class="text-xs text-blue-500 cursor-pointer">View answer</summary>
                      <pre class="mt-1 bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto max-h-[150px] overflow-y-auto font-mono">{log.data.answer}</pre>
                    </details>
                  {/if}
                </div>
              </div>
            {/each}
            {#if sessionLogs.length === 0}
              <div class="text-center text-gray-400 py-4">No logs for this session</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
