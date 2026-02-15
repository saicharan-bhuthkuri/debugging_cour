<script lang="ts">
    import LoginPage from "$lib/login/login_page.svelte";
    import { setToken } from "$lib/login/login_state.svelte";
    import { api } from "$lib/api";
    import * as ws from "$lib/ws.svelte";

    let error = $state("");
    let examType = $state("debug");
    
    // System State Management
    let systemStatus = $state("ONLINE");
    let assignedUser = $state<string | null>(null);
    let currentSystemCode = $state("");

    // Listen to WS messages
    $effect(() => {
        // ws.state.connected is reactive
        if (ws.state.connected) {
             const unsubscribe = ws.subscribe((msg: any) => {
                 if ((msg.type === "update" || msg.type === "system_online") && msg.data) {
                     const sys = msg.data;
                     
                     // Filter updates for current system if we have a code
                     if (currentSystemCode && sys.code !== currentSystemCode) return;

                     const status = sys.status ? sys.status.toLowerCase() : 'online';
                     
                     if (status === 'booked' || status === 'exam') systemStatus = 'BOOKED';
                     else if (status === 'offline') systemStatus = 'OFFLINE';
                     else systemStatus = 'ONLINE';

                     assignedUser = sys.assigned_to_name || null;
                     
                     if (sys.exam_type) examType = sys.exam_type;
                 } else if (msg.type === "unregistered") {
                     // System deleted, refresh or reset
                     location.reload();
                 }
             });
             return unsubscribe;
        }
    });

    async function checkSystem(code: string) {
        try {
            currentSystemCode = code;
            // Check & Auto Register
            const res = await api("/system/check", "POST", { code });
            if (res) {
                examType = res.exam_type || "debug";
                const status = res.status ? res.status.toLowerCase() : 'online';
                
                if (status === 'booked' || status === 'exam') systemStatus = 'BOOKED';
                else if (status === 'offline') systemStatus = 'OFFLINE';
                else systemStatus = 'ONLINE';
                assignedUser = res.assigned_to_name || null;

                // Perform Initial "System Claim" Login (No OTP)
                const token = await api("/login", "POST", { systemNumber: code });
                if (token) {
                    setToken(token); // Store token
                    ws.connect(token); // Connect WS immediately
                    
                    // Optimistically set status to ONLINE as we are now active
                    if (systemStatus === 'OFFLINE') systemStatus = 'ONLINE';
                }
                
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function onSubmit(data: { systemNumber: string; otp: string }) {
        try {
            console.log("Exam Entry Attempt:", data);
            
            // Verify OTP for exam entry
            const res = await api("/system/verify", "POST", { otp: data.otp }, localStorage.getItem("login_token") || "");
            
            if (res === "Verified") {
                // Determine next step
                // Start Exam UI or Redirect
                alert("Exam Sequence Initiated!"); 
                // Navigate to Exam Page or switch view
                // goto("/exam"); 
            } else {
                 error = "Verification failed";
            }
        } catch (e: any) {
            console.log("failed verify", e);
            error = e.message || "Verification failed";
        }
    }

    function close_error() {
        error = "";
    }

    let uiProps = $derived(examType === 'typing' ? {
        description: "Initiate typing sequence. Measure words per minute, accuracy, and consistency within the designated time window.",
        grid: [
            { h2: "60s", p: "Time Limit" },
            { h2: "Inf", p: "WPM Target" },
            { h2: "Accuracy", p: "Core Focus" },
            { h2: "Solo", p: "Unit Type" }
        ],
        right_title: "Start Test",
        right_subtitle: "Begin with typing the otp"
    } : {
        description: "Initiate coding sequence. Analyze logic, debug errors, and accurately type working solutions within the given time window.",
        grid: [
            { h2: "15:00", p: "Time Limit" },
            { h2: "Debug + Type", p: "Task Mode" },
            { h2: "Logic & Speed", p: "Core Focus" },
            { h2: "Solo/Team", p: "Unit Type" }
        ],
        right_title: "Access Terminal",
        right_subtitle: "Enter credentials to begin simulation"
    });
</script>

{#snippet title()}
    {#if examType === 'typing'}
        <h1>Typing <br /> Master</h1>
    {:else}
        <h1>Debug <br /> Protocol</h1>
    {/if}
{/snippet}

{#if error !== ""}
    <div class="full-screen">
        <div class="dialog">
            <h2>Error:</h2>
            <span style="flex: 1">
                {error}
            </span>
            <button onclick={close_error}>Close</button>
        </div>
    </div>
{/if}

<LoginPage
    left_title={title}
    left_description={uiProps.description}
    left_grid_items={uiProps.grid}
    right_title={uiProps.right_title}
    right_subtitle={uiProps.right_subtitle}
    on_submit={onSubmit}
    on_check_system={checkSystem}
    system_status={systemStatus as "ONLINE" | "OFFLINE" | "BOOKED"}
    assigned_user={assignedUser}
    exam_type={examType}
/>

<style>
    .full-screen {
        position: fixed;
        width: 100%;
        height: 100dvh;
        background: rgba(0, 0, 0, 0.4);
        display: grid;
        place-items: center;
        z-index: 100;
        backdrop-filter: blur(4px);
    }
    .full-screen .dialog {
        background: rgba(15, 19, 29, 0.95);
        padding: 2rem;
        border-radius: 1rem;
        height: auto;
        min-height: 200px;
        width: clamp(300px, 40vw, 600px);
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 50px rgba(0,0,0,0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        gap: 1rem;
    }
    .full-screen .dialog h2 {
        margin: 0;
        color: #ff4d4d;
        font-family: "JetBrains Mono", monospace;
        font-size: 1.5rem;
    }
    .full-screen .dialog span {
        font-size: 1.2rem;
        color: #e2e8f0 !important;
        line-height: 1.5;
    }
    .full-screen .dialog button {
        padding: 0.8rem;
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.5rem;
        font-family: "JetBrains Mono", monospace;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.2s;
        margin-top: auto;
    }
    .full-screen .dialog button:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
    }
</style>
