<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import CreatableSelect from "$lib/components/admin/CreatableSelect.svelte";
  import { fade, fly } from "svelte/transition";

  let systems = $state<any[]>([]);
  let users = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isAssignModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Filters
  let searchQuery = $state("");
  let statusFilter = $state("all");

  // Form State
  let newSystem = $state({
      code: "",
      status: "offline"
  });

  let assigningSystem = $state<any>(null);
  let selectedUserId = $state<string>("");
  
  // Assign Modal State
  let availableColleges = $state<string[]>([]);
  let availableBranches = $state<string[]>([]);
  let modalCollegeFilter = $state("");
  let modalBranchFilter = $state("");
  let modalSelectedUserString = $state(""); // Holds the selected string from dropdown

  // Derived users for dropdown
  let filteredUserOptions = $derived(
      users.filter(u => {
          const matchesCollege = !modalCollegeFilter || u.college === modalCollegeFilter;
          const matchesBranch = !modalBranchFilter || u.branch === modalBranchFilter;
          return matchesCollege && matchesBranch && u.role !== 'admin'; // Usually admins don't get systems assigned? Optional.
      }).map(u => `[#${u.id}] ${u.name} - ${u.branch}, ${u.year}Yr`)
  );

  // System Detail View State
  let selectedSystem = $state<any>(null);
  let isOtpVisible = $state(false);

  // Delete State
  let isDeleteModalOpen = $state(false);
  let systemToDelete = $state<any>(null);

  // Derived state for filtered systems
  let filteredSystems = $derived(systems.filter(system => {
    const matchesSearch = system.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (system.assigned_to_name && system.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || system.status === statusFilter;
    return matchesSearch && matchesStatus;
  }));
    
  // Status Colors Helper
  const statusColors: any = {
      offline: "bg-gray-100 text-gray-600 border-gray-200",
      online: "bg-green-100 text-green-700 border-green-200",
      booked: "bg-yellow-100 text-yellow-700 border-yellow-200",
      exam: "bg-purple-100 text-purple-700 border-purple-200"
  };

  async function fetchSystems() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/system", "GET", null, token);
          if (Array.isArray(res)) {
            systems = res;
          } else if (res.systems) {
            systems = res.systems;
          } else {
            systems = [];
          }
      } catch (e: any) {
          error = e.message;
          // Mock data for UI development if API fails
          if (systems.length === 0) {
             systems = [
                 { id: 1, code: "SYS-001", status: "offline", assigned_to: null, login_otp: null },
                 { id: 2, code: "SYS-002", status: "online", assigned_to: 101, assigned_to_name: "John Doe", login_otp: "12345" },
                 { id: 3, code: "SYS-003", status: "booked", assigned_to: 102, assigned_to_name: "Jane Smith", login_otp: "54321" },
             ];
          }
      } finally {
          loading = false;
      }
  }

  async function fetchUsers() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/user", "GET", null, token);
          if (Array.isArray(res)) users = res;
          else if (res.users) users = res.users;
      } catch (e) {
          console.error("Failed to fetch users", e);
          // Mock users
          users = [
              { id: 101, name: "John Doe", email: "john@example.com" },
              { id: 102, name: "Jane Smith", email: "jane@example.com" }
          ];
      }
  }
  async function fetchUniqueFields() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/user/fields", "GET", null, token);
          if (res) {
              availableColleges = (res.colleges || []).filter(Boolean);
              availableBranches = (res.branches || []).filter(Boolean);
          }
      } catch (e) {
          console.error("Failed to fetch fields", e);
      }
  }
  async function handleAddSystem() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api("/system", "POST", newSystem, token || "");
          isAddModalOpen = false;
          newSystem = { code: "", status: "offline" };
          fetchSystems();
      } catch (e: any) {
          alert(`Error creating system: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleAssignUser() {
      if (!assigningSystem || !modalSelectedUserString) return;
      
      // Extract ID from string: "[#ID] Name - ..."
      const idMatch = modalSelectedUserString.match(/^\[#(\d+)\]/);
      const userId = idMatch ? parseInt(idMatch[1]) : null;
      
      if (!userId) {
          alert("Invalid user selection");
          return;
      }

      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          // Generate OTP automatically on assignment
          const otp = Math.floor(10000 + Math.random() * 90000).toString();
          
          await api(`/system?id=${assigningSystem.id}`, "PUT", { 
              assigned_to: userId,
              login_otp: otp,
              status: 'booked'
          }, token || "");
          
          isAssignModalOpen = false;
          
          // Refresh list and if viewing this system details, refresh that too
          await fetchSystems();
          if (selectedSystem && selectedSystem.id === assigningSystem.id) {
            selectedSystem = systems.find(s => s.id === assigningSystem.id);
          }
      } catch (e: any) {
          alert(`Error assigning system: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleStatusChange(system: any, newStatus: string) {
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${system.id}`, "PUT", { status: newStatus }, token || "");
          await fetchSystems();
          // Update details view if open
          if (selectedSystem && selectedSystem.id === system.id) {
             selectedSystem = systems.find(s => s.id === system.id);
          }
      } catch (e: any) {
          alert(`Error updating status: ${e.message}`);
      }
  }
    
  function openAssignModal(system: any) {
      assigningSystem = system;
      // Pre-select user if assigned?
      // For now reset. Or if assigned, find the string.
      if (system.assigned_to && system.assigned_to_name) {
         // Try to construct string if we have user details? 
         // System response might not have all user details (branch/year etc).
         // So better to start fresh or just leave empty if re-assigning.
         // Let's reset for now to force selection.
         modalSelectedUserString = "";
      } else {
         modalSelectedUserString = "";
      }
      modalCollegeFilter = "";
      modalBranchFilter = "";
      isAssignModalOpen = true;
  }

  async function handleGenerateOTP(system: any) {
      if (!confirm("Generate new OTP for this system?")) return;
      try {
          const token = localStorage.getItem("login_token");
          const otp = Math.floor(10000 + Math.random() * 90000).toString();
          await api(`/system?id=${system.id}`, "PUT", { login_otp: otp }, token || "");
          await fetchSystems();
          // Update details view if open
          if (selectedSystem && selectedSystem.id === system.id) {
             selectedSystem = systems.find(s => s.id === system.id);
          }
      } catch (e: any) {
          alert(`Error generating OTP: ${e.message}`);
      }
  }

  async function handleDeleteSystem() {
      if (!systemToDelete) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${systemToDelete.id}`, "DELETE", null, token || "");
          
          isDeleteModalOpen = false;
          systemToDelete = null;
          
          if (selectedSystem && selectedSystem.id === systemToDelete?.id) {
              selectedSystem = null;
          }
          await fetchSystems();
      } catch (e: any) {
          alert(`Error deleting system: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  function confirmDelete(system: any) {
      systemToDelete = system;
      isDeleteModalOpen = true;
  }
    
  function openSystemDetail(system: any) {
      selectedSystem = system;
      isOtpVisible = false; // Reset visibility when opening details
  }

  onMount(() => {
      fetchSystems();
      fetchUsers();
      fetchUniqueFields();
  });

</script>

{#snippet statusCell(row: any)}
  <span class="text-xs px-2 py-1 rounded-full border uppercase tracking-wider font-mono {statusColors[row.status] || 'bg-gray-100'}">
    {row.status}
  </span>
{/snippet}

{#snippet assignedToCell(row: any)}
    {#if row.assigned_to_name}
        <div class="flex items-center gap-2">
            <div class="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                {row.assigned_to_name.charAt(0)}
            </div>
            <span class="text-sm font-medium">{row.assigned_to_name}</span>
        </div>
    {:else}
        <span class="text-gray-400 text-sm italic">Unassigned</span>
    {/if}
{/snippet}

{#snippet otpCell(row: any)}
    {#if row.login_otp}
        <div class="group relative w-20 cursor-default">
             <div class="absolute inset-0 bg-gray-200 rounded blur-sm group-hover:blur-none transition-all duration-300 opacity-100 group-hover:opacity-0 pointer-events-none"></div>
             <code class="block w-full text-center px-1 py-1 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-700 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 {row.login_otp}
             </code>
             <code class="absolute top-0 left-0 w-full text-center px-1 py-1 text-sm font-mono text-gray-400 group-hover:opacity-0 transition-opacity duration-300">
                •••••
            </code>
        </div>
    {:else}
        <span class="text-gray-400 text-xs">-</span>
    {/if}
{/snippet}

{#snippet actionCell(row: any)}
  <div class="flex items-center gap-2">
    <Button 
        variant="secondary" 
        class="!py-2 !px-4 text-sm font-medium cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all active:scale-95"
        onclick={() => openSystemDetail(row)}
    >
        Manage
    </Button>
    <button 
        onclick={(e) => { e.stopPropagation(); confirmDelete(row); }}
        class="cursor-pointer p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete System"
    >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    </button>
  </div>
{/snippet}

<div class="relative min-h-screen -m-4 md:-m-8">
  
  {#if selectedSystem}
      <!-- Detail View Overlay (Fills content area, not sidebar) -->
      <div 
        class="fixed inset-0 z-50 md:absolute md:z-10 md:inset-0 bg-gray-50/95 backdrop-blur-sm overflow-y-auto md:rounded-xl"
        transition:fly={{ y: 20, duration: 200 }}
      >
         <!-- Close on background click (handled by parent click) -->
         <div 
            class="min-h-full w-full p-0 md:p-8"
            onclick={(e) => { if(e.target === e.currentTarget) selectedSystem = null; }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Escape' && (selectedSystem = null)}
         >
             <div class="max-w-5xl mx-auto bg-white min-h-screen md:min-h-0 md:rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative" onclick={(e) => e.stopPropagation()} role="presentation">

                <!-- Close Button -->
                <button 
                    onclick={() => selectedSystem = null}
                    aria-label="Close details"
                    class="cursor-pointer absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors z-20"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <!-- System Header Band -->
                <div class="p-6 md:p-8 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <span class="text-sm font-medium text-gray-500 uppercase tracking-widest">System Code</span>
                            <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">ID: {selectedSystem.id}</span>
                        </div>
                        <h1 class="text-4xl font-extrabold text-gray-900 tracking-tight">{selectedSystem.code}</h1>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="px-4 py-2 rounded-lg border flex flex-col items-center bg-white shadow-sm {selectedSystem.status === 'online' ? 'border-green-200 bg-green-50' : selectedSystem.status === 'booked' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}">
                            <span class="text-xs uppercase font-bold text-gray-500">Status</span>
                            <span class="text-lg font-bold capitalize {selectedSystem.status === 'online' ? 'text-green-700' : selectedSystem.status === 'booked' ? 'text-yellow-700' : 'text-gray-700'}">
                                {selectedSystem.status}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                    
                    <!-- Left: User & Login Info -->
                    <div class="p-6 md:p-8 flex flex-col gap-8">
                        <div>
                            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                                </svg>
                                Assigned User
                            </h3>
                            {#if selectedSystem.assigned_to_name}
                                <div class="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-start gap-4 shadow-sm">
                                     <div class="h-12 w-12 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xl font-bold shrink-0 shadow-inner">
                                        {selectedSystem.assigned_to_name.charAt(0)}
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-lg font-semibold text-gray-900">{selectedSystem.assigned_to_name}</div>
                                        <div class="text-sm text-blue-700 font-medium">Currently Assigned</div>
                                        <div class="mt-3 flex gap-2">
                                            <button 
                                                onclick={() => openAssignModal(selectedSystem)}
                                                class="cursor-pointer px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                                            >
                                                Change User
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            {:else}
                                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100 border-dashed text-center flex flex-col items-center justify-center gap-3">
                                    <div class="text-gray-400 font-medium">No user is currently using this system</div>
                                    <Button onclick={() => openAssignModal(selectedSystem)}>Assign User Now</Button>
                                </div>
                            {/if}
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                                </svg>
                                Login Credentials
                            </h3>
                             {#if selectedSystem.login_otp}
                                <div class="flex items-center gap-4">
                                    <div class="relative">
                                        <button 
                                            onclick={() => isOtpVisible = !isOtpVisible}
                                            class="group px-6 py-3 bg-gray-900 rounded-lg text-white font-mono text-2xl tracking-[0.2em] relative overflow-hidden cursor-pointer select-none shadow-lg transform transition-transform hover:scale-105 active:scale-95 w-full md:w-auto"
                                            title={isOtpVisible ? "Hide OTP" : "Show OTP"}
                                        >
                                            <span class="{isOtpVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 font-bold">{selectedSystem.login_otp}</span>
                                            <span class="absolute inset-0 flex items-center justify-center {isOtpVisible ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200 text-gray-500 font-bold">•••••</span>
                                        </button>
                                        <div class="mt-2 text-center text-xs text-gray-500 font-medium uppercase tracking-wide">Click to {isOtpVisible ? 'hide' : 'reveal'}</div>
                                    </div>

                                </div>
                            {:else}
                                 <div class="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                     No active OTP. Assign a user or generate one manually.
                                 </div>
                                 <div class="mt-3">
                                     <Button variant="secondary" onclick={() => handleGenerateOTP(selectedSystem)}>Generate New OTP</Button>
                                 </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Right: Quick Actions -->
                    <div class="p-6 md:p-8 bg-gray-50/50">
                        <h3 class="text-lg font-bold text-gray-900 mb-6">Quick Actions</h3>
                        
                        <div class="space-y-6">
                            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Set Status</span>
                                <div class="grid grid-cols-2 gap-3">
                                    {#each ['offline', 'online', 'booked', 'exam'] as status}
                                        <button 
                                            onclick={() => handleStatusChange(selectedSystem, status)}
                                            class="cursor-pointer px-3 py-2.5 text-sm font-semibold rounded-lg transition-all border shadow-sm
                                            {selectedSystem.status === status 
                                                ? 'bg-gray-900 text-white border-gray-900 ring-2 ring-offset-2 ring-gray-900' 
                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}"
                                        >
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Maintenance</span>
                                <div class="space-y-2">
                                     <button onclick={() => handleGenerateOTP(selectedSystem)} class="cursor-pointer w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-3 transition-colors border border-transparent hover:border-red-100">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                         </svg>
                                         Force Reset OTP
                                     </button>

                                     <button onclick={() => confirmDelete(selectedSystem)} class="cursor-pointer w-full text-left px-4 py-3 text-sm font-bold bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 rounded-lg flex items-center gap-3 transition-colors border border-red-200 hover:border-red-300 shadow-sm mt-4">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 group-hover:text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                         </svg>
                                         Delete System
                                     </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </div>
  {/if}

  <div class="p-4 md:p-8 space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">System Management</h1>
    <Button onclick={() => isAddModalOpen = true}>
      <span class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Register System
      </span>
    </Button>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      Error: {error}
    </div>
  {/if}

  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-1">
      <Input placeholder="Search systems by code or user..." bind:value={searchQuery} />
    </div>
    <div class="w-full md:w-48">
       <select bind:value={statusFilter} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Statuses</option>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
          <option value="booked">Booked</option>
          <option value="exam">Exam</option>
       </select>
    </div>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">
      Loading systems...
    </div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible max-w-full">
      <Table 
        data={filteredSystems} 
        columns={[
          { key: 'code', label: 'System Code' },
          { key: 'status', label: 'Status', render: statusCell },
          { key: 'assigned_to_name', label: 'Assigned To', render: assignedToCell },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Add System Modal -->
  <Modal 
    isOpen={isAddModalOpen} 
    onClose={() => isAddModalOpen = false} 
    title="Register New System"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAddSystem(); }} class="space-y-4">
      <Input label="System Code" bind:value={newSystem.code} placeholder="SYS-001" required />
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Initial Status</span>
             <select bind:value={newSystem.status} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="offline">Offline</option>
                 <option value="online">Online</option>
             </select>
         </label>
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register System'}
        </Button>
      </div>
    </form>
  </Modal>

  <!-- Assign User Modal -->
  <Modal 
    isOpen={isAssignModalOpen} 
    onClose={() => isAssignModalOpen = false} 
    title="Assign System to User"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAssignUser(); }} class="space-y-4">
      <div class="space-y-4">
         <div class="grid grid-cols-2 gap-4">
             <div>
                <span class="text-sm font-medium text-gray-700 block mb-1.5">Filter by College</span>
                <CreatableSelect 
                    options={availableColleges} 
                    bind:value={modalCollegeFilter} 
                    placeholder="All Colleges" 
                    creatable={false}
                />
             </div>
             <div>
                <span class="text-sm font-medium text-gray-700 block mb-1.5">Filter by Branch</span>
                <CreatableSelect 
                    options={availableBranches} 
                    bind:value={modalBranchFilter} 
                    placeholder="All Branches" 
                    creatable={false}
                />
             </div>
         </div>

         <div class="w-full">
             <span class="text-sm font-medium text-gray-700 block mb-1.5">Select User <span class="text-red-500">*</span></span>
             <CreatableSelect 
                 options={filteredUserOptions} 
                 bind:value={modalSelectedUserString} 
                 placeholder="Search user by name..." 
                 creatable={false}
                 required
             />
             {#if modalSelectedUserString}
                 <p class="mt-1 text-xs text-green-600 font-medium">Selected: {modalSelectedUserString}</p>
             {/if}
         </div>
      </div>

      <div class="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
          Note: This will automatically generate a new 5-digit login OTP for the system.
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAssignModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Assigning...' : 'Assign User'}
        </Button>
      </div>
    </form>
  </Modal>

  <!-- Confirm Delete Modal -->
  <Modal 
    isOpen={isDeleteModalOpen} 
    onClose={() => isDeleteModalOpen = false} 
    title="Confirm Deletion"
  >
     <div class="space-y-4">
        <div class="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-4 items-start">
            <div class="p-2 bg-red-100 rounded-full text-red-600 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div>
                <h3 class="text-sm font-bold text-red-900">Warning: Irreversible Action</h3>
                <p class="text-sm text-red-700 mt-1">
                    Are you sure you want to delete system <span class="font-mono font-bold">{systemToDelete?.code}</span>? This action cannot be undone and will remove all associated user assignments.
                </p>
            </div>
        </div>

        <div class="pt-2 flex justify-end gap-3">
            <Button variant="secondary" onclick={() => isDeleteModalOpen = false}>Cancel</Button>
            <button 
                onclick={handleDeleteSystem}
                disabled={isSubmitting}
                class="cursor-pointer px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {#if isSubmitting}
                    <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                {:else}
                    Yes, Delete System
                {/if}
            </button>
        </div>
     </div>
  </Modal>
  </div>
</div>
