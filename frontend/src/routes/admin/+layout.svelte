<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { fade, fly } from "svelte/transition";
  import "../../app.css";

  import * as ws from "$lib/ws.svelte";
  import * as adminState from "$lib/admin_state.svelte";
  import { api } from "$lib/api";

  let { children } = $props();

  let isAdmin = $state(false);
  let isSidebarCollapsed = $state(false);
  let isMobileMenuOpen = $state(false);
  let userRole = $state("admin");

  function checkAdminAuth() {
    if (typeof localStorage === 'undefined') return;
    const isLoginRoute = page.url.pathname.includes("/admin/login");
    const token = localStorage.getItem("admin_token") || localStorage.getItem("login_token");

    if (!token) {
      if (!isLoginRoute) goto("/admin/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'admin' && payload.role !== 'superadmin') {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("login_token");
        if (!isLoginRoute) goto("/admin/login");
        return;
      }
      userRole = payload.role;
      isAdmin = true;
      ws.connect(token);
    } catch {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("login_token");
      if (!isLoginRoute) goto("/admin/login");
    }
  }

  onMount(() => {
    // Restore sidebar state
    const savedSidebarState = localStorage.getItem("admin_sidebar_collapsed");
    if (savedSidebarState) {
        isSidebarCollapsed = savedSidebarState === "true";
    }
    checkAdminAuth();
  });

  // Re-check whenever route changes
  $effect(() => {
    const currentPath = page.url.pathname;
    if (typeof localStorage !== 'undefined' && !currentPath.includes("/admin/login")) {
      checkAdminAuth();
    }
  });

  // Persist sidebar state
  $effect(() => {
     if (typeof localStorage !== 'undefined') {
         localStorage.setItem("admin_sidebar_collapsed", String(isSidebarCollapsed));
     }
  });
  
  // function to refresh state
  async function refreshSystems() {
      try {
        const token = localStorage.getItem("login_token");
        if (!token) return;
        const res = await api("/system", "GET", null, token);
        if (Array.isArray(res)) adminState.setSystems(res);
        else if (res.systems) adminState.setSystems(res.systems);
      } catch (e) { console.error("Sync failed", e); }
  }

  // Listen for WS updates globally for Admin
  $effect(() => {
      // Subscribe if connected
      if (ws.state.connected && isAdmin) {
          // Re-fetch to ensure sync on connect/reconnect
          // We don't have direct access to "fetchSystems" from here easily without duplicating logic or using a store action that fetches.
          // Ideally admin_state should handle fetching or expose it.
          // For now let's rely on events, but if an event was missed during disconnect...
          // We could reload window or triggering a refetch if we moved fetch logic to the store.
          

          refreshSystems(); // Sync on connect
          
          const unsubscribe = ws.subscribe((msg: any) => {
             // Handle Admin-relevant messages
             if (msg.type === "admin_count") {
                 adminState.setAdminCount(msg.count);
             } else if (msg.type === "system_online") {
                 // System came online — upsert to handle both new and existing
                 if (msg.data) {
                     adminState.upsertSystem(msg.id, msg.data);
                 } else {
                     adminState.updateSystem(msg.id, { status: "online" });
                 }
             } else if (msg.type === "system_offline") {
                 if (msg.data) {
                     adminState.upsertSystem(msg.id, msg.data);
                 } else {
                     adminState.updateSystem(msg.id, { status: "offline" });
                 }
             } else if (msg.type === "system_updated") {
                 // Full system update — upsert to handle edge cases
                 if (msg.data) {
                     adminState.upsertSystem(msg.id, msg.data);
                 }
             } else if (msg.type === "system_deleted") {
                 adminState.removeSystem(msg.id);
             }
          });
          return unsubscribe;
      }
  });

  const logout = () => {
    localStorage.removeItem("login_token");
    localStorage.removeItem("isLoggedin");
    // Close WS? ws.disconnect()? Not implemented but connection will drop on nav usually
    goto("/admin/login");
  }
</script>

