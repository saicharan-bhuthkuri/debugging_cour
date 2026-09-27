<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";

    // Props
    let {
        examMode = false,         // If true, enables disqualification on tab switch
        enableFullscreen = true,  // Request fullscreen on mount
        enableCopyPaste = true,   // Block copy/paste
        children
    }: {
        examMode?: boolean;
        enableFullscreen?: boolean;
        enableCopyPaste?: boolean;
        children?: any;
    } = $props();

    // Warning state
    let showWarning = $state(false);
    let warningCount = $state(0);
    let warningMessage = $state("");
    let countdown = $state(5);
    let showCountdownOverlay = $state(false);

    let countdownTimer: any = null;
    let isDisqualifying = $state(false);

    // ──── Fullscreen ────
    function requestFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch((err) => {
                console.warn("Fullscreen request failed:", err);
            });
        } else if ((el as any).webkitRequestFullscreen) {
            (el as any).webkitRequestFullscreen();
        } else if ((el as any).msRequestFullscreen) {
            (el as any).msRequestFullscreen();
        }
    }

    function isFullscreen() {
        return !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).msFullscreenElement
        );
    }

    function handleFullscreenChange() {
        if (enableFullscreen && !isFullscreen() && !isDisqualifying) {
            // Re-request fullscreen after a slight delay
            setTimeout(() => {
                if (!isFullscreen()) {
                    requestFullscreen();
                }
            }, 300);
        }
    }

    // ──── Copy/Paste Prevention ────
    function preventCopyPaste(e: Event) {
        if (enableCopyPaste) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    function preventCopyPasteKeys(e: KeyboardEvent) {
        if (!enableCopyPaste) return;

        // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A (select all for copy)
        if (e.ctrlKey || e.metaKey) {
            if (['c', 'v', 'x'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }

        // Block PrintScreen
        if (e.key === 'PrintScreen') {
            e.preventDefault();
            return false;
        }
    }

    // ──── Tab Switch / Visibility Detection ────
    function handleVisibilityChange() {
        if (!examMode) return;

        if (document.hidden) {
            // User left the tab — start countdown
            startDisqualifyCountdown();
        } else {
            // User came back
            if (countdownTimer) {
                clearDisqualifyCountdown();
                warningCount++;
                warningMessage = `⚠️ Warning #${warningCount}: You switched away from the exam tab! Do NOT leave this tab again or you will be disqualified.`;
                showWarning = true;

                // Log the tab switch
                try {
                    const token = localStorage.getItem("login_token") || "";
                    const sessionId = localStorage.getItem("exam_session_id") || "0";
                    api("/system/log", "POST", {
                        session_id: parseInt(sessionId),
                        type: "TAB_SWITCH_WARNING",
                        data: {
                            timestamp: new Date().toISOString(),
                            warning_number: warningCount,
                            msg: `User switched tabs and returned (warning #${warningCount})`
                        }
                    }, token);
                } catch (e) {
                    console.error("Failed to log tab switch", e);
                }
            }
        }
    }

    function handleWindowBlur() {
        if (!examMode) return;
        // Window lost focus (alt-tab, clicking outside browser, etc.)
        if (!document.hidden) {
            startDisqualifyCountdown();
        }
    }

    function handleWindowFocus() {
        if (!examMode) return;
        if (countdownTimer && !document.hidden) {
            clearDisqualifyCountdown();
            warningCount++;
            warningMessage = `⚠️ Warning #${warningCount}: You shifted focus away from the exam window! Stay on this tab to avoid disqualification.`;
            showWarning = true;

            try {
                const token = localStorage.getItem("login_token") || "";
                const sessionId = localStorage.getItem("exam_session_id") || "0";
                api("/system/log", "POST", {
                    session_id: parseInt(sessionId),
                    type: "WINDOW_BLUR_WARNING",
                    data: {
                        timestamp: new Date().toISOString(),
                        warning_number: warningCount,
                        msg: `User lost window focus and returned (warning #${warningCount})`
                    }
                }, token);
            } catch (e) {
                console.error("Failed to log blur", e);
            }
        }
    }

    function startDisqualifyCountdown() {
        if (countdownTimer || isDisqualifying) return;

        countdown = 10;
        showCountdownOverlay = true;

        countdownTimer = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                disqualify();
            }
        }, 1000);
    }

    function clearDisqualifyCountdown() {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        showCountdownOverlay = false;
        countdown = 10;
    }

    async function disqualify() {
        if (isDisqualifying) return;
        isDisqualifying = true;
        showCountdownOverlay = false;

        // Log the disqualification
        try {
            const token = localStorage.getItem("login_token") || "";
            const sessionId = localStorage.getItem("exam_session_id") || "0";
            await api("/system/log", "POST", {
                session_id: parseInt(sessionId),
                type: "DISQUALIFIED",
                data: {
                    timestamp: new Date().toISOString(),
                    reason: "Tab/window switch timeout (5 seconds)",
                    warning_count: warningCount,
                    msg: "User disqualified: did not return within 5 seconds"
                }
            }, token);
        } catch (e) {
            console.error("Failed to log disqualification", e);
        }

        // Mark system as completed (but progress is saved in IDB)
        try {
            const token = localStorage.getItem("login_token") || "";
            const sessionId = localStorage.getItem("exam_session_id") || "0";
            await api("/system/finish", "POST", {
                session_id: parseInt(sessionId),
                reason: "disqualified"
            }, token);
        } catch (e) {
            console.error("Failed to finish exam on disqualification", e);
        }

        // DO NOT clear IDB state — we want the progress preserved so admin can resume
        // Just navigate to thankyou
        goto("/thankyou");
    }

    function dismissWarning() {
        showWarning = false;
        // Re-request fullscreen after dismissing warning
        if (enableFullscreen && !isFullscreen()) {
            requestFullscreen();
        }
    }

    // ──── Prevent context menu (right-click) ────
    function preventContext(e: MouseEvent) {
        // Allow if explicitly permitted via class
        let target = e.target as Node | null;
        if (target && target.nodeType === Node.TEXT_NODE) {
            target = target.parentElement;
        }
        
        const el = target as HTMLElement;
        if (el && typeof el.closest === 'function' && el.closest(".allow-context-menu")) {
            return;
        }

        if (enableCopyPaste) {
            e.preventDefault();
            return false;
        }
    }

    // ──── Key combos to block ────
    function blockKeys(e: KeyboardEvent) {
        // Block Alt+Tab, Alt+F4, Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Shift+I (devtools), F11, F12
        if (e.altKey && e.key === 'Tab') {
            e.preventDefault();
            return false;
        }
        if (e.altKey && e.key === 'F4') {
            e.preventDefault();
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && ['w', 't', 'n'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            return false;
        }
        // Block F12 and Ctrl+Shift+I (DevTools)
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            return false;
        }
        // Block Escape from fullscreen
        if (e.key === 'Escape' && enableFullscreen) {
            e.preventDefault();
            setTimeout(() => {
                if (!isFullscreen()) requestFullscreen();
            }, 100);
            return false;
        }
    }

    onMount(() => {
        // Fullscreen
        if (enableFullscreen) {
            requestFullscreen();
            document.addEventListener("fullscreenchange", handleFullscreenChange);
            document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        }

        // Copy/Paste
        if (enableCopyPaste) {
            document.addEventListener("copy", preventCopyPaste, true);
            document.addEventListener("paste", preventCopyPaste, true);
            document.addEventListener("cut", preventCopyPaste, true);
            document.addEventListener("contextmenu", preventContext as any, true);
        }

        // Keyboard shortcuts
        document.addEventListener("keydown", preventCopyPasteKeys, true);
        document.addEventListener("keydown", blockKeys, true);

        // Tab/visibility detection
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("focus", handleWindowFocus);

        // Prevent beforeunload in exam mode
        if (examMode) {
            window.addEventListener("beforeunload", handleBeforeUnload);
        }
    });

    function handleBeforeUnload(e: BeforeUnloadEvent) {
        e.preventDefault();
        e.returnValue = "You are in an exam. Leaving will disqualify you!";
        return e.returnValue;
    }

    onDestroy(() => {
        if (countdownTimer) clearInterval(countdownTimer);

        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.removeEventListener("copy", preventCopyPaste, true);
        document.removeEventListener("paste", preventCopyPaste, true);
        document.removeEventListener("cut", preventCopyPaste, true);
        document.removeEventListener("contextmenu", preventContext as any, true);
        document.removeEventListener("keydown", preventCopyPasteKeys, true);
        document.removeEventListener("keydown", blockKeys, true);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("focus", handleWindowFocus);
        window.removeEventListener("beforeunload", handleBeforeUnload);
    });
