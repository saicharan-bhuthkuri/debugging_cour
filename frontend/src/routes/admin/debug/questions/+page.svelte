<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";

  let questions = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Filters
  let searchQuery = $state("");
  let difficultyFilter = $state("all");

  // Form State
  let newQuestion = $state({
      title: "",
      description: "",
      code_snippet: "",
      difficulty: "easy"
  });

  let editingQuestion = $state<any>(null);

  // Derived
  let filteredQuestions = $derived(questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === "all" || q.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  }));

  async function fetchQuestions() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/debug/question", "GET", null, token);
          if (Array.isArray(res)) questions = res;
          else if (res.questions) questions = res.questions;
          else questions = [];
      } catch (e: any) {
          error = e.message;
          // Mock data
          if (questions.length === 0) {
              questions = [
                  { id: 1, title: "Infinite Loop Fix", description: "Fix the loop condition", difficulty: "easy" },
                  { id: 2, title: "Null Pointer Exception", description: "Handle potential null value", difficulty: "medium" },
                  { id: 3, title: "Race Condition", description: "Add mutex locks", difficulty: "hard" },
              ];
          }
      } finally {
          loading = false;
      }
  }

  async function handleAddQuestion() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api("/debug/question", "POST", newQuestion, token || "");
          isAddModalOpen = false;
          newQuestion = { title: "", description: "", code_snippet: "", difficulty: "easy" };
          fetchQuestions();
      } catch (e: any) {
          alert(`Error creating question: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  function openEditModal(question: any) {
      editingQuestion = { ...question };
      isEditModalOpen = true;
  }

  async function handleUpdateQuestion() {
      if (!editingQuestion) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          // PUT body expects id too
          await api(`/debug/question?id=${editingQuestion.id}`, "PUT", editingQuestion, token || "");
          isEditModalOpen = false;
          fetchQuestions();
      } catch (e: any) {
          alert(`Error updating question: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleDelete(id: number) {
      if (!confirm("Are you sure you want to delete this question?")) return;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/debug/question?id=${id}`, "DELETE", null, token || "");
          fetchQuestions();
      } catch (e: any) {
          alert(`Error deleting question: ${e.message}`);
      }
  }

  onMount(() => {
      fetchQuestions();
  });
</script>

{#snippet difficultyCell(row: any)}
  {@const colors = {
      easy: "bg-green-100 text-green-700 border-green-200",
      medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
      hard: "bg-red-100 text-red-700 border-red-200"
  }}
  <span class="text-xs px-2 py-1 rounded-full border uppercase tracking-wider font-mono {colors[row.difficulty as keyof typeof colors] || 'bg-gray-100'}">
    {row.difficulty}
  </span>
{/snippet}

{#snippet actionCell(row: any)}
  <div class="flex items-center gap-2">
    <button onclick={() => openEditModal(row)} class="text-blue-600 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Edit">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    </button>
    <button onclick={() => handleDelete(row.id)} class="text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Delete">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
{/snippet}

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">Debug Questions</h1>
    <div class="flex gap-2">
        <!-- Optional: Link to Levels -->
        <a href="/admin/debug/levels" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            Switch to Levels
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
        </a>
        <Button onclick={() => isAddModalOpen = true}>
        <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Add Question
        </span>
        </Button>
    </div>
  </div>

  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-1">
      <Input placeholder="Search questions..." bind:value={searchQuery} />
    </div>
    <div class="w-full md:w-48">
       <select bind:value={difficultyFilter} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
       </select>
    </div>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">Loading questions...</div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible max-w-full">
      <Table 
        data={filteredQuestions} 
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'difficulty', label: 'Difficulty', render: difficultyCell },
          { key: 'description', label: 'Description' }, // Maybe truncate this
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Add Question Modal -->
  <Modal isOpen={isAddModalOpen} onClose={() => isAddModalOpen = false} title="Add New Question">
    <form onsubmit={(e) => { e.preventDefault(); handleAddQuestion(); }} class="space-y-4">
      <Input label="Title" bind:value={newQuestion.title} placeholder="e.g. Infinite Loop" required />
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Difficulty</span>
             <select bind:value={newQuestion.difficulty} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="easy">Easy</option>
                 <option value="medium">Medium</option>
                 <option value="hard">Hard</option>
             </select>
         </label>
      </div>
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Description</span>
             <textarea bind:value={newQuestion.description} rows="3" class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="Describe the problem..."></textarea>
         </label>
      </div>

       <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Code Snippet</span>
             <textarea bind:value={newQuestion.code_snippet} rows="6" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="// Code goes here..."></textarea>
         </label>
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Question'}
        </Button>
      </div>
    </form>
  </Modal>

  <!-- Edit Question Modal - Similar to Add -->
  <Modal isOpen={isEditModalOpen} onClose={() => isEditModalOpen = false} title="Edit Question">
      {#if editingQuestion}
        <form onsubmit={(e) => { e.preventDefault(); handleUpdateQuestion(); }} class="space-y-4">
        <Input label="Title" bind:value={editingQuestion.title} required />
        
        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Difficulty</span>
                <select bind:value={editingQuestion.difficulty} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </label>
        </div>
        
        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Description</span>
                <textarea bind:value={editingQuestion.description} rows="3" class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"></textarea>
            </label>
        </div>

        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Code Snippet</span>
                <textarea bind:value={editingQuestion.code_snippet} rows="6" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"></textarea>
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
