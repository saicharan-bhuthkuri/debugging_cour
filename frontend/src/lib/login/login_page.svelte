<script lang="ts">
    import type { Snippet } from "svelte";
    import "./login.css";

    interface LoginPageProps {
        left_title: Snippet | string;
        left_description: string;
        left_grid_items: {
            h2: string;
            p: string;
        }[];
        right_title: string;
        right_subtitle: string;
        on_submit: (data: { systemNumber: string; otp: string }) => void;
    }

    const {
        left_title,
        left_description,
        left_grid_items,
        right_title,
        right_subtitle,
        on_submit,
    }: LoginPageProps = $props();

    let step = $state(1);
    let systemNumber = $state("");
    let otp = $state("");

    // Mocked data for Step 2
    let teamName = $state("Team Alpha");
    let systemStatus = $state("SYSTEM ACTIVE");

    function handleStep1Submit(e: SubmitEvent) {
        e.preventDefault();
        if (systemNumber.trim()) {
            step = 2;
        }
    }

    function handleFinalSubmit(e: SubmitEvent) {
        e.preventDefault();
        on_submit({ systemNumber, otp });
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
        <div class="form-panel">
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
                <!-- STEP 2: Verify & OTP -->
                <div class="step-2-display">
                    <div class="system-id-display">
                        <span class="label">SYSTEM ID</span>
                        <h1 class="glitch-text">{systemNumber}</h1>
                    </div>

                    <div class="status-row">
                        <div class="status-item">
                            <span class="label">TEAM DESIGNATION</span>
                            <p class="value">{teamName}</p>
                        </div>
                        <div class="status-item">
                            <span class="label">STATUS</span>
                            <p class="value status-active">{systemStatus}</p>
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
                        </div>

                        <button type="submit" class="btn-primary"
                            >INITIALIZE SEQUENCE</button
                        >
                    </form>
                </div>
            {/if}
        </div>
    </div>
</div>
