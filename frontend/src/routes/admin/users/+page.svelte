<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import CreatableSelect from "$lib/components/admin/CreatableSelect.svelte";

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
      phone: ""
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

  async function fetchUniqueFields() {
      try {
          const token = localStorage.getItem("login_token");
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
          const token = localStorage.getItem("login_token");
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
          const token = localStorage.getItem("login_token");
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
          const token = localStorage.getItem("login_token");
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
          const token = localStorage.getItem("login_token");
          await api("/user", "POST", newUser, token || "");
          isAddModalOpen = false;
          // Reset form
          newUser = { name: "", role: "member", year: 1, branch: "", college: "", phone: "" };
          fetchUsers();
          fetchUniqueFields();
      } catch (e: any) {
          alert(`Error creating user: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
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
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAddUser(); }} class="space-y-4">
      <Input label="Name" bind:value={newUser.name} placeholder="John Doe" required />
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Role <span class="text-red-500">*</span></span>
             <select bind:value={newUser.role} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="member">Member</option>
                 <option value="lead">Lead</option>
             </select>
         </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
         <Input label="Year" type="number" bind:value={newUser.year} required />
         
         <div class="w-full">
            <span class="text-sm font-medium text-gray-700 block mb-1.5">Branch <span class="text-red-500">*</span></span>
            <CreatableSelect 
                options={availableBranches} 
                bind:value={newUser.branch} 
                placeholder="Search or add branch..." 
                required 
            />
         </div>
      </div>

      <div class="w-full">
        <span class="text-sm font-medium text-gray-700 block mb-1.5">College <span class="text-red-500">*</span></span>
        <CreatableSelect 
            options={availableColleges} 
            bind:value={newUser.college} 
            placeholder="Search or add college..." 
            required 
        />
      </div>

      <Input label="Phone" bind:value={newUser.phone} placeholder="1234567890" required />

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
  >
    <form onsubmit={(e) => { e.preventDefault(); handleUpdateUser(); }} class="space-y-4">
      <Input label="Name" bind:value={editingUser.name} placeholder="John Doe" required />
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Role <span class="text-red-500">*</span></span>
             <select bind:value={editingUser.role} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="member">Member</option>
                 <option value="lead">Lead</option>
             </select>
         </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
         <Input label="Year" type="number" bind:value={editingUser.year} required />
         
         <div class="w-full">
            <span class="text-sm font-medium text-gray-700 block mb-1.5">Branch <span class="text-red-500">*</span></span>
            <CreatableSelect 
                options={availableBranches} 
                bind:value={editingUser.branch} 
                placeholder="Search or add branch..." 
                required 
            />
         </div>
      </div>

      <div class="w-full">
        <span class="text-sm font-medium text-gray-700 block mb-1.5">College <span class="text-red-500">*</span></span>
        <CreatableSelect 
            options={availableColleges} 
            bind:value={editingUser.college} 
            placeholder="Search or add college..." 
            required 
        />
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
