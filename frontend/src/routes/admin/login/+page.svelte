<script lang="ts">
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  
  import Button from "$lib/components/admin/Button.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import Card from "$lib/components/admin/Card.svelte";
  import { setToken } from "$lib/login/login_state.svelte";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  const handleLogin = async () => {
    loading = true;
    error = "";
    try {
      const token = await api("/login", "POST", { name: username, pass: password });
      
      if (token) {
        const split = token.split(".");
        const payload = atob(split[1]);
        const user = JSON.parse(payload);
        
        if (user.role == "admin"){
          setToken(token);
          goto("/admin/users");
        } else {
          error = "The user is not an admin"
        }
      } else {
        error = "Empty token received";
      }

    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  };
</script>

<div class="flex flex-col items-center justify-center min-h-[50vh] w-full max-w-md mx-auto space-y-8">
  <div class="text-center space-y-2">
    <h1 class="text-4xl font-bold text-gray-900 tracking-tight">Admin Portal</h1>
    <p class="text-gray-500">Sign in to manage users and system settings</p>
  </div>

  <Card>
    <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="p-[10px] space-y-6">
      <div class="space-y-4">
        <Input 
          bind:value={username} 
          label="Username" 
          placeholder="admin" 
          required 
        />
        
        <Input 
          bind:value={password} 
          label="Password" 
          type="password" 
          placeholder="••••••••" 
          required 
        />
      </div>

      {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      {/if}

      <Button 
        type="submit" 
        fullWidth 
        disabled={loading}
      >
        {#if loading}
          <div class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
          </div>
        {:else}
          Sign In
        {/if}
      </Button>
    </form>
  </Card>
</div>
