<script lang="ts">
  type Props = {
    isOpen: boolean;
    title?: string;
    onClose: () => void;
    children: any;
    maxWidth?: string;
  }
  let { isOpen, title, onClose, children, maxWidth = 'max-w-lg' }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
    <!-- Backdrop button -->
    <button 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-default w-full h-full border-0 transition-opacity" 
      onclick={onClose}
      aria-label="Close modal backdrop"
      tabindex="-1"
    ></button>
    
    <div class="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
      <div 
        class="relative bg-white border border-gray-200 rounded-2xl w-full {maxWidth} shadow-2xl transform transition-all flex flex-col max-h-[calc(100vh-3.5rem)] my-auto text-left overflow-hidden z-10" 
        role="document"
      >
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
          <h3 class="text-xl font-bold text-gray-900 tracking-tight">{title || 'Modal'}</h3>
          <button 
            onclick={onClose} 
            class="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-xl transition-colors focus:outline-none" 
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Modal Body (scrollable) -->
        <div class="p-6 overflow-y-auto flex-1">
          {@render children()}
        </div>
      </div>
    </div>
  </div>
{/if}
