<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import * as adminState from "$lib/admin_state.svelte";
  import * as ws from "$lib/ws.svelte";
  
  let systems = $derived(adminState.getSystems());
  let debugLevels = $state<any[]>([]);
  let typingLevels = $state<any[]>([]);
  let onlineSystems = $derived(systems.filter(s => s.status === 'online'));
  let users = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Pagination & Filters State
  let currentPage = $state(1);
  let pageSize = $state(20);
  let totalUsers = $state(0);
  let totalPages = $derived(Math.ceil(totalUsers / pageSize));

  let searchQuery = $state("");
  let roleFilter = $state("all");
  let collegeFilter = $state("all");
  let branchFilter = $state("all");
  
  // Available Options
  let availableColleges = $state<string[]>([]);
  let availableBranches = $state<string[]>([]);

  // Form State
  let newUser = $state({
      name: "",
      role: "member",
      year: 1,
      branch: "",
      college: "",
      phone: "",
      system_id: null as number | null,
      exam_type: "debug",
      level_id: null as number | null
  });

  let editingUser = $state({
      id: 0,
      name: "",
      role: "member",
      year: 1,
      branch: "",
      college: "",
      phone: ""
  });

  function getAdminToken() {
    return localStorage.getItem("admin_token") || localStorage.getItem("login_token") || "";
  }

  async function fetchUniqueFields() {
      try {
          const token = getAdminToken();
          if (!token) return;
          const res = await api("/user/fields", "GET", null, token);
          if (res) {
              availableColleges = res.colleges || [];
              availableBranches = res.branches || [];
          }
      } catch (e) {
          console.error("Failed to fetch fields", e);
      }
  }

  async function fetchUsers() {
      loading = true;
      try {
          const token = getAdminToken();
          if (!token) return;
          
          let query = `/user?limit=${pageSize}&offset=${(currentPage - 1) * pageSize}`;
          if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
          if (roleFilter !== "all") query += `&role=${encodeURIComponent(roleFilter)}`;
          if (collegeFilter !== "all") query += `&college=${encodeURIComponent(collegeFilter)}`;
          if (branchFilter !== "all") query += `&branch=${encodeURIComponent(branchFilter)}`;

          const res = await api(query, "GET", null, token);
          
          if (res.users) {
            // Filter out admins and superadmins from this view (they are managed in /admin/admins)
            users = res.users.filter((u: any) => u.role !== 'admin' && u.role !== 'superadmin');
            totalUsers = res.total; // Total might be slightly off if backend count includes admins, but good enough for now
          } else if (Array.isArray(res)) {
              // Fallback for older API shape if needed
              users = res.filter((u: any) => u.role !== 'admin' && u.role !== 'superadmin');
              totalUsers = users.length;
          } else {
             users = [];
             totalUsers = 0;
          }
      } catch (e: any) {
          if (e.message?.includes("Forbidden") || e.message?.includes("Unauthorized")) {
              localStorage.removeItem("admin_token");
              localStorage.removeItem("login_token");
              window.location.href = "/admin/login";
              return;
          }
          error = e.message;
      } finally {
          loading = false;
      }
  }

  function handleFilterChange() {
      currentPage = 1; // Reset to page 1 on filter change
      fetchUsers();
  }

  async function handleDelete(id: number) {
      if (!confirm("Are you sure you want to delete this user?")) return;
      
      try {
          const token = getAdminToken();
          await api(`/user?id=${id}`, "DELETE", null, token || "");
          // Refresh list
          fetchUsers();
          fetchUniqueFields(); // update fields in case that was the last user of that branch/college
      } catch (e: any) {
          alert(`Error deleting user: ${e.message}`);
      }
  }

  function handleEdit(user: any) {
      editingUser = { ...user };
      isEditModalOpen = true;
  }

  async function handleUpdateUser() {
      isSubmitting = true;
      try {
          const token = getAdminToken();
          await api("/user", "PUT", editingUser, token || "");
          isEditModalOpen = false;
          fetchUsers();
          fetchUniqueFields();
      } catch (e: any) {
          alert(`Error updating user: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleAddUser() {
      isSubmitting = true;
      try {
          const token = getAdminToken();
          await api("/user", "POST", newUser, token || "");
          
          isAddModalOpen = false;
          // Reset form
          newUser = { 
              name: "", role: "member", year: 1, branch: "", college: "", phone: "" ,
              system_id: null, exam_type: "debug", level_id: null
          };
          fetchUsers();
          fetchUniqueFields();
      } catch (e: any) {
          // If the error message indicates a booking failure, we tell the user specifically
          if (e.message.toLowerCase().includes("booked") || e.message.toLowerCase().includes("disconnected")) {
             alert(`HOLD ON! ${e.message}`);
             // Re-fetch systems to refresh the list of available ones
             const sysRes = await api("/system", "GET", null, getAdminToken());
             if (Array.isArray(sysRes)) adminState.setSystems(sysRes);
          } else {
             alert(`Error creating user: ${e.message}`);
          }
      } finally {
          isSubmitting = false;
      }
  }

  async function fetchDebugLevels() {
      try {
          const token = getAdminToken();
          const res = await api("/debug/level", "GET", null, token || "");
          debugLevels = res || [];
      } catch (e) { console.error(e); }
  }

  async function fetchTypingLevels() {
      try {
          const token = getAdminToken();
          const res = await api("/typing/level", "GET", null, token || "");
          typingLevels = res || [];
      } catch (e) { console.error(e); }
  }

  function nextPage() {
      if (currentPage < totalPages) {
          currentPage++;
          fetchUsers();
      }
  }

  function prevPage() {
      if (currentPage > 1) {
          currentPage--;
          fetchUsers();
      }
  }

  onMount(() => {
      fetchUniqueFields();
      fetchUsers();
      fetchDebugLevels();
      fetchTypingLevels();

      // Ensure systems are synced via WS
      const token = getAdminToken();
      if (token && !ws.state.connected) ws.connect(token);
  });

  $effect(() => {
      // Reset level_id when exam_type changes to avoid cross-type level IDs
      if (newUser.exam_type) {
          newUser.level_id = null;
      }
  });


</script>

{#snippet roleCell(row: any)}
  <span class="text-xs px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 uppercase tracking-wider font-mono">
    {row.role}
  </span>
{/snippet}

{#snippet actionCell(row: any)}
  <div class="flex items-center gap-2">
    <button onclick={() => handleEdit(row)} class="text-blue-600 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Edit User">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    </button>
    <button onclick={() => handleDelete(row.id)} class="text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Delete User">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
{/snippet}

<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <h1 class="text-3xl font-bold text-gray-900">User Management</h1>
    <Button onclick={() => isAddModalOpen = true}>
      <span class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Add User
      </span>
    </Button>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      Error: {error}
    </div>
  {/if}

  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
    <div class="md:col-span-1">
      <Input placeholder="Search name, phone..." bind:value={searchQuery} onchange={handleFilterChange} />
    </div>
    <div>
       <select bind:value={roleFilter} onchange={handleFilterChange} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Roles</option>
          <option value="member">Member</option>
          <option value="lead">Lead</option>
       </select>
    </div>
    <div>
       <select bind:value={collegeFilter} onchange={handleFilterChange} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Colleges</option>
          {#each availableColleges as college}
             <option value={college}>{college}</option>
          {/each}
       </select>
    </div>
    <div>
       <select bind:value={branchFilter} onchange={handleFilterChange} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Branches</option>
          {#each availableBranches as branch}
             <option value={branch}>{branch}</option>
          {/each}
       </select>
    </div>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">
      Loading users...
    </div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto max-w-full">
      <Table 
        data={users} 
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'role', label: 'Role', render: roleCell },
          { key: 'branch', label: 'Branch' },
          { key: 'year', label: 'Year' },
          { key: 'college', label: 'College' },
          { key: 'phone', label: 'Phone' },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>

    <!-- Pagination Controls -->
    <div class="flex items-center justify-between py-4">
        <div class="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
        </div>
        <div class="flex items-center gap-2">
            <button 
                onclick={prevPage} 
                disabled={currentPage === 1}
                class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                Previous
            </button>
            <span class="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages || 1}</span>
            <button 
                onclick={nextPage} 
                disabled={currentPage >= totalPages}
                class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                Next
            </button>
        </div>
    </div>
  {/if}

  <Modal 
    isOpen={isAddModalOpen} 
    onClose={() => isAddModalOpen = false} 
    title="Add New User"
    maxWidth="max-w-xl"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAddUser(); }} class="space-y-4">
      <Input label="Name" bind:value={newUser.name} placeholder="John Doe" required />
      
      <!-- Role Toggle -->
      <div class="w-full">
         <span class="text-sm font-medium text-gray-700 block mb-1.5">Role <span class="text-red-500">*</span></span>
         <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
             <button 
                 type="button" 
                 onclick={() => newUser.role = 'member'}
                 class="py-2 text-sm font-medium rounded-md transition-all {newUser.role === 'member' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
             >
                 Member
             </button>
             <button 
                 type="button" 
                 onclick={() => newUser.role = 'lead'}
                 class="py-2 text-sm font-medium rounded-md transition-all {newUser.role === 'lead' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
             >
                 Lead
             </button>
         </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
         <Input label="Year" type="number" bind:value={newUser.year} required />
         
         <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Branch <span class="text-red-500">*</span></span>
                <input 
                    type="text" 
                    list="branch-list-new"
                    bind:value={newUser.branch} 
                    placeholder="e.g. CSE, ECE, IT" 
                    required
                    class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
                />
                <datalist id="branch-list-new">
                    {#each availableBranches as b}
                        <option value={b}></option>
                    {/each}
                </datalist>
            </label>
         </div>
      </div>

      <div class="w-full">
        <label class="flex flex-col gap-1.5 w-full">
            <span class="text-sm font-medium text-gray-700">College <span class="text-red-500">*</span></span>
            <input 
                type="text" 
                list="college-list-new"
                bind:value={newUser.college} 
                placeholder="e.g. ABC College of Engineering" 
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
            />
            <datalist id="college-list-new">
                {#each availableColleges as c}
                    <option value={c}></option>
                {/each}
            </datalist>
        </label>
      </div>

      <Input label="Phone" bind:value={newUser.phone} placeholder="1234567890" required />

      <div class="pt-4 border-t border-gray-100">
         <div class="flex items-center gap-2 mb-4">
             <div class="p-2 bg-indigo-50 rounded-lg">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                 </svg>
             </div>
             <div>
                 <h4 class="text-sm font-bold text-gray-900 leading-none">Assign System (Optional)</h4>
                 <p class="text-[11px] text-gray-500 mt-1">Book a machine immediately for this user.</p>
             </div>
         </div>

         <div class="grid grid-cols-1 gap-4">
            <div>
                <span class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Available Systems</span>
                <select 
                    bind:value={newUser.system_id}
                    class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-600 transition-all shadow-sm"
                >
                    <option value={null}>Do not assign now</option>
                    {#each onlineSystems as s}
                        <option value={s.id}>{s.code} (Online)</option>
                    {/each}
                </select>
                {#if onlineSystems.length === 0}
                    <p class="mt-1.5 text-[10px] text-amber-600 font-medium">No online systems available right now.</p>
                {/if}
            </div>

            {#if newUser.system_id}
                <div class="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <span class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Exam Type</span>
                        <select bind:value={newUser.exam_type} class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none">
                            <option value="debug">Debug Protocol</option>
                            <option value="typing">Typing Master</option>
                        </select>
                    </div>
                    {#if newUser.exam_type === 'debug'}
                    <div>
                        <span class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Default Level</span>
                        <select bind:value={newUser.level_id} class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none">
                            <option value={null}>None</option>
                            {#each debugLevels as level}
                                <option value={level.id}>{level.name}</option>
                            {/each}
                        </select>
                    </div>
                    {:else if newUser.exam_type === 'typing'}
                    <div>
                        <span class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Typing Level</span>
                        <select bind:value={newUser.level_id} class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none">
                            <option value={null}>None</option>
                            {#each typingLevels.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)) as level}
                                <option value={level.id}>{level.name}</option>
                            {/each}
                        </select>
                    </div>
                    {/if}
                </div>
            {/if}
         </div>
      </div>

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || !newUser.branch || !newUser.college}>
            {isSubmitting ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </form>
  </Modal>

  <Modal 
    isOpen={isEditModalOpen} 
    onClose={() => isEditModalOpen = false} 
    title="Edit User"
    maxWidth="max-w-xl"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleUpdateUser(); }} class="space-y-4">
      <Input label="Name" bind:value={editingUser.name} placeholder="John Doe" required />
      
      <!-- Role Toggle -->
      <div class="w-full">
         <span class="text-sm font-medium text-gray-700 block mb-1.5">Role <span class="text-red-500">*</span></span>
         <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
             <button 
                 type="button" 
                 onclick={() => editingUser.role = 'member'}
                 class="py-2 text-sm font-medium rounded-md transition-all {editingUser.role === 'member' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
             >
                 Member
             </button>
             <button 
                 type="button" 
                 onclick={() => editingUser.role = 'lead'}
                 class="py-2 text-sm font-medium rounded-md transition-all {editingUser.role === 'lead' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}"
             >
                 Lead
             </button>
         </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
         <Input label="Year" type="number" bind:value={editingUser.year} required />
         
         <div class="w-full">
            <label class="flex flex-col gap-1.5 w-full">
                <span class="text-sm font-medium text-gray-700">Branch <span class="text-red-500">*</span></span>
                <input 
                    type="text" 
                    list="branch-list-edit"
                    bind:value={editingUser.branch} 
                    placeholder="e.g. CSE, ECE, IT" 
                    required
                    class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
                />
                <datalist id="branch-list-edit">
                    {#each availableBranches as b}
                        <option value={b}></option>
                    {/each}
                </datalist>
            </label>
         </div>
      </div>

      <div class="w-full">
        <label class="flex flex-col gap-1.5 w-full">
            <span class="text-sm font-medium text-gray-700">College <span class="text-red-500">*</span></span>
            <input 
                type="text" 
                list="college-list-edit"
                bind:value={editingUser.college} 
                placeholder="e.g. ABC College of Engineering" 
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
            />
            <datalist id="college-list-edit">
                {#each availableColleges as c}
                    <option value={c}></option>
                {/each}
            </datalist>
        </label>
      </div>

      <Input label="Phone" bind:value={editingUser.phone} placeholder="1234567890" required />

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isEditModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || !editingUser.branch || !editingUser.college}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  </Modal>
</div>
