<script lang="ts">
    import type { Snippet } from "svelte";
    import "./login.css";
    import type { User } from "../../models/user";

    interface LoginPageProps {
        left_title: Snippet | string;
        left_description: string;
        left_grid_items: {
            h2: string;
            p: string;
        }[];
        right_title: string;
        right_subtitle: string;
        on_submit: (user: User) => void;
    }

    const {
        left_title,
        left_description,
        left_grid_items,
        right_title,
        right_subtitle,
        on_submit,
    }: LoginPageProps = $props();

    let user = $state<User>({
        name: "",
        role: "member",
        year: 1,
        branch: "",
        college: "",
        phone: "",
    });

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        on_submit(user);
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

            <form onsubmit={handleSubmit}>
                <div class="input-group">
                    <label for="name">UNIT COMMANDER (NAME)</label>
                    <div class="input-wrapper">
                        <input
                            type="text"
                            name="name"
                            placeholder="Execute Name..."
                            bind:value={user.name}
                            required
                        />
                    </div>
                </div>

                <div class="input-group">
                    <label for="college">AFFILIATION (COLLEGE)</label>
                    <div class="input-wrapper">
                        <input
                            type="text"
                            name="college"
                            placeholder="Origin Node..."
                            bind:value={user.college}
                            required
                        />
                    </div>
                </div>

                <div class="input-group">
                    <label for="year">OPERATIONAL LEVEL (YEAR)</label>
                    <div class="input-wrapper">
                        <select name="year" bind:value={user.year} required>
                            <option value="" disabled selected
                                >Select Level...</option
                            >
                            <option value="1">Level 1 (First Year)</option>
                            <option value="2">Level 2 (Second Year)</option>
                            <option value="3">Level 3 (Third Year)</option>
                            <option value="4">Level 4 (Fourth Year)</option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label for="branch">SPECIALIZATION (BRANCH)</label>
                    <div class="input-wrapper">
                        <input
                            type="text"
                            name="branch"
                            bind:value={user.branch}
                            placeholder="CSE / ECE / IT..."
                            required
                        />
                    </div>
                </div>

                <div class="input-group">
                    <label for="phone">COMM-LINK (PHONE)</label>
                    <div class="input-wrapper">
                        <input
                            type="tel"
                            name="phone"
                            bind:value={user.phone}
                            placeholder="9876543210"
                            pattern="[0-9]*"
                            minlength="10"
                            maxlength="10"
                            required
                        />
                    </div>
                </div>

                <button type="submit" class="btn-primary">INITIALIZE</button>
            </form>
        </div>
    </div>
</div>
