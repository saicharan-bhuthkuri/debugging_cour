<script lang="ts">
    import "./login.css";
</script>

<div class="glow-orb orb-1"></div>
<div class="glow-orb orb-2"></div>

<div class="container">
    <div class="info-panel">
        <div class="code-deco deco-1"></div>
        <div class="info-content">
            <span class="badge">v2.0.26 System Active</span>
            <h1>DEBUG<br />PROTOCOL</h1>
            <p class="hero-desc">
                Initiate debugging sequence. Analyze logic streams, identify
                syntax anomalies, and optimize runtime performance parameters
                within the designated time window.
            </p>

            <div class="stats-grid">
                <div class="stat-item">
                    <h3>15:00</h3>
                    <p>Time Limit</p>
                </div>
                <div class="stat-item">
                    <h3>∞</h3>
                    <p>Possibilities</p>
                </div>
                <div class="stat-item">
                    <h3>Logic</h3>
                    <p>Core Focus</p>
                </div>
                <div class="stat-item">
                    <h3>Solo/Team</h3>
                    <p>Unit Type</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Login Form Side -->
    <div class="form-panel">
        <div class="form-header">
            <h2>Access Terminal</h2>
            <p>Enter credentials to begin simulation</p>
        </div>

        <form>
            <div class="input-group">
                <label for="name">UNIT COMMANDER (NAME)</label>
                <div class="input-wrapper">
                    <input
                        type="text"
                        name="name"
                        placeholder="Execute Name..."
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
                        required
                    />
                </div>
            </div>

            <div class="input-group">
                <label for="year">OPERATIONAL LEVEL (YEAR)</label>
                <div class="input-wrapper">
                    <select name="year" required>
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
                        placeholder="9876543210"
                        pattern="[0-9]{10}"
                        maxlength="10"
                        required
                    />
                </div>
            </div>

            <button type="submit" class="btn-primary">INITIALIZE</button>
        </form>
    </div>
</div>
