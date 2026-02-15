<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import Button from "$lib/components/admin/Button.svelte";

  let activeTab = $state<'typing' | 'debug'>('typing');
  
  // Data
  let typingResults = $state<any[]>([]);
  let debugResults = $state<any[]>([]);
  let loading = $state(false);
  
  // Filters
  let searchQuery = $state("");

  async function fetchTypingResults() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/typing/result", "GET", null, token);
          if (Array.isArray(res)) typingResults = res;
          else if (res.results) typingResults = res.results;
          else typingResults = [];
      } catch (e) {
          console.error("Failed to fetch typing results", e);
           if (typingResults.length === 0) {
              typingResults = [
                  { id: 1, user_name: "John Doe", level_name: "Home Row Basics", wpm: 45, accuracy: 98, duration: 58, created_at: "2023-10-27T10:00:00Z" },
                  { id: 2, user_name: "Jane Smith", level_name: "Common Words", wpm: 72, accuracy: 95, duration: 110, created_at: "2023-10-27T11:30:00Z" },
              ];
          }
      } finally {
          loading = false;
      }
  }

  async function fetchDebugResults() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/debug/result", "GET", null, token);
          if (Array.isArray(res)) debugResults = res;
          else if (res.results) debugResults = res.results;
          else debugResults = [];
      } catch (e) {
          console.error("Failed to fetch debug results", e);
          if (debugResults.length === 0) {
              debugResults = [
                  { id: 1, user_name: "John Doe", level_name: "Level 1: Basics", score: 5, total: 5, status: "pass", time_taken: "15m" },
                  { id: 2, user_name: "Jane Smith", level_name: "Level 1: Basics", score: 3, total: 5, status: "fail", time_taken: "20m" },
              ];
          }
      } finally {
          loading = false;
      }
  }

  function handleTabChange(tab: 'typing' | 'debug') {
      activeTab = tab;
      if (tab === 'typing') fetchTypingResults();
      else fetchDebugResults();
  }

  onMount(() => {
      fetchTypingResults();
  });
</script>

{#snippet statusCell(row: any)}
  {#if row.status === 'pass'}
      <span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold uppercase">Pass</span>
  {:else}
      <span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold uppercase">Fail</span>
  {/if}
{/snippet}

{#snippet accuracyCell(row: any)}
  <span class="{row.accuracy >= 90 ? 'text-green-600' : 'text-yellow-600'} font-medium">
      {row.accuracy}%
  </span>
{/snippet}

{#snippet dateCell(row: any)}
  <span class="text-gray-500 text-xs">
      {new Date(row.created_at || Date.now()).toLocaleDateString()}
  </span>
{/snippet}

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">Results Management</h1>
  </div>

  <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            onclick={() => handleTabChange('typing')}
            class="{activeTab === 'typing' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
            aria-current={activeTab === 'typing' ? 'page' : undefined}
          >
              Typing Results
          </button>
          
          <button 
            onclick={() => handleTabChange('debug')}
            class="{activeTab === 'debug' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
            aria-current={activeTab === 'debug' ? 'page' : undefined}
          >
              Debugging Results
          </button>
      </nav>
  </div>

  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-1">
      <Input placeholder="Search results by user..." bind:value={searchQuery} />
    </div>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">Loading results...</div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible max-w-full">
        {#if activeTab === 'typing'}
          <Table 
            data={typingResults.filter(r => r.user_name?.toLowerCase().includes(searchQuery.toLowerCase()))} 
            columns={[
              { key: 'user_name', label: 'User' },
              { key: 'level_name', label: 'Level' },
              { key: 'wpm', label: 'WPM' },
              { key: 'accuracy', label: 'Accuracy', render: accuracyCell },
              { key: 'duration', label: 'Duration (s)' },
              { key: 'created_at', label: 'Date', render: dateCell }
            ]} 
          />
        {:else}
            <Table 
            data={debugResults.filter(r => r.user_name?.toLowerCase().includes(searchQuery.toLowerCase()))} 
            columns={[
              { key: 'user_name', label: 'User' },
              { key: 'level_name', label: 'Level' },
              { key: 'score', label: 'Score' },
              { key: 'total', label: 'Total Questions' },
              { key: 'status', label: 'Status', render: statusCell },
              { key: 'time_taken', label: 'Time Taken' }
            ]} 
          />
        {/if}
    </div>
  {/if}
</div>
