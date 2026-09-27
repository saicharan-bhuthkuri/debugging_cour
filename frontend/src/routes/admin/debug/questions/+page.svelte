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
  let isPreviewOpen = $state(false);
  let previewQuestion = $state<any>(null);

  // Filters
  let searchQuery = $state("");
  let difficultyFilter = $state("all");
  let typeFilter = $state("all");

  const QUESTION_TYPES = [
    { value: "full_edit", label: "Full Edit", desc: "User can edit the entire code", color: "cyan" },
    { value: "find_buggy_line", label: "Find Buggy Line", desc: "User marks lines as buggy", color: "red" },
    { value: "add_lines", label: "Add Lines", desc: "User adds new lines via context menu", color: "green" },
    { value: "missing_lines", label: "Missing Lines", desc: "Only blank lines are editable", color: "yellow" },
  ];

  // Form State
  let newQuestion = $state({
      title: "",
      description: "",
      code_snippet: "",
      difficulty: "easy",
      question_type: "full_edit",
      language: "c",
      answer_meta: null as any,
      test_cases: [] as { input: string, output: string }[]
  });

  let editingQuestion = $state<any>(null);

  // For buggy line configuration
  let buggyLinesInput = $state("");
  let editBuggyLinesInput = $state("");
  
  // For missing lines configuration
  let missingLinesInput = $state("");
  let editMissingLinesInput = $state("");

  let languageFilter = $state("all");

  // Derived
  let filteredQuestions = $derived(questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === "all" || q.difficulty === difficultyFilter;
    const matchesType = typeFilter === "all" || q.question_type === typeFilter;
    const matchesLanguage = languageFilter === "all" || (q.language || "c") === languageFilter;
    return matchesSearch && matchesDifficulty && matchesType && matchesLanguage;
  }));

  function getCodeLines(code: string) {
    return code ? code.split('\n') : [];
  }

  function parseLineNumbers(input: string): number[] {
    return input.split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0);
  }

  function buildAnswerMeta(type: string, linesInput: string): any {
    if (type === 'find_buggy_line') {
      return { buggy_lines: parseLineNumbers(linesInput) };
    }
    if (type === 'missing_lines') {
      return { editable_lines: parseLineNumbers(linesInput) };
    }
    return null;
  }

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
          if (questions.length === 0) {
              questions = [];
          }
      } finally {
          loading = false;
      }
  }

  async function handleAddQuestion() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          const payload = {
              ...newQuestion,
              answer_meta: buildAnswerMeta(newQuestion.question_type, 
                newQuestion.question_type === 'find_buggy_line' ? buggyLinesInput : missingLinesInput)
          };
          await api("/debug/question", "POST", payload, token || "");
          isAddModalOpen = false;
          newQuestion = { title: "", description: "", code_snippet: "", difficulty: "easy", question_type: "full_edit", language: "c", answer_meta: null, test_cases: [] };
          buggyLinesInput = "";
          missingLinesInput = "";
          fetchQuestions();
      } catch (e: any) {
          alert(`Error creating question: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  function openEditModal(question: any) {
      editingQuestion = { ...question, language: question.language || 'c' };
      // Populate line inputs from answer_meta
      if (question.answer_meta?.buggy_lines) {
          editBuggyLinesInput = question.answer_meta.buggy_lines.join(', ');
      } else {
          editBuggyLinesInput = "";
      }
      if (question.answer_meta?.editable_lines) {
          editMissingLinesInput = question.answer_meta.editable_lines.join(', ');
      } else {
          editMissingLinesInput = "";
      }
      if (!editingQuestion.test_cases) editingQuestion.test_cases = [];
      isEditModalOpen = true;
  }

  async function handleUpdateQuestion() {
      if (!editingQuestion) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          const payload = {
              ...editingQuestion,
              answer_meta: buildAnswerMeta(editingQuestion.question_type,
                editingQuestion.question_type === 'find_buggy_line' ? editBuggyLinesInput : editMissingLinesInput)
          };
          await api(`/debug/question?id=${editingQuestion.id}`, "PUT", payload, token || "");
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

  function openPreview(question: any) {
      previewQuestion = question;
      isPreviewOpen = true;
  }

  function getTypeInfo(type: string) {
      return QUESTION_TYPES.find(t => t.value === type) || QUESTION_TYPES[0];
  }

  onMount(() => {
      fetchQuestions();
  });
</script>

{#snippet typeCell(row: any)}
  {@const info = getTypeInfo(row.question_type || 'full_edit')}
  {@const colorMap = { cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200', red: 'bg-red-50 text-red-700 border-red-200', green: 'bg-green-50 text-green-700 border-green-200', yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200' }}
  <span class="text-xs px-2 py-1 rounded-full border font-mono font-semibold tracking-wider {colorMap[info.color as keyof typeof colorMap] || 'bg-gray-100'}">
    {info.label}
  </span>
{/snippet}

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

{#snippet languageCell(row: any)}
  {#if row.language === 'python'}
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
      Python 3
    </span>
  {:else}
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
      C99
    </span>
  {/if}
{/snippet}

{#snippet metaCell(row: any)}
  <div class="text-xs text-gray-500 font-mono">
    {#if row.question_type === 'find_buggy_line' && row.answer_meta?.buggy_lines}
      <span class="text-red-500">Lines: {row.answer_meta.buggy_lines.join(', ')}</span>
    {:else if row.question_type === 'missing_lines' && row.answer_meta?.editable_lines}
      <span class="text-yellow-600">Editable: {row.answer_meta.editable_lines.join(', ')}</span>
    {:else if row.question_type === 'full_edit'}
      <span class="text-gray-400">—</span>
    {:else if row.question_type === 'add_lines'}
      <span class="text-green-500">Context menu</span>
    {:else}
      <span class="text-gray-400">—</span>
    {/if}
  </div>
{/snippet}

{#snippet actionCell(row: any)}
  <div class="flex items-center gap-2">
    <button onclick={() => openPreview(row)} class="text-purple-600 hover:bg-purple-50 p-1.5 rounded-full transition-colors" title="Preview">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
      </svg>
    </button>
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

{#snippet questionTypeSelector(value: string, onchange: (v: string) => void)}
  <div class="w-full">
    <label class="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
    <div class="grid grid-cols-2 gap-2">
      {#each QUESTION_TYPES as type}
        {@const isSelected = value === type.value}
        {@const borderColors = { cyan: 'border-cyan-400 bg-cyan-50', red: 'border-red-400 bg-red-50', green: 'border-green-400 bg-green-50', yellow: 'border-yellow-400 bg-yellow-50' }}
        <button
          type="button"
          class="p-3 rounded-lg border-2 text-left transition-all {isSelected ? (borderColors[type.color as keyof typeof borderColors] || 'border-gray-400') : 'border-gray-200 hover:border-gray-300'}"
          onclick={() => onchange(type.value)}
        >
          <div class="font-semibold text-sm text-gray-900">{type.label}</div>
          <div class="text-xs text-gray-500 mt-0.5">{type.desc}</div>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet testCasesEditor(testCases: any[], onUpdate: (tc: any[]) => void)}
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700">Test Cases (for execution)</label>
      <button 
        type="button" 
        onclick={() => onUpdate([...testCases, { input: "", output: "" }])}
        class="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
        Add Test Case
      </button>
    </div>
    
    {#if testCases.length === 0}
      <div class="text-xs text-gray-400 italic py-2">No test cases added yet. These are required for the "Run" feature.</div>
    {/if}

    <div class="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
      {#each testCases as tc, i}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 relative group">
          <div>
            <label class="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Input</label>
            <textarea 
              bind:value={tc.input} 
              rows="1" 
              class="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded font-mono focus:outline-none focus:border-gray-900"
              placeholder="No input"
            ></textarea>
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Expected Output</label>
            <textarea 
              bind:value={tc.output} 
              rows="1" 
              class="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded font-mono focus:outline-none focus:border-gray-900"
              placeholder="Expected output"
            ></textarea>
          </div>
          <button 
            type="button"
            onclick={() => onUpdate(testCases.filter((_, idx) => idx !== i))}
            class="absolute -top-2 -right-2 bg-white border border-gray-200 text-red-500 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">Debug Questions</h1>
    <div class="flex gap-2">
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
    <div class="w-full md:w-48">
       <select bind:value={typeFilter} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Types</option>
          {#each QUESTION_TYPES as type}
            <option value={type.value}>{type.label}</option>
          {/each}
       </select>
    </div>
    <div class="w-full md:w-48">
       <select bind:value={languageFilter} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Languages</option>
          <option value="c">C (C99)</option>
          <option value="python">Python 3</option>
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
          { key: 'language', label: 'Language', render: languageCell },
          { key: 'question_type', label: 'Type', render: typeCell },
          { key: 'difficulty', label: 'Difficulty', render: difficultyCell },
          { key: 'answer_meta', label: 'Config', render: metaCell },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Add Question Modal -->
  <Modal isOpen={isAddModalOpen} onClose={() => isAddModalOpen = false} title="Add New Question">
    <form onsubmit={(e) => { e.preventDefault(); handleAddQuestion(); }} class="space-y-4">
      <Input label="Title" bind:value={newQuestion.title} placeholder="e.g. Infinite Loop" required />
      
      <div class="flex gap-4">
        <div class="w-1/2">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Difficulty</span>
                <select bind:value={newQuestion.difficulty} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </label>
        </div>
        <div class="w-1/2">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Language</span>
                <select bind:value={newQuestion.language} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                    <option value="c">C (C99)</option>
                    <option value="python">Python 3</option>
                </select>
            </label>
        </div>
      </div>

      <!-- Question Type Selector -->
      {@render questionTypeSelector(newQuestion.question_type, (v) => newQuestion.question_type = v)}
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Description</span>
             <textarea bind:value={newQuestion.description} rows="3" class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="Describe the problem..."></textarea>
         </label>
      </div>

       <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Code Snippet</span>
             <textarea bind:value={newQuestion.code_snippet} rows="8" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" placeholder="// Code goes here..."></textarea>
         </label>
         {#if newQuestion.code_snippet}
           <div class="text-xs text-gray-400 mt-1 font-mono">
             {getCodeLines(newQuestion.code_snippet).length} lines
           </div>
         {/if}
      </div>

      <!-- Type-specific configuration -->
      {#if newQuestion.question_type === 'find_buggy_line'}
        <div class="w-full p-4 bg-red-50 rounded-lg border border-red-200">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-red-700">🐛 Correct Buggy Lines (Answer Key)</span>
            <span class="text-xs text-red-500">Enter the line numbers that contain bugs (comma-separated). These are the correct answers.</span>
            <input bind:value={buggyLinesInput} class="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="e.g. 3, 7, 12" />
          </label>
        </div>
      {/if}

      {#if newQuestion.question_type === 'missing_lines'}
        <div class="w-full p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-yellow-700">📝 Editable Line Numbers</span>
            <span class="text-xs text-yellow-600">Enter the line numbers that should be editable (the "missing" lines, comma-separated). Other lines will be read-only.</span>
            <input bind:value={missingLinesInput} class="w-full px-3 py-2 bg-white border border-yellow-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="e.g. 4, 8, 15" />
          </label>
        </div>
      {/if}

      {#if newQuestion.question_type === 'add_lines'}
        <div class="w-full p-4 bg-green-50 rounded-lg border border-green-200">
          <div class="text-sm font-medium text-green-700 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Lines Mode
          </div>
          <p class="text-xs text-green-600 mt-1">Students will see the code as read-only and can right-click to insert new editable lines. No additional configuration needed.</p>
        </div>
      {/if}

      <div class="w-full border-t border-gray-100 pt-4">
        {@render testCasesEditor(newQuestion.test_cases, (tc) => newQuestion.test_cases = tc)}
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Question'}
        </Button>
      </div>
    </form>
  </Modal>

  <!-- Edit Question Modal -->
  <Modal isOpen={isEditModalOpen} onClose={() => isEditModalOpen = false} title="Edit Question">
      {#if editingQuestion}
        <form onsubmit={(e) => { e.preventDefault(); handleUpdateQuestion(); }} class="space-y-4">
        <Input label="Title" bind:value={editingQuestion.title} required />
        
        <div class="flex gap-4">
          <div class="w-1/2">
              <label class="flex flex-col gap-1.5 w-full">
                  <span class="text-sm font-medium text-gray-700">Difficulty</span>
                  <select bind:value={editingQuestion.difficulty} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                  </select>
              </label>
          </div>
          <div class="w-1/2">
              <label class="flex flex-col gap-1.5 w-full">
                  <span class="text-sm font-medium text-gray-700">Language</span>
                  <select bind:value={editingQuestion.language} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                      <option value="c">C (C99)</option>
                      <option value="python">Python 3</option>
                  </select>
              </label>
          </div>
        </div>

        <!-- Question Type Selector -->
        {@render questionTypeSelector(editingQuestion.question_type || 'full_edit', (v) => editingQuestion.question_type = v)}
        
        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Description</span>
                <textarea bind:value={editingQuestion.description} rows="3" class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"></textarea>
            </label>
        </div>

        <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Code Snippet</span>
                <textarea bind:value={editingQuestion.code_snippet} rows="8" class="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"></textarea>
            </label>
            {#if editingQuestion.code_snippet}
              <div class="text-xs text-gray-400 mt-1 font-mono">
                {getCodeLines(editingQuestion.code_snippet).length} lines
              </div>
            {/if}
        </div>

        <!-- Type-specific configuration -->
        {#if editingQuestion.question_type === 'find_buggy_line'}
          <div class="w-full p-4 bg-red-50 rounded-lg border border-red-200">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium text-red-700">🐛 Correct Buggy Lines (Answer Key)</span>
              <span class="text-xs text-red-500">Enter the line numbers that contain bugs (comma-separated)</span>
              <input bind:value={editBuggyLinesInput} class="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="e.g. 3, 7, 12" />
            </label>
          </div>
        {/if}

        {#if editingQuestion.question_type === 'missing_lines'}
          <div class="w-full p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium text-yellow-700">📝 Editable Line Numbers</span>
              <span class="text-xs text-yellow-600">Enter the line numbers that should be editable (comma-separated)</span>
              <input bind:value={editMissingLinesInput} class="w-full px-3 py-2 bg-white border border-yellow-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="e.g. 4, 8, 15" />
            </label>
          </div>
        {/if}

        {#if editingQuestion.question_type === 'add_lines'}
          <div class="w-full p-4 bg-green-50 rounded-lg border border-green-200">
            <div class="text-sm font-medium text-green-700 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Lines Mode
            </div>
            <p class="text-xs text-green-600 mt-1">Students will right-click to insert new editable lines.</p>
          </div>
        {/if}

        <div class="w-full border-t border-gray-100 pt-4">
          {@render testCasesEditor(editingQuestion.test_cases || [], (tc) => editingQuestion.test_cases = tc)}
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

  <!-- Preview Modal -->
  <Modal isOpen={isPreviewOpen} onClose={() => isPreviewOpen = false} title="Question Preview">
    {#if previewQuestion}
      {@const info = getTypeInfo(previewQuestion.question_type || 'full_edit')}
      {@const colorMap = { cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200', red: 'bg-red-50 text-red-700 border-red-200', green: 'bg-green-50 text-green-700 border-green-200', yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200' }}
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-bold text-gray-900">{previewQuestion.title}</h3>
          <span class="text-xs px-2 py-1 rounded-full border font-mono font-semibold {colorMap[info.color as keyof typeof colorMap]}">{info.label}</span>
        </div>
        <p class="text-sm text-gray-600">{previewQuestion.description}</p>
        
        <div class="relative">
          <div class="text-xs font-mono text-gray-500 mb-2">Code Preview:</div>
          <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre class="text-sm font-mono text-gray-300 leading-relaxed">{#each getCodeLines(previewQuestion.code_snippet || '') as line, i}<div class="flex gap-3 hover:bg-white/5 px-2 py-0.5 rounded {previewQuestion.answer_meta?.buggy_lines?.includes(i+1) ? 'bg-red-500/10 border-l-2 border-red-500' : ''} {previewQuestion.answer_meta?.editable_lines?.includes(i+1) ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''}"><span class="text-gray-600 select-none w-6 text-right">{i+1}</span><span>{line || ' '}</span></div>{/each}</pre>
          </div>
        </div>

        {#if previewQuestion.test_cases && previewQuestion.test_cases.length > 0}
          <div class="space-y-2">
            <div class="text-xs font-mono text-gray-500">Test Cases ({previewQuestion.test_cases.length}):</div>
            <div class="grid grid-cols-1 gap-2">
              {#each previewQuestion.test_cases as tc}
                <div class="text-[10px] font-mono bg-gray-50 p-2 rounded border flex flex-col gap-1">
                  <div class="flex gap-2">
                    <span class="text-blue-500 font-bold w-12">IN:</span>
                    <span class="text-gray-700 whitespace-pre-wrap">{tc.input || '(none)'}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="text-green-500 font-bold w-12">OUT:</span>
                    <span class="text-gray-700 whitespace-pre-wrap">{tc.output || '(none)'}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if previewQuestion.answer_meta}
          <div class="text-xs font-mono text-gray-500 p-3 bg-gray-50 rounded-lg border">
            <strong>Answer Meta:</strong> {JSON.stringify(previewQuestion.answer_meta)}
          </div>
        {/if}
      </div>
    {/if}
  </Modal>
</div>
