<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  
  let { onStart, examType = 'debug' } = $props();
</script>

<div class="overlay" transition:fade>
  <div class="dialog" transition:scale={{ duration: 300, start: 0.9 }}>
    <div class="glow blue"></div>
    <div class="glow purple"></div>

    <div class="content">
        <h2>System Verified</h2>
        <p>Ready to initiate {examType === 'typing' ? 'Typing Master' : 'Debug Protocol'}?</p>
        
        <div class="actions">
            <button onclick={onStart}>
                <span>Start Exam</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
        </div>

        <p class="warning">
            <strong>WARNING:</strong> Exam mode will lock this system.
        </p>
    </div>
  </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
    }

    .dialog {
        background: #0f131d;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 3rem;
        text-align: center;
        box-shadow: 0 0 50px rgba(0,0,0,0.5);
        max-width: 500px;
        width: 90%;
        position: relative;
        overflow: hidden;
        color: white;
    }

    .glow {
        position: absolute;
        width: 150px;
        height: 150px;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.3;
        z-index: 0;
        transition: opacity 1s ease;
    }
    
    .glow.blue { background: #3b82f6; top: -50px; right: -50px; }
    .glow.purple { background: #a855f7; bottom: -50px; left: -50px; }

    .content { position: relative; z-index: 1; }

    h2 {
        font-family: "JetBrains Mono", monospace;
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        color: white;
        text-transform: uppercase;
        letter-spacing: -1px;
    }

    p { color: #94a3b8; font-size: 1.1rem; margin-bottom: 2rem; }

    .actions button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem 2rem;
        font-family: "JetBrains Mono", monospace;
        font-weight: 700;
        color: white;
        background: #4f46e5;
        border: none;
        border-radius: 8px;
        font-size: 1.2rem;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
        overflow: hidden;
    }

    .actions button:hover {
        background: #4338ca;
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.4);
    }

    .actions button:active { transform: translateY(0); }

    .warning {
        font-size: 0.8rem;
        color: #64748b;
        margin-top: 2rem;
        font-family: "JetBrains Mono", monospace;
        margin-bottom: 0;
    }

    .warning strong { color: #ef4444; }
</style>
