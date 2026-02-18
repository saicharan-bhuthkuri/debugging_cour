<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";

  let levels = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Form State
  let newLevel = $state({
      name: "",
      content: "", // The text to type
      time_limit: 60, // seconds
      passing_accuracy: 90,
      attempts_allowed: 2,
      order: 1
  });

  let editingLevel = $state<any>(null);

  // Derived
  let sortedLevels = $derived([...levels].sort((a, b) => a.order - b.order));

  async function fetchLevels() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/typing/level", "GET", null, token);
          if (Array.isArray(res)) levels = res;
          else if (res.levels) levels = res.levels;
          else levels = [];
      } catch (e: any) {
          error = e.message;
          if (levels.length === 0) {
              levels = [
                  { id: 1, name: "Home Row Basics", content: "asdf jkl;", time_limit: 60, passing_accuracy: 95, attempts_allowed: 2, order: 1 },
                  { id: 2, name: "Common Words", content: "the be to of and a in that have I", time_limit: 120, passing_accuracy: 90, attempts_allowed: 2, order: 2 },
              ];
          }
      } finally {
          loading = false;
      }
  }

  async function handleAddLevel() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api("/typing/level", "POST", newLevel, token || "");
          isAddModalOpen = false;
          // Reset form
          newLevel = { name: "", content: "", time_limit: 60, passing_accuracy: 90, attempts_allowed: 2, order: levels.length + 1 };
          fetchLevels();
      } catch (e: any) {
          alert(`Error creating level: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  function openEditModal(level: any) {
      editingLevel = { ...level };
      isEditModalOpen = true;
  }

  async function handleUpdateLevel() {
      if (!editingLevel) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/typing/level?id=${editingLevel.id}`, "PUT", editingLevel, token || "");
          isEditModalOpen = false;
          fetchLevels();
      } catch (e: any) {
          alert(`Error updating level: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleDelete(id: number) {
      if (!confirm("Are you sure you want to delete this level?")) return;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/typing/level?id=${id}`, "DELETE", null, token || "");
          fetchLevels();
      } catch (e: any) {
          alert(`Error deleting level: ${e.message}`);
      }
  }

  onMount(() => {
      fetchLevels();
  });
</script>

{#snippet configCell(row: any)}
  <div class="text-xs text-gray-600 space-y-1">
      <div>Time: <span class="font-medium text-gray-900">{row.time_limit}s</span></div>
      <div>Acc: <span class="font-medium text-gray-900">{row.passing_accuracy}%</span></div>
      <div>Attempts: <span class="font-medium text-gray-900">{row.attempts_allowed}</span></div>
  </div>
{/snippet}

{#snippet contentCell(row: any)}
  <div class="max-w-md truncate text-sm text-gray-500 font-mono bg-gray-50 p-1 rounded border border-gray-100">
      {row.content}
  </div>
{/snippet}

{#snippet actionCell(row: any)}
  <div class="flex items-center gap-2">
    <button onclick={() => openEditModal(row)} class="text-blue-600 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Edit Level">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    </button>
    <button onclick={() => handleDelete(row.id)} class="text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Delete Level">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
{/snippet}

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <h1 class="text-3xl font-bold text-gray-900">Typing Levels</h1>
      <a href="/admin/typing/results" class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-600 flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
        </svg>
        View Results
      </a>
    </div>
    <Button onclick={() => isAddModalOpen = true}>
      <span class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Add Typing Level
      </span>
    </Button>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">Loading levels...</div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible max-w-full">
      <Table 
        data={sortedLevels} 
        columns={[
          { key: 'order', label: 'Order' },
          { key: 'name', label: 'Level Name' },
          { key: 'content', label: 'Content', render: contentCell },
          { key: 'config', label: 'Configuration', render: configCell },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Add Level Modal -->
  <Modal isOpen={isAddModalOpen} onClose={() => isAddModalOpen = false} title="Add Typing Level">
    <form onsubmit={(e) => { e.preventDefault(); handleAddLevel(); }} class="space-y-4">
      <Input label="Level Name" bind:value={newLevel.name} placeholder="e.g. Paragraph Text" required />
      <Input label="Order" type="number" bind:value={newLevel.order} required />
      
      <div class="grid grid-cols-3 gap-4">
          <Input label="Time Limit (s)" type="number" bind:value={newLevel.time_limit} required />
          <Input label="Min Acc (%)" type="number" bind:value={newLevel.passing_accuracy} required />
          <Input label="Attempts" type="number" bind:value={newLevel.attempts_allowed} required />
      </div>

       <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Content to Type</span>
             <textarea bind:value={newLevel.content} rows="6" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="The quick brown fox..." required></textarea>
         </label>
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Level'}
        </Button>
      </div>
    </form>
  </Modal>

  <!-- Edit Level Modal -->
  <Modal isOpen={isEditModalOpen} onClose={() => isEditModalOpen = false} title="Edit Typing Level">
      {#if editingLevel}
        <form onsubmit={(e) => { e.preventDefault(); handleUpdateLevel(); }} class="space-y-4">
        <Input label="Level Name" bind:value={editingLevel.name} required />
        <Input label="Order" type="number" bind:value={editingLevel.order} required />
        
        <div class="grid grid-cols-3 gap-4">
            <Input label="Time Limit (s)" type="number" bind:value={editingLevel.time_limit} required />
            <Input label="Min Acc (%)" type="number" bind:value={editingLevel.passing_accuracy} required />
            <Input label="Attempts" type="number" bind:value={editingLevel.attempts_allowed} required />
        </div>

        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Content to Type</span>
                <textarea bind:value={editingLevel.content} rows="6" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" required></textarea>
            </label>
        </div>

        <div class="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onclick={() => isEditModalOpen = false}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
        </form>
      {/if}
  </Modal>
</div>
