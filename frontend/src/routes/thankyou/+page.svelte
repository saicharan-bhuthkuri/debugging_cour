<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { goto, pushState, afterNavigate } from "$app/navigation";
    import * as ws from "$lib/ws.svelte";
    import ExamGuard from "$lib/components/ExamGuard.svelte";

    // Prevent back navigation to exam
    afterNavigate(() => {
        try {
            pushState(location.href, {});
        } catch (e) {
            console.warn("Router not ready for pushState", e);
        }
    });

    onMount(() => {
        window.addEventListener('popstate', preventBack);

        // Reconnect WS if not connected (keep persistent connection)
        const token = localStorage.getItem("login_token");
        if (token && !ws.state.connected) {
            ws.connect(token);
        }
    });

    function preventBack() {
        try {
            pushState(location.href, {});
        } catch (e) {
            // Fallback for popstate if router is busy
        }
    }

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('popstate', preventBack);
        }
    });

    // Listen for system status change back to 'online' -> redirect to login
    $effect(() => {
        if (ws.state.connected) {
            const unsubscribe = ws.subscribe((msg: any) => {
                if ((msg.type === "update" || msg.type === "system_online" || msg.type === "system_updated") && msg.data) {
                    const sys = msg.data;
                    const status = sys.status ? sys.status.toLowerCase() : '';
                    
                    if (status === 'online') {
                        // Admin has re-activated the system, redirect to login
                        localStorage.removeItem("exam_session_id");
                        goto("/login");
                    } else if (status === 'exam') {
                        // Admin pushed back to exam mode — resume exam
                        // Progress is still saved in IDB
                        const examType = sys.exam_type || 'debug';
                        goto(`/${examType}`);
                    }
                }
            });
            return unsubscribe;
        }
    });
</script>

<ExamGuard examMode={false} enableFullscreen={true} enableCopyPaste={true}>
<div class="thankyou-page">
    <div class="card">
        <div class="icon-wrap">
            <svg class="check-icon" viewBox="0 0 24 24">
                 <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
        </div>
        <h1>Exam Completed</h1>
        <p>Thank you for your submission. Your responses have been recorded successfully.</p>
        <p class="sub-text">Please wait for further instructions from the invigilator.</p>
        <div class="status-indicator">
            <span class="dot"></span> System Standby
        </div>
    </div>
</div>
</ExamGuard>

<style>
    :global(body) { 
        margin: 0; 
        background: #0a0d14; 
        font-family: 'Outfit', sans-serif; 
        color: white; 
    }
    .thankyou-page {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #0a0d14;
    }
    .card {
        background: #141820;
        padding: 3rem 3.5rem;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        text-align: center;
        max-width: 480px;
        width: 90vw;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
    }
    .icon-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        background: rgba(74, 222, 128, 0.1);
        border-radius: 50%;
        margin-bottom: 1.5rem;
    }
    .check-icon {
        width: 40px;
        height: 40px;
        fill: #4ade80;
    }
    h1 { 
        margin: 0 0 1rem 0; 
        font-size: 1.8rem; 
        font-weight: 700;
        letter-spacing: -0.02em;
    }
    p { 
        color: #94a3b8; 
        font-size: 1rem; 
        line-height: 1.7; 
        margin: 0 0 0.5rem 0;
    }
    .sub-text { 
        font-size: 0.85rem; 
        opacity: 0.6; 
        margin-top: 1.5rem; 
    }
    .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 2rem;
        padding: 8px 18px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 20px;
        font-size: 0.8rem;
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .dot { 
        width: 8px; 
        height: 8px; 
        background: #eab308; 
        border-radius: 50%; 
        box-shadow: 0 0 8px #eab308;
        animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
</style>
