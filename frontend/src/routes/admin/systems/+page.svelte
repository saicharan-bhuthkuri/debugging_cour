<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import Button from "$lib/components/admin/Button.svelte";
  import Modal from "$lib/components/admin/Modal.svelte";
  import Table from "$lib/components/admin/Table.svelte";
  import Input from "$lib/components/admin/Input.svelte";
  import CreatableSelect from "$lib/components/admin/CreatableSelect.svelte";
  import { fly } from "svelte/transition";
  import * as adminState from "$lib/admin_state.svelte";
  import * as ws from "$lib/ws.svelte";

  let systems = $derived(adminState.getSystems());
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
  let selectedExamType = $state("debug");
  let debugLevels = $state<any[]>([]);
  let typingLevels = $state<any[]>([]);
  let selectedLevelId = $state<number | null>(null);


  // Derived users for dropdown
  let filteredUserOptions = $derived(
      users.filter(u => {
          const matchesCollege = !modalCollegeFilter || u.college === modalCollegeFilter;
          const matchesBranch = !modalBranchFilter || u.branch === modalBranchFilter;
          return matchesCollege && matchesBranch && u.role !== 'admin'; // Usually admins don't get systems assigned? Optional.
      }).map(u => `[#${u.id}] ${u.name} - ${u.branch}, ${u.year}Yr`)
  );

  // System Detail View State
  let selectedSystemId = $state<number | null>(null);
  let selectedSystem = $derived(
      selectedSystemId ? systems.find(s => s.id === selectedSystemId) : null
  );
  let isOtpVisible = $state(false);
  let isBulkManageMode = $state(false); // Mode for managing all selected systems at once
  let lastGeneratedBulkOtp = $state<string | null>(null);

  // Delete State
  let isDeleteModalOpen = $state(false);
  let systemToDelete = $state<any>(null);
  let forceDelete = $state(false);
  
  // Bulk Actions State
  let selectedIdsList = $state<number[]>([]);
  let selectedIdSet = $derived(new Set(selectedIdsList));
  let bulkData = $state({
      status: "", // empty means no change
      exam_type: "debug",
      assigned_level_id: null as number | null,
      generate_otp: false
  });

  // Exam Start Confirmation
  let isExamConfirmOpen = $state(false);
  let examConfirmCountdown = $state(0);
  let pendingStatusChange = $state<{system?: any, status: string, isBulk: boolean} | null>(null);
  let confirmTimer: any;
  let showSuccess = $state(false);

  function startExamConfirm(data: {system?: any, status: string, isBulk: boolean}) {
      pendingStatusChange = data;
      isExamConfirmOpen = true;
      examConfirmCountdown = 5;
      if (confirmTimer) clearInterval(confirmTimer);
      confirmTimer = setInterval(() => {
          examConfirmCountdown--;
          if (examConfirmCountdown <= 0) clearInterval(confirmTimer);
      }, 1000);
  }

  async function finalConfirmStatusChange() {
      if (!pendingStatusChange || examConfirmCountdown > 0) return;
      
      const { system, status, isBulk } = pendingStatusChange;
      isExamConfirmOpen = false;
      
      if (isBulk) {
          handleBulkUpdate({ status });
      } else {
          if (system) await executeStatusChange(system, status);
      }
      pendingStatusChange = null;
  }

  async function executeStatusChange(system: any, status: string) {
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${system.id}`, "PUT", { status }, token || "");
          await fetchSystems();
      } catch (e: any) {
          alert(`Error updating status: ${e.message}`);
      }
  }

  // Derived state for filtered systems
  let filteredSystems = $derived(systems.filter(system => {
    const matchesSearch = system.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (system.assigned_to_name && system.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || system.status === statusFilter;
    return matchesSearch && matchesStatus;
  }));

  function toggleAllSelection() {
      const selectableSystems = filteredSystems.filter(s => s.status !== 'exam');
      const allSelected = selectableSystems.length > 0 && selectableSystems.every(s => selectedIdSet.has(s.id));
      if (allSelected) {
          const removeSet = new Set(selectableSystems.map(s => s.id));
          selectedIdsList = selectedIdsList.filter(id => !removeSet.has(id));
      } else {
          const current = new Set(selectedIdsList);
          selectableSystems.forEach(s => current.add(s.id));
          selectedIdsList = [...current];
      }
  }

  function openBulkManage() {
      if (selectedIdsList.length === 0) return;
      isBulkManageMode = true;
      selectedSystemId = null; 
      isOtpVisible = false;
      lastGeneratedBulkOtp = null;
      // Reset bulk data for fresh start
      bulkData = {
          status: "",
          exam_type: "debug",
          assigned_level_id: null,
          generate_otp: false
      };
  }

  function closeDetailView() {
      isBulkManageMode = false;
      selectedSystemId = null;
      lastGeneratedBulkOtp = null;
  }

  function toggleSelection(id: number) {
      if (selectedIdSet.has(id)) {
          selectedIdsList = selectedIdsList.filter(x => x !== id);
      } else {
          selectedIdsList = [...selectedIdsList, id];
      }
  }

  async function handleBulkUpdate(dataInput?: any) {
      if (selectedIdsList.length === 0) return;
      
      const data = dataInput || bulkData;
      
      // If setting status to 'exam', we need confirm unless already confirmed
      if (data.status === 'exam' && (!pendingStatusChange || !pendingStatusChange.isBulk)) {
          startExamConfirm({ status: 'exam', isBulk: true });
          return;
      }

      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          
          const payload = {
              ids: [...selectedIdsList],
              data: {
                  status: data.status || null,
                  exam_type: data.exam_type || null,
                  assigned_level_id: data.assigned_level_id || null,
                  generate_otp: data.generate_otp || false,
                  reset: data.reset || false
              }
          };

          const res = await api("/system/bulk", "POST", payload, token || "");
          
          if (res && res.otp) {
              lastGeneratedBulkOtp = res.otp;
              isOtpVisible = true;
          }

          // Only close if we didn't just generate an OTP and NOT in bulk mode
          if (!isBulkManageMode && (!res || !res.otp)) {
              closeDetailView();
          }
          
          await fetchSystems();
      } catch (e: any) {
          alert("Bulk update failed: " + e.message);
      } finally {
          isSubmitting = false;
          showSuccess = true;
          setTimeout(() => showSuccess = false, 2000);
      }
  }
    
  // Status Colors Helper
  const statusColors: any = {
      offline: "bg-gray-100 text-gray-600 border-gray-200",
      online: "bg-green-100 text-green-700 border-green-200",
      booked: "bg-yellow-100 text-yellow-700 border-yellow-200",
      exam: "bg-purple-100 text-purple-700 border-purple-200",
      completed: "bg-blue-100 text-blue-700 border-blue-200"
  };

  async function fetchSystems() {
      loading = true;
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          
          const res = await api("/system", "GET", null, token);
          if (Array.isArray(res)) {
            adminState.setSystems(res);
          } else if (res.systems) {
            adminState.setSystems(res.systems);
          } else {
            adminState.setSystems([]);
          }
      } catch (e: any) {
          error = e.message;
          // Mock data for UI development if API fails
          if (adminState.getSystems().length === 0) {
             adminState.setSystems([
                 { id: 1, code: "SYS-001", status: "offline", assigned_to: null, login_otp: null },
                 { id: 2, code: "SYS-002", status: "online", assigned_to: 101, assigned_to_name: "John Doe", login_otp: "12345" },
                 { id: 3, code: "SYS-003", status: "booked", assigned_to: 102, assigned_to_name: "Jane Smith", login_otp: "54321" },
             ]);
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

  async function fetchDebugLevels() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/debug/level", "GET", null, token);
          if (Array.isArray(res)) debugLevels = res;
          else if (res.levels) debugLevels = res.levels;
          else debugLevels = [];
      } catch (e) {
          console.error("Failed to fetch debug levels", e);
      }
  }

  async function fetchTypingLevels() {
      try {
          const token = localStorage.getItem("login_token");
          if (!token) return;
          const res = await api("/typing/level", "GET", null, token);
          if (Array.isArray(res)) typingLevels = res;
          else if (res.levels) typingLevels = res.levels;
          else typingLevels = [];
      } catch (e) {
          console.error("Failed to fetch typing levels", e);
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
              status: 'booked',
              exam_type: selectedExamType,
              assigned_level_id: selectedLevelId,
          }, token || "");
          
          isAssignModalOpen = false;
          
          // Refresh list and if viewing this system details, refresh that too
          await fetchSystems();
          // Refresh list
          await fetchSystems();
          // No need to manually update selectedSystem as it is derived from systems list
      } catch (e: any) {
          alert(`Error assigning system: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
  }

   async function handleStatusChange(system: any, newStatus: string) {
       if (isBulkManageMode) {
           bulkData.status = newStatus;
           handleBulkUpdate({ status: newStatus });
           return;
       }
       if (newStatus === 'exam') {
           startExamConfirm({ system, status: 'exam', isBulk: false });
           return;
       }
       await executeStatusChange(system, newStatus);
   }

  async function handleTypeChange(system: any, newType: string) {
      if (isBulkManageMode) {
          bulkData.exam_type = newType;
          handleBulkUpdate({ exam_type: newType });
          return;
      }
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${system.id}`, "PUT", { exam_type: newType }, token || "");
          await fetchSystems();
      } catch (e: any) {
          alert(`Error updating exam type: ${e.message}`);
      }
  }

  async function handleLevelChange(system: any, newLevelId: number) {
      if (isBulkManageMode) {
          bulkData.assigned_level_id = newLevelId;
          handleBulkUpdate({ assigned_level_id: newLevelId });
          return;
      }
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${system.id}`, "PUT", { assigned_level_id: newLevelId }, token || "");
          await fetchSystems();
      } catch (e: any) {
          alert(`Error updating level: ${e.message}`);
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
      selectedExamType = system.exam_type || "debug";
      if (selectedExamType === 'debug') {
          selectedLevelId = system.assigned_level_id || (debugLevels.length > 0 ? debugLevels[0].id : null);
      } else {
          selectedLevelId = system.assigned_level_id || (typingLevels.length > 0 ? typingLevels[0].id : null);
      }
      isAssignModalOpen = true;
  }

  async function handleGenerateOTP(system: any) {
      if (!confirm(`Generate new OTP for ${isBulkManageMode ? selectedIdsList.length + ' systems' : 'this system'}?`)) return;
      if (isBulkManageMode) {
          handleBulkUpdate({ generate_otp: true });
          return;
      }
      try {
          const token = localStorage.getItem("login_token");
          const otp = Math.floor(10000 + Math.random() * 90000).toString();
          await api(`/system?id=${system.id}`, "PUT", { login_otp: otp }, token || "");
          await fetchSystems();
          // Details update automatically via derived state

      } catch (e: any) {
          alert(`Error generating OTP: ${e.message}`);
      }
  }

  async function handleResetSystem(system: any) {
      if (!isBulkManageMode && system.status === 'exam') {
          alert("Cannot reset system while an exam is in progress.");
          return;
      }
      if (!confirm(`Are you sure you want to RESET ${isBulkManageMode ? selectedIdsList.length + ' systems' : 'this system'}? This will clear the assigned user, OTP and restore it to online/offline state.`)) return;
      
      if (isBulkManageMode) {
          // Resetting in bulk now uses the 'reset' flag in bulkUpdateSystems
          handleBulkUpdate({ status: 'online', reset: true });
          return;
      }

      try {
          const token = localStorage.getItem("login_token");
          await api("/system/reset", "POST", { id: system.id }, token || "");
          await fetchSystems();
      } catch (e: any) {
          alert(`Error resetting system: ${e.message}`);
      }
  }

  async function handleDeleteSystem() {
      if (!systemToDelete) return;
      isSubmitting = true;
      try {
          const token = localStorage.getItem("login_token");
          await api(`/system?id=${systemToDelete.id}&force=${forceDelete}`, "DELETE", null, token || "");
          
          isDeleteModalOpen = false;
          systemToDelete = null;
          forceDelete = false;
          
          if (selectedSystemId === systemToDelete?.id) {
              selectedSystemId = null;
          }
          await fetchSystems();
      } catch (e: any) {
          if (e.message && e.message.includes("exam is in progress")) {
             if (confirm("Exam is in progress! Do you want to FORCE delete?")) {
                 forceDelete = true;
                 // Retry immediately? Or let user click button again with force checked.
                 // Let's just enable the force checkbox in UI or retry recursively? 
                 // Recursive might be dangerous. Let's just alert and let user check "Force" checkbox which we will add.
             }
          }
          alert(`Error deleting system: ${e.message}`);
      } finally {
          isSubmitting = false;
      }
      await fetchSystems();
  }

  function confirmDelete(system: any) {
      systemToDelete = system;
      isDeleteModalOpen = true;
  }
    
  function openSystemDetail(system: any) {
      isBulkManageMode = false;
      selectedSystemId = system.id;
      isOtpVisible = false; // Reset visibility when opening details
  }

  onMount(() => {
      fetchSystems();
      fetchUsers();
      fetchUniqueFields();
      fetchDebugLevels();
      fetchTypingLevels();
  });

