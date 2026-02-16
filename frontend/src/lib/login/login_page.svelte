<script lang="ts">
    import type { Snippet } from "svelte";
    import { fly } from "svelte/transition";
    import "./login.css";

    interface LoginPageProps {
        left_title: Snippet | string;
        left_description: string;
        left_grid_items: { h2: string; p: string; }[];
        right_title: string;
        right_subtitle: string;
        on_submit: (data: { systemNumber: string; otp: string }) => void;
        on_check_system?: (systemNumber: string) => Promise<boolean>;
        system_status?: "ONLINE" | "OFFLINE" | "BOOKED";
        assigned_user?: string | null;
        exam_type?: string;
        systemNumber?: string;
        on_logout?: () => void;
    }

    const {
        left_title,
        left_description,
        left_grid_items,
        right_title,
        right_subtitle,
        on_submit,
        on_check_system,
        system_status = "ONLINE",
        assigned_user = null,
        exam_type = "debug",
        systemNumber: initialSystemNumber = "",
        on_logout
    }: LoginPageProps = $props();

    let step = $state(initialSystemNumber ? 2 : 1);
    let systemNumber = $state(initialSystemNumber);
    let otp = $state("");

    $effect(() => {
        if (initialSystemNumber && step === 1) {
             systemNumber = initialSystemNumber;
             step = 2;
        }
    });

    // Mocked data for Step 2
    let teamName = $derived(assigned_user || "WAITING FOR ASSIGNMENT...");
    
    // Status Options: ONLINE, OFFLINE, BOOKED
    let systemStatus = $derived(system_status); 
    let errorMessage = $state("");

    // Initialize state if prop changes? 
    // Actually, we want persistence. If parent passes updated prop, we might want to respect it?
    // But for now initial load is key.
    
    async function handleStep1Submit(e: SubmitEvent) {
        e.preventDefault();
        if (systemNumber.trim()) {
            if (on_check_system) {
                try {
                    const isValid = await on_check_system(systemNumber);
                    if (!isValid) {
                         return;
                    }
                    step = 2; // Only proceed if valid
                    errorMessage = ""; 
                } catch (e: any) {
                    return;
                }
            } else {
                 step = 2;
            }
        }
    }

    function handleFinalSubmit(e: SubmitEvent) {
        e.preventDefault();
        errorMessage = ""; // Reset error
        
        // Validation delegated to parent via on_submit
        if (!otp.trim()) {
             errorMessage = "OTP Required";
             return;
        }
        
        on_submit({ systemNumber, otp });
    }

    function getStatusClass(status: string) {
        switch (status) {
            case "ONLINE": return "status-online";
            case "OFFLINE": return "status-offline";
            case "BOOKED": return "status-booked";
            default: return "status-active";
        }
    }

    function getExamTypeText(type: string) {
        return type === 'typing' ? 'TYPING MASTER' : 'DEBUG PROTOCOL';
    }
</script>

<div class="login_body">
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>

    <div class="container">
        <div class="info-panel">
            <div class="code-deco deco-1"></div>
            <div class="info-content">
                <span class="badge">v2.0.26 System Active</span>
                {#if typeof left_title === "string"}
                    <h1>{left_title}</h1>
                {:else}
                    {@render left_title()}
                {/if}
                <p class="hero-desc">
                    {left_description}
                </p>

                <div class="stats-grid">
                    {#each left_grid_items as { h2, p }}
                        <div class="stat-item">
                            <h3>{h2}</h3>
                            <p>{p}</p>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Login Form Side -->
        <div class="form-panel relative">
            {#if step === 2 && on_logout}
                <button 
                    onclick={on_logout}
                    type="button"
                    class="absolute top-6 right-6 text-white/40 hover:text-red-500 transition-colors cursor-pointer z-50 p-2 rounded-full hover:bg-white/5"
                    title="Disconnect System"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
            {/if}

            <div class="form-header">
                <h2>{right_title}</h2>
                <p>{right_subtitle}</p>
            </div>

            {#if step === 1}
                <!-- STEP 1: Enter System Number -->
                <form onsubmit={handleStep1Submit} class="step-form">
                    <div class="input-group">
                        <label for="systemNumber">SYSTEM NUMBER</label>
                        <div class="input-wrapper">
                            <input
                                type="text"
                                name="systemNumber"
                                placeholder="Enter System Number (e.g., SYS-001)"
                                bind:value={systemNumber}
                                required
                                autocomplete="off"
                            />
                        </div>
                    </div>


                    <button type="submit" class="btn-primary">NEXT >></button>
                </form>
            {:else}
                <!-- STEP 2: Verify & OTP (Or Waiting Screen) -->
                <div class="step-2-display">
                    
                    {#if systemStatus === 'BOOKED' || (systemStatus as any) === 'booked'}
                        <div class="system-id-display">
                            <span class="label">SYSTEM ID</span>
                            <h1 class="glitch-text">{systemNumber}</h1>
                        </div>

                        <div class="status-row">
                            <div class="status-item">
                                <span class="label">ASSIGNMENT</span>
                                <p class="value">{assigned_user || "—"}</p>
                            </div>
                            <div class="status-item">
                                <span class="label">PROTOCOL</span>
                                <p class="value text-white">{getExamTypeText(exam_type)}</p>
                            </div>
                        </div>

                        <form onsubmit={handleFinalSubmit} class="step-form">
                            <div class="input-group">
                                <label for="otp">ONE-TIME PASSWORD (OTP)</label>
                                <div class="input-wrapper">
                                    <input
                                        type="password"
                                        name="otp"
                                        placeholder="Enter OTP..."
                                        bind:value={otp}
                                        required
                                        autocomplete="off"
                                    />
                                </div>
                                {#if errorMessage}
                                    <span class="error-message">{errorMessage}</span>
                                {/if}
                            </div>

                            <button type="submit" class="btn-primary"
                                >INITIALIZE SEQUENCE</button
                            >
                        </form>
                    {:else}
                         <!-- Waiting State - Simplified -->
                         <div class="flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in zoom-in duration-500">
                             <div class="text-center space-y-2">
                                 <span class="text-blue-400/60 font-mono text-sm tracking-[0.3em] uppercase block">System Active</span>
                                 <h1 class="glitch-text text-7xl! md:text-8xl! mb-2! drop-shadow-[0_0_35px_rgba(0,243,255,0.4)]">{systemNumber}</h1>
                                 <div class="h-1 w-32 bg-cyan-500/30 mx-auto rounded-full mt-6 overflow-hidden relative">
                                       <div class="absolute inset-0 bg-cyan-400 w-1/2 animate-[scan_1.5s_ease-in-out_infinite]"></div>
                                 </div>
                             </div>

                            <div class="status-row justify-center! gap-12 mt-8">
                                <div class="status-item text-center">
                                    <span class="label block mb-2">OPERATOR</span>
                                    {#key assigned_user}
                                        <p class="value text-xl" in:fly={{ y: 20, duration: 300 }}>{assigned_user || "WAITING..."}</p>
                                    {/key}
                                </div>
                                <div class="status-item text-center">
                                    <span class="label block mb-2">STATUS</span>
                                    {#key systemStatus}
                                        <p class="value {getStatusClass(systemStatus)} text-xl" in:fly={{ y: 20, duration: 300 }}>{systemStatus}</p>
                                    {/key}
                                </div>
                            </div>
                         </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
