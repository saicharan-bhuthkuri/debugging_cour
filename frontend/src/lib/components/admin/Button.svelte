<script lang="ts">
  type Props = {
    children: any;
    variant?: 'primary' | 'secondary' | 'danger';
    onclick?: () => void;
    type?: 'button' | 'submit';
    fullWidth?: boolean;
    disabled?: boolean;
    class?: string;
  };

  let { 
    children, 
    variant = 'primary', 
    onclick, 
    type = 'button', 
    fullWidth = false,
    disabled = false,
    class: customClass = '' 
  } : Props = $props();

  const baseStyles = "cursor-pointer px-4 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gray-900 text-white hover:bg-black hover:scale-[1.02] shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm"
  };
</script>

<button 
  {type} 
  class="{baseStyles} {variants[variant]} {fullWidth ? 'w-full' : ''} {customClass}" 
  {disabled}
  {onclick}
>
  {@render children()}
</button>
