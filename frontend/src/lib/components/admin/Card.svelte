<script lang="ts">
    type Props = {
        children: any;
        title?: string;
    }
    let { children, title }: Props = $props();
</script>

<div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
    {#if title}
        <h3 class="text-xl font-bold mb-4 text-gray-900">{title}</h3>
    {/if}
    {@render children()}
</div>