</script>

{@render children?.()}

<!-- Countdown Overlay (when user switches away and comes back before 5s) -->
{#if showCountdownOverlay}
    <div class="guard-overlay countdown-overlay">
        <div class="guard-card danger-card">
            <div class="danger-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
            </div>
            <h2>⚠️ RETURN TO EXAM</h2>
            <p>You have left the exam window. Return immediately or you will be <strong>DISQUALIFIED</strong>.</p>
            <div class="countdown-display">
                <span class="countdown-number">{countdown}</span>
                <span class="countdown-label">seconds remaining</span>
            </div>
        </div>
    </div>
{/if}

<!-- Warning Toast -->
{#if showWarning}
    <div class="guard-overlay warning-overlay" onclick={dismissWarning} onkeydown={(e) => e.key === 'Enter' && dismissWarning()} role="button" tabindex="-1">
        <div class="guard-card warning-card">
            <div class="warning-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
            </div>
            <h2>VIOLATION DETECTED</h2>
            <p>{warningMessage}</p>
            <p class="warning-subtext">Total violations: <strong>{warningCount}</strong></p>
            <button class="btn-acknowledge" onclick={dismissWarning}>
                I Understand — Return to Exam
            </button>
        </div>
    </div>
{/if}

<style>
    .guard-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(8px);
    }

    .countdown-overlay {
        background: rgba(127, 29, 29, 0.85);
    }

    .warning-overlay {
        background: rgba(0, 0, 0, 0.9);
    }

    .guard-card {
        padding: 2.5rem 3rem;
        border-radius: 16px;
        text-align: center;
        max-width: 480px;
        width: 90vw;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.8);
        font-family: 'Outfit', 'JetBrains Mono', monospace, sans-serif;
    }

    .danger-card {
        background: linear-gradient(135deg, #1a0000, #2d0000);
        border: 2px solid #ef4444;
        animation: dangerPulse 1s ease-in-out infinite;
    }

    .warning-card {
        background: linear-gradient(135deg, #0f1219, #1a1f2e);
        border: 1px solid rgba(234, 179, 8, 0.5);
    }

    @keyframes dangerPulse {
        0%, 100% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.3), 0 25px 80px rgba(0, 0, 0, 0.8); }
        50% { box-shadow: 0 0 60px rgba(239, 68, 68, 0.6), 0 25px 80px rgba(0, 0, 0, 0.8); }
    }

    .danger-icon, .warning-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        margin-bottom: 1.5rem;
    }

    .danger-icon {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
    }

    .danger-icon svg, .warning-icon svg {
        width: 36px;
        height: 36px;
    }

    .warning-icon {
        background: rgba(234, 179, 8, 0.15);
        color: #eab308;
    }

    .guard-card h2 {
        margin: 0 0 1rem 0;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: 2px;
        color: #fff;
        font-family: 'JetBrains Mono', monospace;
    }

    .guard-card p {
        color: #94a3b8;
        font-size: 0.95rem;
        line-height: 1.7;
        margin: 0 0 0.5rem 0;
    }

    .guard-card p strong {
        color: #ef4444;
    }

    .countdown-display {
        margin-top: 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .countdown-number {
        font-family: 'JetBrains Mono', monospace;
        font-size: 4rem;
        font-weight: 800;
        color: #ef4444;
        line-height: 1;
        text-shadow: 0 0 40px rgba(239, 68, 68, 0.5);
        animation: countdownTick 1s ease-in-out infinite;
    }

    @keyframes countdownTick {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }

    .countdown-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        color: #fca5a5;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    .warning-subtext {
        font-size: 0.8rem !important;
        color: #64748b !important;
        margin-top: 1rem !important;
    }

    .warning-subtext strong {
        color: #eab308 !important;
    }

    .btn-acknowledge {
        margin-top: 1.5rem;
        padding: 12px 32px;
        background: rgba(234, 179, 8, 0.1);
        border: 1px solid rgba(234, 179, 8, 0.4);
        color: #fbbf24;
        border-radius: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 1px;
        width: 100%;
    }

    .btn-acknowledge:hover {
        background: rgba(234, 179, 8, 0.2);
        border-color: #eab308;
        color: #fff;
    }
</style>
