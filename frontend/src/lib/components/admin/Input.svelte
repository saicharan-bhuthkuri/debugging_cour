<script lang="ts">
  type Props = {
    value: string | number;
    label?: string;
    type?: 'text' | 'password' | 'email' | 'number';
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
  };

  let { 
    value = $bindable(), 
    label, 
    type = 'text', 
    placeholder = '', 
    required = false, 
    disabled = false 
  }: Props = $props();
</script>

<div class="w-full">
  {#if label}
    <label class="flex flex-col gap-1.5 w-full">
      <span class="text-sm font-medium text-gray-700">
        {label}
        {#if required}<span class="text-red-500">*</span>{/if}
      </span>
      <input 
          {type}
          bind:value
          {placeholder}
          {required}
          {disabled}
          class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200 disabled:opacity-50 disabled:bg-gray-100"
      />
    </label>
  {:else}
    <input 
        {type}
        bind:value
        {placeholder}
        {required}
        {disabled}
        class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200 disabled:opacity-50 disabled:bg-gray-100"
    />
  {/if}
</div>
