<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import * as adminState from "$lib/admin_state.svelte";

  let admins = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let isAddModalOpen = $state(false);
  let isSubmitting = $state(false);
  
  // Add Admin Form
  let newAdmin = $state({
      name: "",
      password: "",
      role: "admin", // Default and only role for new admins
      year: 0,
      branch: "ADMIN",
      college: "ADMIN",
      phone: ""
  });
  
  async function fetchAdmins() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/user?role=all&limit=1000", "GET", null, token); 
          if (res && res.users) {
              const list = res.users;
              admins = list.filter((u: any) => u.role === 'admin' || u.role === 'superadmin');
              adminState.setAdminCount(admins.length);
          } else {
              admins = [];
              adminState.setAdminCount(0);
          }
      } catch (e: any) {
          error = e.message;
      } finally {
          loading = false;
      }
  }

  async function handleAddAdmin() {
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          // Ensure role is 'admin'
          newAdmin.role = "admin";
          await api("/user", "POST", newAdmin, token || "");
          // Reset form
          newAdmin.name = ""; newAdmin.password = ""; newAdmin.phone = "";
          fetchAdmins();
          isAddModalOpen = false;
      } catch (e: any) {
          alert("Error adding admin: " + e.message);
      } finally {
          isSubmitting = false;
      }
  }

  async function handleDeleteAdmin(id: number) {
      if (!confirm("Are you sure you want to remove this admin?")) return;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/user?id=${id}`, "DELETE", null, token || "");
          fetchAdmins();
      } catch (e: any) {
          alert("Error removing admin: " + e.message);
      }
  }

  onMount(() => {
      fetchAdmins();
  });
</script>

<div class="p-8 space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-4">
            Admins
            <span class="text-sm font-normal px-3 py-1 bg-green-100 text-green-700 rounded-full border border-green-200">
                {adminState.getAdminCount()} Online
            </span>
        </h1>
        <Button onclick={() => isAddModalOpen = true}>Add New Admin</Button>
    </div>
    
    {#if error}
        <div class="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
    {/if}

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table 
            data={admins} 
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'role', label: 'Role' },
                { key: 'phone', label: 'Phone' },
                { key: 'actions', label: 'Actions', render: actionCell }
            ]} 
        />
    </div>
</div>

{#snippet actionCell(row: any)}
    {#if row.role !== 'superadmin'}
        <button onclick={() => handleDeleteAdmin(row.id)} class="text-red-600 hover:text-red-900 font-medium">Remove</button>
    {:else}
        <span class="text-gray-400 italic">Protected</span>
    {/if}
{/snippet}

<Modal isOpen={isAddModalOpen} onClose={() => isAddModalOpen = false} title="Add New Admin">
    <form onsubmit={(e) => { e.preventDefault(); handleAddAdmin(); }} class="space-y-4">
        <Input label="Name" bind:value={newAdmin.name} required />
        <Input label="Password" type="password" bind:value={newAdmin.password} required />
        <Input label="Phone" bind:value={newAdmin.phone} />
        
        <!-- Role is hidden/fixed to 'admin' -->
        <input type="hidden" name="role" value="admin" />

        <div class="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onclick={() => isAddModalOpen = false}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Admin'}</Button>
        </div>
    </form>
</Modal>
