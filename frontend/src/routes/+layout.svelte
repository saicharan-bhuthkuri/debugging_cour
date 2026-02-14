<script>
    import { onMount } from "svelte";
    import "../app.css";
    import { initAuth } from "$lib/login/login_state.svelte";
    let { children } = $props();

    onMount(() => {
        initAuth();
    });
</script>

{@render children()}
