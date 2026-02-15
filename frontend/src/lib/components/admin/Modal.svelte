<script lang="ts">
  type Props = {
    isOpen: boolean;
    title?: string;
    onClose: () => void;
    children: any;
  }
  let { isOpen, title, onClose, children } = $props<Props>();
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <button 
      class="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default w-full h-full border-0" 
      onclick={onClose}
      onkeydown={(e) => e.key === 'Escape' && onClose()}
      aria-label="Close modal"
      tabindex="-1"
    ></button>
    
    <div class="relative bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl p-6 transform transition-all" role="document">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-gray-900">{title || 'Modal'}</h3>
        <button onclick={onClose} class="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div>
        {@render children()}
      </div>
    </div>
  </div>
{/if}