<div class="min-h-screen bg-gray-50 text-gray-900 font-[var(--font-main)] flex flex-col md:flex-row overflow-x-hidden">
  {#if !page.url.pathname.includes("/admin/login")}
    <!-- Mobile Header -->
    <div class="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between fixed top-0 left-0 right-0 z-40 h-16">
       <div class="flex items-center gap-2">
          <span class="bg-gray-100 p-1.5 rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg> 
          </span>
          <span class="font-bold text-gray-900">ADMIN</span>
       </div>
       <button onclick={() => isMobileMenuOpen = !isMobileMenuOpen} class="text-gray-600 p-2 rounded-lg hover:bg-gray-100" aria-label="Toggle mobile menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
       </button>
    </div>

    <!-- Desktop Sidebar -->
    <aside class="{isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto shadow-sm z-30 transition-all duration-300 hidden md:flex flex-col">
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        {#if !isSidebarCollapsed}
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2 px-1">
          <span class="bg-gray-100 p-1.5 rounded-lg border border-gray-200">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg> 
          </span>
          ADMIN
        </h1>
        {/if}
        <button onclick={() => isSidebarCollapsed = !isSidebarCollapsed} class="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors mx-auto md:mx-0" aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
           {#if isSidebarCollapsed}
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
             </svg>
           {:else}
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
             </svg>
           {/if}
        </button>
      </div>
      
      <nav class="p-4 space-y-1 flex-1">
        <a href="/admin/users" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/users') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "User Management" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">User Management</span>
           {/if}
        </a>

        {#if userRole === 'superadmin'}
        <a href="/admin/admins" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/admin/admins') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "Admin Management" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Admins</span>
           {/if}
        </a>
        {/if}

        <a href="/admin/systems" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/systems') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "System Management" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Systems</span>
           {/if}
        </a>

        <a href="/admin/debug/questions" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/admin/debug') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "Debugging Management" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Debugging</span>
           {/if}
        </a>

        <a href="/admin/typing" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/typing') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "Typing Management" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Typing</span>
           {/if}
        </a>

        <a href="/admin/results" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/results') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "Results" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Results</span>
           {/if}
        </a>

        <a href="/admin/logs" 
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
           {page.url.pathname.includes('/logs') 
             ? 'bg-gray-900 text-white shadow-md' 
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}
           {isSidebarCollapsed ? 'justify-center px-2' : ''}"
           title={isSidebarCollapsed ? "Logs" : ""}
        >
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
           </svg>
           {#if !isSidebarCollapsed}
             <span class="truncate">Logs</span>
           {/if}
        </a>
      </nav>

      <div class="{isSidebarCollapsed ? 'items-center' : ''} p-4 border-t border-gray-200 bg-gray-50/50 flex flex-col gap-2">
         {#if !isSidebarCollapsed}
           <div class="px-4 py-2">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Logged in as</p>
              <p class="text-sm font-semibold text-gray-900 truncate">Administrator</p>
           </div>
         {/if}
         <button onclick={logout} 
            class="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black rounded-lg transition-colors border border-transparent hover:border-gray-200
            {isSidebarCollapsed ? 'justify-center px-2' : ''}"
            title={isSidebarCollapsed ? "Sign Out" : ""}
            aria-label="Sign Out"
         >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
            </svg>
            {#if !isSidebarCollapsed}
              <span class="truncate">Sign Out</span>
            {/if}
          </button>
       </div>
    </aside>

    <!-- Mobile Sidebar Overlay -->
    {#if isMobileMenuOpen}
        <div 
          class="fixed inset-0 bg-gray-900/50 z-50 md:hidden" 
          onclick={() => isMobileMenuOpen = false} 
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Escape' && (isMobileMenuOpen = false)}
          transition:fade={{ duration: 200 }}
          aria-label="Close mobile menu"
        ></div>
        <aside 
          class="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto shadow-xl z-50 md:hidden flex flex-col"
          transition:fly={{ x: -300, duration: 300 }}
        >
            <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                 <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                  <span class="bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-800" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clip-rule="evenodd" />
                    </svg> 
                  </span>
                  ADMIN
                </h1>
                <button onclick={() => isMobileMenuOpen = false} class="text-gray-500 hover:text-gray-900" aria-label="Close mobile menu">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                </button>
            </div>
             <nav class="p-4 space-y-1 flex-1">
                <a href="/admin/users" 
                   onclick={() => isMobileMenuOpen = false}
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/users') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                   </svg>
                   User Management
                </a>

                {#if userRole === 'superadmin'}
                <a href="/admin/admins"
                   onclick={() => isMobileMenuOpen = false}
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/admin/admins') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                   </svg>
                   Admins
                </a>
                {/if}

                <a href="/admin/systems"
                   onclick={() => isMobileMenuOpen = false} 
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/systems') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                   </svg>
                   Systems
                </a>

                <a href="/admin/debug/questions"
                   onclick={() => isMobileMenuOpen = false} 
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/admin/debug') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                   </svg>
                   Debugging
                </a>

                <a href="/admin/typing"
                   onclick={() => isMobileMenuOpen = false} 
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/typing') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd" />
                   </svg>
                   Typing
                </a>

                 <a href="/admin/results"
                   onclick={() => isMobileMenuOpen = false} 
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/results') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                   </svg>
                   Results
                </a>

                <a href="/admin/logs"
                   onclick={() => isMobileMenuOpen = false} 
                   class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border border-transparent
                   {page.url.pathname.includes('/logs') 
                     ? 'bg-gray-900 text-white shadow-md' 
                     : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-200'}">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                   </svg>
                   Logs
                </a>
             </nav>
             <div class="p-4 border-t border-gray-200 bg-gray-50/50 mb-safe">
                 <button onclick={logout} class="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black rounded-lg transition-colors border border-transparent hover:border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
                    </svg>
                    Sign Out
                 </button>
             </div>
        </aside>
    {/if}


    <!-- Main Content -->
    <main class="flex-1 min-h-screen p-4 md:p-8 pt-20 md:pt-8 transition-all duration-300 {isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} ml-0 min-w-0">
      {@render children()}
    </main>
  {:else}
    <!-- Login Layout (Full Screen) -->
    <main class="w-full h-full flex items-center justify-center p-4">
        {@render children()}
    </main>
  {/if}
</div>
