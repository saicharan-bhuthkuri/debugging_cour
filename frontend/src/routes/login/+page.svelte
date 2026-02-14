<script lang="ts">
    import LoginPage from "$lib/login/login_page.svelte";
    import { setToken } from "$lib/login/login_state.svelte";
    import type { User } from "../../models/user";

    var error = $state("");

    async function onSubmit(user: User) {
        try {
            const res = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user }),
            });
            const text = await res.text();
            if (!res.ok) {
                error = text;
            } else {
                setToken(text);
            }
        } catch (e) {
            console.log("failed login");
        }
    }

    function close_error() {
        error = "";
    }
</script>

{#snippet title()}
    <h1>Debug <br /> Protocol</h1>
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
    left_description="Initiate debugging sequence. Analyze logic streams, identify syntax anomalies, and optimize runtime performance parameters within the designated time window."
    left_grid_items={[
        { h2: "15:00", p: "Time Limit" },
        { h2: "∞", p: "Possibilities" },
        { h2: "Logic", p: "Core Focus" },
        { h2: "Solo/Team", p: "Unit Type" },
    ]}
    right_title="Access Terminal"
    right_subtitle="Enter credentials to begin simulation"
    on_submit={onSubmit}
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
        background: rgba(15, 19, 29, 0.9);
        padding: 1rem;
        border-radius: 0.8rem;
        height: clamp(20dvh, 30dvh, 40dvh);
        width: clamp(20dvw, 30dvw, 40dvw);
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 90px black;
        border: 2px solid var(--border);
    }
    .full-screen .dialog button {
        padding: 0.5rem 0.6rem;
        width: 100%;
        background: rgba(0, 243, 255, 0.05);
        color: var(--primary);
        border: 1px solid rgba(0, 243, 255, 0.3);
        border-radius: 10px;
        font-family: "JetBrains Mono", monospace;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-top: 0.5rem;
    }
    .full-screen .dialog span {
        font-size: 1.3rem;
    }
</style>
