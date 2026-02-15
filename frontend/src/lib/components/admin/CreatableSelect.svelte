<script lang="ts">
  import { slide } from "svelte/transition";

  let { 
    options = [], 
    value = $bindable(), 
    label = "", 
    placeholder = "Select...", 
    required = false,
    error = "",
    creatable = true
  } = $props();

  let isOpen = $state(false);
  let inputValue = $state(value || "");
  let inputRef: HTMLInputElement;

  // Update inputValue when value changes externally (e.g. edit mode or clear)
  $effect(() => {
    if (value !== inputValue && !isOpen) {
        inputValue = value || "";
    }
  });

  let filteredOptions = $derived(
    options.filter((opt: string) => 
      opt.toLowerCase().includes(inputValue.toLowerCase())
    )
  );

  function handleSelect(opt: string) {
    value = opt;
    inputValue = opt;
    isOpen = false;
    error = "";
  }

  function handleAdd() {
    if (!creatable || !inputValue.trim()) return;
    value = inputValue.trim();
    isOpen = false;
    error = "";
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    inputValue = target.value;
    isOpen = true;
    // Reset value if user changes input, forcing them to re-select or click add
    if (value && value !== inputValue) {
        value = ""; 
    }
  }

  function handleBlur(e: FocusEvent) {
      // Small delay to allow click event on dropdown items to process
      setTimeout(() => {
          isOpen = false;
          // If value was cleared (because of typing) and no new selection made,
          // check if we should revert or leave empty.
          // Requirement: "throw error if not clicked on add new"
          // We'll leave value as empty string if they typed but didn't select/add.
          // The parent form validation will handle the "required" error or we can show local error
          if (inputValue && !value) {
             // If they typed something but didn't select
             if (!creatable) {
                // If strictly selecting, check if input matches an option exactly
                const exactMatch = options.find((opt: string) => opt.toLowerCase() === inputValue.toLowerCase());
                if (exactMatch) {
                    value = exactMatch;
                    inputValue = exactMatch;
                } else {
                    inputValue = ""; // Clear invalid input
                }
             }
          } else if (!inputValue) {
             value = "";
          }
      }, 200);
  }

  function handleFocus() {
      isOpen = true;
  }
</script>

<div class="w-full relative">
  {#if label}
    <label class="block text-sm font-medium text-gray-700 mb-1">
      {label} {#if required}<span class="text-red-500">*</span>{/if}
    </label>
  {/if}
  
  <div class="relative">
    <input 
      bind:this={inputRef}
      type="text" 
      bind:value={inputValue}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      {placeholder}
      class="w-full px-4 py-2 bg-white border rounded-lg text-gray-900 focus:outline-none focus:ring-1 transition-colors cursor-pointer
      {error || (inputValue && !value && !isOpen) ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}"
    />
    
    <div class="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
       <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
         <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
       </svg>
    </div>

    <!-- Dropdown -->
    {#if isOpen}
      <div 
        transition:slide={{ duration: 150 }}
        class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      >
        {#if filteredOptions.length > 0}
          {#each filteredOptions as msg}
            <button 
              type="button"
              onclick={() => handleSelect(msg)}
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              {msg}
            </button>
          {/each}
          {#if creatable}
            <div class="border-t border-gray-100 my-1"></div>
          {/if}
        {/if}
        
        {#if creatable && inputValue}
            <button 
                type="button"
                onclick={handleAdd}
                class="w-full text-left px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                Add "{inputValue}"
            </button>
        {:else if filteredOptions.length === 0 && !inputValue}
            <div class="px-4 py-2 text-sm text-gray-400 italic">Start typing to search...</div>
        {:else if filteredOptions.length === 0 && !creatable}
            <div class="px-4 py-2 text-sm text-gray-400 italic">No matches found.</div>
        {:else if filteredOptions.length === 0 && creatable}
             <div class="px-4 py-2 text-sm text-gray-400 italic">Start typing to add new...</div>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
      <p class="mt-1 text-sm text-red-600">{error}</p>
  {:else if inputValue && !value && !isOpen}
      <p class="mt-1 text-sm text-red-500">Please select an option{creatable ? ' or click to add' : ''}.</p>
  {/if}
</div>
