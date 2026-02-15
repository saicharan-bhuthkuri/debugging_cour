<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
    import Input from "$lib/components/admin/Input.svelte";

  let users = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isSubmitting = $state(false);

  // Filters
  let searchQuery = $state("");
  let roleFilter = $state("all");

  // Form State
  let newUser = $state({
      name: "",
      role: "member",
      year: 1,
      branch: "",
      college: "",
      phone: ""
  });

  // Derived state for filtered users
  let filteredUsers = $derived(users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          user.college.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.branch.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }));

  async function fetchUsers() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/user", "GET", null, token);
          if (Array.isArray(res)) {
            users = res;
          } else if (res.users) {
            users = res.users;
          } else {
            users = [];
          }
      } catch (e: any) {
          error = e.message;
      } finally {
          loading = false;
      }
  }

  async function handleDelete(id: number) {
      if (!confirm("Are you sure you want to delete this user?")) return;
      
      try {
          const token = localStorage.getItem("login_token");
          await api(`/user?id=${id}`, "DELETE", null, token || "");
          // Refresh list
          fetchUsers();
      } catch (e: any) {
          alert(`Error deleting user: ${e.message}`);
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
      } catch (e: any) {
          alert(`Error creating user: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

  onMount(() => {
      fetchUsers();
  });


</script>

{#snippet roleCell(row: any)}
  <span class="text-xs px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 uppercase tracking-wider font-mono">
    {row.role}
  </span>
{/snippet}

{#snippet actionCell(row: any)}
  <button onclick={() => handleDelete(row.id)} class="text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Delete User">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
    </svg>
  </button>
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

  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-1">
      <Input placeholder="Search users..." bind:value={searchQuery} />
    </div>
    <div class="w-full md:w-48">
       <select bind:value={roleFilter} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
          <option value="all">All Roles</option>
          <option value="member">Member</option>
          <option value="lead">Lead</option>
          <option value="admin">Admin</option>
       </select>
    </div>
  </div>

  {#if loading}
    <div class="py-12 text-center text-gray-500 animate-pulse">
      Loading users...
    </div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <Table 
        data={filteredUsers} 
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
  {/if}

  <Modal 
    isOpen={isAddModalOpen} 
    onClose={() => isAddModalOpen = false} 
    title="Add New User"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAddUser(); }} class="space-y-4">
      <Input label="Check Name" bind:value={newUser.name} placeholder="John Doe" required />
      
      <div class="w-full">
         <label class="flex flex-col gap-1.5 w-full">
             <span class="text-sm font-medium text-gray-700">Role <span class="text-red-500">*</span></span>
             <select bind:value={newUser.role} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="member">Member</option>
                 <option value="lead">Lead</option>
                 <option value="admin">Admin</option>
             </select>
         </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
         <Input label="Year" type="number" bind:value={newUser.year} required />
         <Input label="Branch" bind:value={newUser.branch} placeholder="CSE" required />
      </div>

      <Input label="College" bind:value={newUser.college} placeholder="Trinity College" required />
      <Input label="Phone" bind:value={newUser.phone} placeholder="1234567890" required />

      <div class="pt-4 flex justify-end gap-3">
        <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </form>
  </Modal>
</div>
