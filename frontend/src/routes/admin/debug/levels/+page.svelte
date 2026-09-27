<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";

  let levels = $state<any[]>([]);
  let questions = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Form State
  let newLevel = $state({
      name: "",
      order: 1,
      duration: 900,
      question_ids: [] as number[]
  });

  let editingLevel = $state<any>(null);

  // Derived
  // Assume levels are sorted by order
  let sortedLevels = $derived([...levels].sort((a, b) => a.order - b.order));

  async function fetchLevels() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/debug/level", "GET", null, token);
          if (Array.isArray(res)) levels = res;
          else if (res.levels) levels = res.levels;
          else levels = [];
      } catch (e: any) {
          error = e.message;
          if (levels.length === 0) {
              levels = [
                  { id: 1, name: "Level 1: Basics", order: 1, question_count: 5 },
                  { id: 2, name: "Level 2: Intermediate", order: 2, question_count: 3 },
              ];
          }
      } finally {
          loading = false;
      }
  }

  async function fetchQuestions() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/debug/question", "GET", null, token);
          if (Array.isArray(res)) questions = res;
          else if (res.questions) questions = res.questions;
      } catch (e) {
          console.error("Failed to fetch questions", e);
          if (questions.length === 0) {
               questions = [
                  { id: 1, title: "Infinite Loop Fix", difficulty: "easy" },
                  { id: 2, title: "Null Pointer Exception", difficulty: "medium" },
                  { id: 3, title: "Race Condition", difficulty: "hard" },
              ];
          }
      }
  }

  async function handleAddLevel() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api("/debug/level", "POST", newLevel, token || "");
          isAddModalOpen = false;
          newLevel = { name: "", order: levels.length + 1, duration: 900, question_ids: [] };
          fetchLevels();
      } catch (e: any) {
          alert(`Error creating level: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  function openEditModal(level: any) {
      // Create a deep copy and ensure question_ids exists
      editingLevel = { ...level, question_ids: level.question_ids || [], duration: level.duration || 900 }; 
      isEditModalOpen = true;
  }

  async function handleUpdateLevel() {
      if (!editingLevel) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/debug/level?id=${editingLevel.id}`, "PUT", editingLevel, token || "");
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
          await api(`/debug/level?id=${id}`, "DELETE", null, token || "");
          fetchLevels();
      } catch (e: any) {
          alert(`Error deleting level: ${e.message}`);
      }
  }

  function toggleQuestionSelection(id: number, isEditing: boolean) {
      if (isEditing) {
          if (editingLevel.question_ids.includes(id)) {
              editingLevel.question_ids = editingLevel.question_ids.filter((qid: number) => qid !== id);
          } else {
              editingLevel.question_ids = [...editingLevel.question_ids, id];
          }
      } else {
           if (newLevel.question_ids.includes(id)) {
              newLevel.question_ids = newLevel.question_ids.filter((qid: number) => qid !== id);
          } else {
              newLevel.question_ids = [...newLevel.question_ids, id];
          }
      }
  }

  onMount(() => {
      fetchLevels();
      fetchQuestions();
  });
</script>

{#snippet durationCell(row: any)}
  <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold font-mono">
      {Math.floor((row.duration || 900) / 60)}:{((row.duration || 900) % 60).toString().padStart(2, '0')}
  </span>
{/snippet}

{#snippet questionCountCell(row: any)}
  <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-semibold">
      {row.question_count || (row.question_ids ? row.question_ids.length : 0)} Questions
  </span>
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
    <h1 class="text-3xl font-bold text-gray-900">Debug Levels</h1>
    <div class="flex gap-2">
        <a href="/admin/debug/questions" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            Manage Questions
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
        </a>
        <Button onclick={() => isAddModalOpen = true}>
        <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Add Level
        </span>
        </Button>
    </div>
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
          { key: 'duration', label: 'Duration', render: durationCell },
          { key: 'question_count', label: 'Questions', render: questionCountCell },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Add Level Modal -->
  <Modal isOpen={isAddModalOpen} onClose={() => isAddModalOpen = false} title="Add New Level">
    <form onsubmit={(e) => { e.preventDefault(); handleAddLevel(); }} class="space-y-4">
      <Input label="Level Name" bind:value={newLevel.name} placeholder="e.g. Level 1" required />
      <Input label="Order" type="number" bind:value={newLevel.order} required />
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Duration (seconds)
          <input type="number" bind:value={newLevel.duration} min="60" step="60" class="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <p class="text-xs text-gray-500 mt-1">{Math.floor(newLevel.duration / 60)} min {newLevel.duration % 60}s</p>
      </div>
      
      <div class="space-y-2">
          <div class="block text-sm font-medium text-gray-700">Assign Questions</div>
          <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-lg divide-y divide-gray-100">
              {#each questions as question}
                  <label class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newLevel.question_ids.includes(question.id)} 
                        onchange={() => toggleQuestionSelection(question.id, false)}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div class="flex-1">
                          <div class="font-medium text-gray-900">{question.title}</div>
                          <div class="text-xs text-gray-500 uppercase">{question.difficulty}</div>
                      </div>
                  </label>
              {/each}
              {#if questions.length === 0}
                 <div class="p-4 text-center text-sm text-gray-500">No questions available. Create questions first.</div>
              {/if}
          </div>
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
  <Modal isOpen={isEditModalOpen} onClose={() => isEditModalOpen = false} title="Edit Level">
      {#if editingLevel}
        <form onsubmit={(e) => { e.preventDefault(); handleUpdateLevel(); }} class="space-y-4">
        <Input label="Level Name" bind:value={editingLevel.name} required />
        <Input label="Order" type="number" bind:value={editingLevel.order} required />
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Duration (seconds)
            <input type="number" bind:value={editingLevel.duration} min="60" step="60" class="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <p class="text-xs text-gray-500 mt-1">{Math.floor((editingLevel.duration || 900) / 60)} min {(editingLevel.duration || 900) % 60}s</p>
        </div>
        
        <div class="space-y-2">
          <div class="block text-sm font-medium text-gray-700">Assign Questions</div>
          <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-lg divide-y divide-gray-100">
              {#each questions as question}
                  <label class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingLevel.question_ids.includes(question.id)} 
                        onchange={() => toggleQuestionSelection(question.id, true)}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div class="flex-1">
                          <div class="font-medium text-gray-900">{question.title}</div>
                          <div class="text-xs text-gray-500 uppercase">{question.difficulty}</div>
                      </div>
                  </label>
              {/each}
          </div>
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