</script>

{#snippet selectionHeader()}
    <input 
        type="checkbox" 
        class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        checked={filteredSystems.filter(s => s.status !== 'exam').length > 0 && filteredSystems.filter(s => s.status !== 'exam').every(s => selectedIdSet.has(s.id))}
        onclick={toggleAllSelection}
        title="Select all (excludes exam systems)"
    />
{/snippet}

{#snippet selectionCell(row: any)}
    <input 
        type="checkbox" 
        class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        checked={selectedIdSet.has(row.id)}
        onclick={(e) => { e.stopPropagation(); toggleSelection(row.id); }}
        disabled={row.status === 'exam'}
    />
{/snippet}

{#snippet statusCell(row: any)}
  <span class="text-xs px-2 py-1 rounded-full border uppercase tracking-wider font-mono {statusColors[row.status] || 'bg-gray-100'}">
    {row.status}
  </span>
{/snippet}

{#snippet typeCell(row: any)}
  <span class="text-xs px-2 py-1 rounded-full border uppercase tracking-wider font-mono bg-indigo-50 text-indigo-700 border-indigo-200">
    {row.exam_type || 'debug'}
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
        class="py-2! px-4! text-sm font-medium cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all active:scale-95"
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
    {#if selectedSystem || isBulkManageMode}
      <!-- Detail View Overlay (Fills content area, not sidebar) -->
      <div 
        class="fixed inset-0 z-50 md:absolute md:z-10 md:inset-0 bg-gray-50/95 backdrop-blur-sm overflow-y-auto md:rounded-xl"
        transition:fly={{ y: 20, duration: 200 }}
      >
         <!-- Close on background click (handled by parent click) -->
         <div 
            class="min-h-full w-full p-0 md:p-8"
            onclick={(e) => { if(e.target === e.currentTarget) closeDetailView(); }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Escape' && closeDetailView()}
         >
             <div class="max-w-5xl mx-auto bg-white min-h-screen md:min-h-0 md:rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative" onclick={(e) => e.stopPropagation()} role="presentation">

                <!-- Close Button -->
                <button 
                    onclick={closeDetailView}
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
                            <span class="text-sm font-medium text-gray-500 uppercase tracking-widest">{isBulkManageMode ? 'Bulk Management' : 'System Code'}</span>
                            {#if !isBulkManageMode}
                                <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">ID: {selectedSystem?.id}</span>
                            {/if}
                        </div>
                        <h1 class="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            {isBulkManageMode ? `${selectedIdsList.length} Systems Selected` : selectedSystem?.code}
                            {#if isSubmitting}
                                <div class="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            {:else if showSuccess}
                                <div class="text-green-600 text-sm font-bold flex items-center gap-1 animate-bounce">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                    Updated!
                                </div>
                            {/if}
                        </h1>
                    </div>
                    {#if !isBulkManageMode}
                    <div class="flex items-center gap-4">
                        <div class="px-4 py-2 rounded-lg border flex flex-col items-center bg-white shadow-sm {selectedSystem?.status === 'online' ? 'border-green-200 bg-green-50' : selectedSystem?.status === 'booked' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}">
                            <span class="text-xs uppercase font-bold text-gray-500">Status</span>
                            <span class="text-lg font-bold capitalize {selectedSystem?.status === 'online' ? 'text-green-700' : selectedSystem?.status === 'booked' ? 'text-yellow-700' : 'text-gray-700'}">
                                {selectedSystem?.status}
                            </span>
                        </div>
                    </div>
                    {/if}
                </div>

                <!-- Main Content Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                    
                    <!-- Left: User & Login Info -->
                    <div class="p-6 md:p-8 flex flex-col gap-8">
                        {#if !isBulkManageMode}
                        <div>
                            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                                </svg>
                                Assigned User
                            </h3>
                            {#if selectedSystem?.assigned_to_name}
                                <div class="bg-blue-50/80 rounded-xl p-4 border border-blue-200 shadow-xs">
                                    <div class="flex items-start gap-4">
                                        <div class="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
                                            {selectedSystem?.assigned_to_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="text-lg font-bold text-gray-900 truncate">{selectedSystem?.assigned_to_name}</span>
                                                <span class="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                                                    {selectedSystem?.assigned_user_role || 'Candidate'}
                                                </span>
                                            </div>
                                            <div class="text-xs text-blue-700 font-medium mt-0.5">Currently Assigned</div>
                                        </div>
                                    </div>

                                    <!-- Candidate Info Grid -->
                                    <div class="mt-3 pt-3 border-t border-blue-100 grid grid-cols-2 gap-2 text-xs">
                                        <div class="bg-white/80 p-2 rounded-lg border border-blue-100">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College</span>
                                            <span class="font-medium text-gray-800 truncate block">{selectedSystem?.assigned_user_college || '—'}</span>
                                        </div>
                                        <div class="bg-white/80 p-2 rounded-lg border border-blue-100">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Branch & Year</span>
                                            <span class="font-medium text-gray-800 truncate block">
                                                {selectedSystem?.assigned_user_branch || 'General'}
                                                {#if selectedSystem?.assigned_user_year}
                                                    • Yr {selectedSystem.assigned_user_year}
                                                {/if}
                                            </span>
                                        </div>
                                        {#if selectedSystem?.assigned_user_phone}
                                            <div class="bg-white/80 p-2 rounded-lg border border-blue-100 col-span-2">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phone / Candidate ID</span>
                                                <span class="font-mono font-medium text-gray-800">{selectedSystem.assigned_user_phone}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="mt-3 flex gap-2">
                                        <button 
                                            onclick={() => openAssignModal(selectedSystem)}
                                            class="cursor-pointer px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-xs"
                                        >
                                            Change User
                                        </button>
                                    </div>
                                </div>
                            {:else}
                                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100 border-dashed text-center flex flex-col items-center justify-center gap-3">
                                    <div class="text-gray-400 font-medium">No user is currently using this system</div>
                                    <Button onclick={() => openAssignModal(selectedSystem)}>Assign User Now</Button>
                                </div>
                            {/if}
                        </div>
                        {/if}

                        <div>
                            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                                </svg>
                                Login Credentials
                            </h3>
                             {#if isBulkManageMode}
                                 <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center shadow-inner">
                                     <div class="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                         </svg>
                                     </div>
                                     <div class="text-sm text-indigo-900 font-bold mb-1">Bulk OTP Management</div>
                                     <div class="text-xs text-indigo-600 mb-4 font-medium uppercase tracking-tight">Generate a single OTP for all selected systems</div>
                                     
                                     {#if lastGeneratedBulkOtp}
                                        <div class="mb-6 p-4 bg-white rounded-lg border-2 border-indigo-200 shadow-sm">
                                            <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Active Bulk OTP</div>
                                            <div class="text-3xl font-mono font-black text-gray-900 tracking-[0.3em]">
                                                {lastGeneratedBulkOtp}
                                            </div>
                                        </div>
                                     {/if}

                                     <Button onclick={() => handleBulkUpdate({ generate_otp: true })} fullWidth>
                                         <span class="flex items-center gap-2 justify-center">
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                             </svg>
                                             {lastGeneratedBulkOtp ? 'Regenerate OTP' : 'Generate New OTP'}
                                         </span>
                                     </Button>
                                 </div>
                             {:else if selectedSystem?.login_otp}
                                    <div class="relative">
                                        <button 
                                            onclick={() => isOtpVisible = !isOtpVisible}
                                            class="group px-6 py-3 bg-gray-900 rounded-lg text-white font-mono text-2xl tracking-[0.2em] relative overflow-hidden cursor-pointer select-none shadow-lg transform transition-transform hover:scale-105 active:scale-95 w-full md:w-auto"
                                            title={isOtpVisible ? "Hide OTP" : "Show OTP"}
                                        >
                                            <span class="{isOtpVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 font-bold">{selectedSystem?.login_otp}</span>
                                            <span class="absolute inset-0 flex items-center justify-center {isOtpVisible ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200 text-gray-500 font-bold">•••••</span>
                                        </button>

                                    </div>
                            {:else}
                                 <div class="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                     No active OTP. Assign a user via the "Assign" button above.
                                 </div>
                            {/if}
                        </div>

                        <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-6">
                            <div>
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Exam Mode</span>
                                <div class="grid grid-cols-2 gap-3">
                                    {#each ['debug', 'typing'] as type}
                                        <button 
                                            onclick={() => handleTypeChange(selectedSystem, type)}
                                            class="cursor-pointer px-3 py-2.5 text-sm font-semibold rounded-lg transition-all border shadow-sm
                                            {(isBulkManageMode ? bulkData.exam_type === type : selectedSystem?.exam_type === type)
                                                ? 'bg-indigo-900 text-white border-indigo-900 ring-2 ring-offset-2 ring-indigo-900' 
                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}"
                                        >
                                            {type === 'debug' ? 'Debug Protocol' : 'Typing Master'}
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            {#if (isBulkManageMode && bulkData.exam_type === 'debug') || (!isBulkManageMode && (selectedSystem?.exam_type === 'debug' || !selectedSystem?.exam_type))}
                            <div>
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Exam Level (Debug)</span>
                                <div class="space-y-3">
                                    <select 
                                        class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                                        value={!isBulkManageMode ? selectedSystem?.assigned_level_id : bulkData.assigned_level_id}
                                        onchange={(e) => handleLevelChange(selectedSystem, parseInt(e.currentTarget.value))}
                                    >
                                        <option value={null} disabled={!isBulkManageMode}>Select Level</option>
                                        {#each debugLevels.toSorted((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0)) as level}
                                            <option value={level.id}>{level.name}</option>
                                        {/each}
                                    </select>
                                    {#if debugLevels.length === 0}
                                        <p class="text-[10px] text-amber-600 font-medium">No debug levels available.</p>
                                    {/if}
                                </div>
                            </div>
                            {/if}

                            {#if (isBulkManageMode && bulkData.exam_type === 'typing') || (!isBulkManageMode && selectedSystem?.exam_type === 'typing')}
                            <div>
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Exam Level (Typing)</span>
                                <div class="space-y-3">
                                    <select 
                                        class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                                        value={!isBulkManageMode ? selectedSystem?.assigned_level_id : bulkData.assigned_level_id}
                                        onchange={(e) => handleLevelChange(selectedSystem, parseInt(e.currentTarget.value))}
                                    >
                                        <option value={null} disabled={!isBulkManageMode}>Select Level</option>
                                        {#each typingLevels.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)) as level}
                                            <option value={level.id}>{level.name}</option>
                                        {/each}
                                    </select>
                                    {#if typingLevels.length === 0}
                                        <p class="text-[10px] text-amber-600 font-medium">No typing levels available.</p>
                                    {/if}
                                </div>
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
                                    {#if !isBulkManageMode && selectedSystem?.status === 'completed'}
                                        <button 
                                            onclick={() => handleStatusChange(selectedSystem, 'online')}
                                            class="col-span-2 cursor-pointer px-3 py-3 text-sm font-bold rounded-lg transition-all border shadow-sm bg-green-600 text-white border-green-700 hover:bg-green-700 hover:shadow-lg transform active:scale-95"
                                        >
                                            RE-ACTIVATE SYSTEM (Make Online)
                                        </button>
                                    {:else}
                                        {#each ['online', 'booked', 'exam', 'completed'] as status}
                                            <button 
                                                onclick={() => handleStatusChange(selectedSystem, status)}
                                                class="cursor-pointer px-3 py-2.5 text-sm font-semibold rounded-lg transition-all border shadow-sm
                                                {(isBulkManageMode ? bulkData.status === status : selectedSystem?.status === status)
                                                    ? 'bg-gray-900 text-white border-gray-900 ring-2 ring-offset-2 ring-gray-900' 
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}"
                                            >
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </button>
                                        {/each}
                                    {/if}
                                </div>
                            </div>

                            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <span class="text-sm font-bold text-gray-900 uppercase tracking-wider block mb-4">Maintenance</span>
                                <div class="space-y-2">
                                      <button 
                                         onclick={() => handleResetSystem(selectedSystem)} 
                                         disabled={selectedSystem?.status === 'exam'}
                                         class="cursor-pointer w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-3 transition-colors border border-transparent hover:border-amber-100 disabled:opacity-50 disabled:cursor-not-allowed group"
                                     >
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 group-hover:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                         </svg>
                                         Reset System (Clear Assignment)
                                     </button>

                                     <button onclick={() => handleGenerateOTP(selectedSystem)} class="cursor-pointer w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-3 transition-colors border border-transparent hover:border-red-100 group">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                         </svg>
                                         Force Reset OTP
                                     </button>

                                     {#if !isBulkManageMode}
                                     <button onclick={() => confirmDelete(selectedSystem)} class="cursor-pointer w-full text-left px-4 py-3 text-sm font-bold bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 rounded-lg flex items-center gap-3 transition-colors border border-red-200 hover:border-red-300 shadow-sm mt-4">
                                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 group-hover:text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                         </svg>
                                         Delete System
                                     </button>
                                     {/if}
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
          <option value="completed">Completed</option>
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
          { key: 'id' as any, label: '', render: selectionCell, headerRender: selectionHeader },
          { key: 'code', label: 'System Code' },
          { key: 'status', label: 'Status', render: statusCell },
          { key: 'exam_type', label: 'Exam Mode', render: typeCell },
          { key: 'assigned_to_name', label: 'Assigned To', render: assignedToCell },
          { key: 'actions', label: 'Actions', render: actionCell }
        ]} 
      />
    </div>
  {/if}

  <!-- Bulk Actions Floating Bar -->
  {#if selectedIdsList.length > 0}
    <div 
        class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-3 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-500 ease-out backdrop-blur-md"
    >
        <div class="flex items-center gap-3 pl-3 pr-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black font-black text-lg shadow-inner">
                {selectedIdsList.length}
            </div>
            <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 leading-none mb-0.5">Selected</span>
                <span class="text-sm font-extrabold text-white tracking-tight leading-none italic uppercase">Systems</span>
            </div>
        </div>

        <div class="h-10 w-px bg-white/10"></div>

        <div class="flex items-center gap-1.5 pr-1">
            <Button 
                variant="secondary" 
                onclick={openBulkManage} 
                class="rounded-xl! px-5 h-11 flex items-center gap-2.5 bg-white! text-black! border-none! hover:bg-gray-200! transition-all font-bold group"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:rotate-45 transition-transform duration-300">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Manage
            </Button>
            
            <button 
                onclick={() => selectedIdsList = []} 
                class="hover:bg-white/5 p-3 cursor-pointer rounded-xl transition-all group flex items-center justify-center"
                title="Clear Selection"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 group-hover:text-white transition-colors">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
            </button>
        </div>
    </div>
  {/if}

   <Modal 
    isOpen={isExamConfirmOpen} 
    onClose={() => { isExamConfirmOpen = false; pendingStatusChange = null; }} 
    title="URGENT: Start Exam Mode?"
  >
    <div class="space-y-6">
        <div class="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-lg">
            <div class="flex items-center gap-3 mb-2 font-bold text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                CRITICAL WARNING
            </div>
            <p class="text-sm font-medium leading-relaxed">
                You are about to force {pendingStatusChange?.isBulk ? selectedIdsList.length : 'this'} system into <strong>EXAM MODE</strong>. 
                This will bypass the OTP requirement and start the timer <strong>INSTANTLY</strong>.
                The candidate will be logged in automatically and the exam protocol will begin.
            </p>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Target</div>
            <div class="text-xl font-black text-gray-900">
                {#if pendingStatusChange?.isBulk}
                    {selectedIdsList.length} Selected Systems
                {:else if pendingStatusChange?.system}
                    System {pendingStatusChange.system.code}
                {/if}
            </div>
        </div>

        <div class="pt-4 flex flex-col gap-3">
            <button 
                onclick={finalConfirmStatusChange}
                disabled={examConfirmCountdown > 0}
                class="w-full py-4 rounded-xl font-black text-lg transition-all shadow-lg flex items-center justify-center gap-2
                {examConfirmCountdown > 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-b-4 border-gray-300' 
                  : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 border-b-4 border-red-800'}"
            >
                {#if examConfirmCountdown > 0}
                    CONFIRM IN {examConfirmCountdown}s...
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    START EXAM NOW
                {/if}
            </button>
            <button 
                onclick={() => { isExamConfirmOpen = false; pendingStatusChange = null; }}
                class="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
            >
                Cancel and Go Back
            </button>
        </div>
    </div>
  </Modal>

  <!-- Add System Modal -->
  <Modal 
    isOpen={isAddModalOpen} 
    onClose={() => isAddModalOpen = false} 
    title="Register New System"
  >
    <form onsubmit={(e) => { e.preventDefault(); handleAddSystem(); }} class="space-y-4">
      <Input label="System Code" bind:value={newSystem.code} placeholder="SYS-001" required />

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

         <div class="w-full">
             <span class="text-sm font-medium text-gray-700 block mb-1.5">Exam Type</span>
             <select bind:value={selectedExamType} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900">
                 <option value="debug">Debug Protocol (Debugging)</option>
                 <option value="typing">Typing Master (Typing)</option>
             </select>
         </div>

          {#if selectedExamType === 'debug'}
          <div class="w-full">
              <span class="text-sm font-medium text-gray-700 block mb-1.5">Assign Level (Debug) <span class="text-red-500">*</span></span>
              <select bind:value={selectedLevelId} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" required>
                  <option value={null} disabled>Select a level...</option>
                  {#each debugLevels.toSorted((a, b) => (a.order_num || a.order || 0) - (b.order_num || b.order || 0)) as level}
                      <option value={level.id}>{level.name} ({Math.floor((level.duration || 900) / 60)} min, {level.question_ids?.length || 0} questions)</option>
                  {/each}
              </select>
              {#if debugLevels.length === 0}
                  <p class="text-xs text-amber-600 mt-1">No levels found. Create levels in Debug > Levels first.</p>
              {/if}
          </div>
          {:else if selectedExamType === 'typing'}
          <div class="w-full">
              <span class="text-sm font-medium text-gray-700 block mb-1.5">Assign Level (Typing) <span class="text-red-500">*</span></span>
              <select bind:value={selectedLevelId} class="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" required>
                  <option value={null} disabled>Select a level...</option>
                  {#each typingLevels.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)) as level}
                      <option value={level.id}>{level.name} ({level.time_limit}s, {level.passing_accuracy}%)</option>
                  {/each}
              </select>
              {#if typingLevels.length === 0}
                  <p class="text-xs text-amber-600 mt-1">No levels found. Create levels in Typing > Levels first.</p>
              {/if}
          </div>
          {/if}
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
                <div class="mt-4 flex items-center gap-2">
                    <input type="checkbox" id="forceDelete" bind:checked={forceDelete} class="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    <label for="forceDelete" class="text-sm text-gray-700 font-medium select-none">Force Delete (Override Exam Status)</label>
                </div>
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
