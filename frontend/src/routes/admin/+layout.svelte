<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import "../../app.css";

  let { children } = $props();

  let isAdmin = $state(false); // To prevent flash of content
  let showSidebar = $state(true);

  onMount(() => {
    const token = localStorage.getItem("login_token");
    const isLoginRoute = page.url.pathname.includes("/admin/login");

    if (!token && !isLoginRoute) {
      goto("/admin/login");
    } else {
        isAdmin = true;
    }
  });

  const logout = () => {
    localStorage.removeItem("login_token");
    localStorage.removeItem("isLoggedin");
    goto("/admin/login");
  }
</script>

<div class="min-h-screen bg-gray-50 text-gray-900 font-[var(--font-main)] flex">
  {#if !page.url.pathname.includes("/admin/login")}
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto shadow-sm z-30">
      <div class="p-6 border-b border-gray-200">
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <span class="bg-gray-100 p-1.5 rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg> 
          </span>
          ADMIN
        </h1>
      </div>
      
      <nav class="p-4 space-y-1">
        <a href="/admin/users" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/users') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
           </svg>
           User Management
        </a>
        
        <!-- Add more links here -->
      </nav>

      <div class="absolute bottom-0 w-full p-4 border-t border-gray-200 bg-gray-50/50">
         <div class="px-4 py-3 mb-2">
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Logged in as</p>
            <p class="text-sm font-semibold text-gray-900 truncate">Administrator</p>
         </div>
         <button onclick={logout} class="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black rounded-lg transition-colors border border-transparent hover:border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
            </svg>
            Sign Out
         </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 ml-64 p-8">
      {@render children()}
    </main>
  {:else}
    <!-- Login Layout (Full Screen) -->
    <main class="w-full h-full flex items-center justify-center p-4">
        {@render children()}
    </main>
  {/if}
</div>
