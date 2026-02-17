<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, gutter, GutterMarker } from "@codemirror/view";
    import { EditorState, StateField, StateEffect } from "@codemirror/state";
    import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
    import { cpp } from "@codemirror/lang-cpp";
    import { python } from "@codemirror/lang-python";
    import { javascript } from "@codemirror/lang-javascript";
    import { oneDark } from "@codemirror/theme-one-dark";
    import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

    interface Props {
        code: string;
        mode: 'full_edit' | 'find_buggy_line' | 'add_lines' | 'missing_lines';
        language?: 'c' | 'cpp' | 'python' | 'javascript';
        answerMeta?: any;
        onchange?: (value: string) => void;
        onmarkedlines?: (lines: number[]) => void;
        onaddedlines?: (data: { afterLine: number; content: string }[]) => void;
    }

    let {
        code = "",
        mode = "full_edit",
        language = "c",
        answerMeta = null,
        onchange,
        onmarkedlines,
        onaddedlines
    }: Props = $props();

    let editorContainer: HTMLDivElement;
    let editorView: EditorView | null = null;
    let markedLines: Set<number> = new Set();

    // ─── Effects for line marking (find_buggy_line mode) ───
    const toggleBuggyLine = StateEffect.define<{ line: number }>();

    const buggyLineField = StateField.define<DecorationSet>({
        create() { return Decoration.none; },
        update(decorations, tr) {
            decorations = decorations.map(tr.changes);
            for (const effect of tr.effects) {
                if (effect.is(toggleBuggyLine)) {
                    const lineNum = effect.value.line;
                    const line = tr.state.doc.line(lineNum);
                    // Check if this line is already decorated
                    let found = false;
                    const newDecos: any[] = [];
                    decorations.between(line.from, line.to, (from, to, deco) => {
                        found = true;
                    });
                    if (found) {
                        // Remove it
                        decorations = decorations.update({
                            filter: (from, to) => {
                                return from < line.from || from > line.to;
                            }
                        });
                        markedLines.delete(lineNum);
                    } else {
                        // Add it
                        decorations = decorations.update({
                            add: [buggyLineDeco.range(line.from)]
                        });
                        markedLines.add(lineNum);
                    }
                    if (onmarkedlines) {
                        onmarkedlines(Array.from(markedLines).sort((a, b) => a - b));
                    }
                }
            }
            return decorations;
        },
        provide: f => EditorView.decorations.from(f)
    });

    const buggyLineDeco = Decoration.line({ class: "cm-buggy-line" });

    // ─── Buggy line gutter marker ───
    class BuggyMarkerWidget extends GutterMarker {
        toDOM() {
            const el = document.createElement("div");
            el.className = "cm-buggy-gutter-marker";
            el.innerHTML = "🐛";
            return el;
        }
    }

    const buggyGutter = gutter({
        class: "cm-buggy-gutter",
        lineMarker(view, line) {
            const lineNum = view.state.doc.lineAt(line.from).number;
            if (markedLines.has(lineNum)) {
                return new BuggyMarkerWidget();
            }
            return null;
        },
        lineMarkerChange(update) {
            return update.transactions.some(tr => tr.effects.some(e => e.is(toggleBuggyLine)));
        },
        initialSpacer: () => new BuggyMarkerWidget()
    });

    // ─── Missing lines decorations ───
    const missingLineDeco = Decoration.line({ class: "cm-missing-line" });

    function createMissingLinesDecorations(state: EditorState, editableLines: number[]) {
        const decos: any[] = [];
        for (const lineNum of editableLines) {
            if (lineNum >= 1 && lineNum <= state.doc.lines) {
                const line = state.doc.line(lineNum);
                decos.push(missingLineDeco.range(line.from));
            }
        }
        return Decoration.set(decos, true);
    }

    // ─── Add line mode context menu ───
    let showContextMenu = $state(false);
    let contextMenuPos = $state({ x: 0, y: 0 });
    let contextMenuLine = $state(0);
    let addedLinesMap: Map<number, string> = new Map();
    let bypassFilter = false; // bypass flag for programmatic inserts

    // Decoration for added lines
    const addedLineDeco = Decoration.line({ class: "cm-added-line" });

    function createAddedLinesDecorations(state: EditorState) {
        const decos: any[] = [];
        for (const lineNum of addedLinesMap.keys()) {
            if (lineNum >= 1 && lineNum <= state.doc.lines) {
                const line = state.doc.line(lineNum);
                decos.push(addedLineDeco.range(line.from));
            }
        }
        return Decoration.set(decos, true);
    }

    function getLanguageExtension(lang: string) {
        switch (lang) {
            case 'c':
            case 'cpp': return cpp();
            case 'python': return python();
            case 'javascript': return javascript();
            default: return cpp();
        }
    }

    function buildExtensions() {
        const langExt = getLanguageExtension(language);
        const baseExtensions = [
            lineNumbers(),
            langExt,
            oneDark,
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.theme({
                "&": {
                    fontSize: "13px",
                    fontFamily: "'JetBrains Mono', monospace",
                    height: "100%",
                },
                ".cm-content": {
                    padding: "8px 0",
                    caretColor: "#00f3ff",
                },
                ".cm-line": {
                    padding: "0 12px",
                },
                ".cm-cursor": {
                    borderLeftColor: "#00f3ff",
                },
                ".cm-gutters": {
                    backgroundColor: "#0d1117",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    color: "#4a5568",
                    minWidth: "40px",
                },
                ".cm-activeLineGutter": {
                    backgroundColor: "rgba(0,243,255,0.06)",
                    color: "#00f3ff",
                },
                "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
                    backgroundColor: "rgba(0,243,255,0.12) !important",
                },
                ".cm-buggy-line": {
                    backgroundColor: "rgba(239, 68, 68, 0.12) !important",
                    borderLeft: "3px solid #ef4444",
                    paddingLeft: "9px !important",
                },
                ".cm-buggy-gutter-marker": {
                    fontSize: "12px",
                    lineHeight: "1.4",
                    cursor: "pointer",
                },
                ".cm-buggy-gutter": {
                    width: "22px",
                },
                ".cm-missing-line": {
                    backgroundColor: "rgba(234, 179, 8, 0.10) !important",
                    borderLeft: "3px solid #eab308",
                    paddingLeft: "9px !important",
                },
                ".cm-added-line": {
                    backgroundColor: "rgba(74, 222, 128, 0.10) !important",
                    borderLeft: "3px solid #4ade80",
                    paddingLeft: "9px !important",
                },
                ".cm-readonly-line": {
                    opacity: "0.6",
                },
            }),
        ];

        if (mode === 'full_edit') {
            baseExtensions.push(
                highlightActiveLine(),
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged && onchange) {
                        onchange(update.state.doc.toString());
                    }
                })
            );
        }

        if (mode === 'find_buggy_line') {
            baseExtensions.push(
                EditorState.readOnly.of(true),
                buggyLineField,
                buggyGutter,
                EditorView.domEventHandlers({
                    click(event, view) {
                        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                        if (pos !== null) {
                            const line = view.state.doc.lineAt(pos);
                            view.dispatch({
                                effects: toggleBuggyLine.of({ line: line.number })
                            });
                        }
                        return false;
                    }
                })
            );
        }

        if (mode === 'add_lines') {
            baseExtensions.push(
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged && onchange) {
                        onchange(update.state.doc.toString());
                    }
                }),
                // Decorate added lines with green highlight
                ViewPlugin.fromClass(class {
                    decorations: DecorationSet;
                    constructor(view: EditorView) {
                        this.decorations = createAddedLinesDecorations(view.state);
                    }
                    update(update: ViewUpdate) {
                        if (update.docChanged || update.viewportChanged) {
                            this.decorations = createAddedLinesDecorations(update.state);
                        }
                    }
                }, { decorations: v => v.decorations }),
                // Transaction filter: allow only edits on added lines (or bypassed inserts)
                EditorState.transactionFilter.of(tr => {
                    if (!tr.docChanged) return tr;
                    // Allow programmatic inserts (new line insertion)
                    if (bypassFilter) return tr;
                    // Allow changes only in added lines
                    let allowed = true;
                    tr.changes.iterChanges((fromA, toA) => {
                        const lineStart = tr.startState.doc.lineAt(fromA).number;
                        const lineEnd = tr.startState.doc.lineAt(Math.min(toA, tr.startState.doc.length)).number;
                        for (let l = lineStart; l <= lineEnd; l++) {
                            if (!addedLinesMap.has(l)) {
                                allowed = false;
                            }
                        }
                    });
                    if (!allowed) return [];
                    return tr;
                }),
                EditorView.domEventHandlers({
                    contextmenu(event, view) {
                        event.preventDefault();
                        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                        if (pos !== null) {
                            const line = view.state.doc.lineAt(pos);
                            contextMenuLine = line.number;
                            contextMenuPos = { x: event.clientX, y: event.clientY };
                            showContextMenu = true;
                        }
                        return true;
                    }
                })
            );
        }

        if (mode === 'missing_lines') {
            const editableLines = answerMeta?.editable_lines || [];
            baseExtensions.push(
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged && onchange) {
                        onchange(update.state.doc.toString());
                    }
                }),
                // Mark missing lines visually
                ViewPlugin.fromClass(class {
                    decorations: DecorationSet;
                    constructor(view: EditorView) {
                        this.decorations = createMissingLinesDecorations(view.state, editableLines);
                    }
                    update(update: ViewUpdate) {
                        if (update.docChanged || update.viewportChanged) {
                            this.decorations = createMissingLinesDecorations(update.state, editableLines);
                        }
                    }
                }, { decorations: v => v.decorations }),
                // Restrict editing to only editable lines
                EditorState.transactionFilter.of(tr => {
                    if (!tr.docChanged) return tr;
                    let allowed = true;
                    tr.changes.iterChanges((fromA, toA) => {
                        const lineStart = tr.startState.doc.lineAt(fromA).number;
                        const lineEnd = tr.startState.doc.lineAt(Math.min(toA, tr.startState.doc.length)).number;
                        for (let l = lineStart; l <= lineEnd; l++) {
                            if (!editableLines.includes(l)) {
                                allowed = false;
                            }
                        }
                    });
                    if (!allowed) return [];
                    return tr;
                })
            );
        }

        return baseExtensions;
    }

    function insertLineAfter(lineNum: number) {
        if (!editorView) return;
        const line = editorView.state.doc.line(lineNum);
        const insertPos = line.to;

        // Update tracking BEFORE dispatch: shift existing added lines down
        const newLineNum = lineNum + 1;
        const newMap = new Map<number, string>();
        for (const [ln, content] of addedLinesMap) {
            if (ln >= newLineNum) {
                newMap.set(ln + 1, content);
            } else {
                newMap.set(ln, content);
            }
        }
        newMap.set(newLineNum, "");
        addedLinesMap = newMap;

        // Bypass the transaction filter for this programmatic insert
        bypassFilter = true;
        editorView.dispatch({
            changes: { from: insertPos, to: insertPos, insert: "\n" }
        });
        bypassFilter = false;

        // Focus the new line
        setTimeout(() => {
            if (editorView) {
                const newLine = editorView.state.doc.line(newLineNum);
                editorView.dispatch({
                    selection: { anchor: newLine.from }
                });
                editorView.focus();
            }
        }, 10);

        showContextMenu = false;

        if (onaddedlines) {
            const result = Array.from(addedLinesMap.entries()).map(([line, content]) => ({
                afterLine: line - 1,
                content
            }));
            onaddedlines(result);
        }
    }

    onMount(() => {
        if (!editorContainer) return;

        const state = EditorState.create({
            doc: code,
            extensions: buildExtensions()
        });

        editorView = new EditorView({
            state,
            parent: editorContainer
        });

        // Restore marked lines if provided in answerMeta for find_buggy_line
        if (mode === 'find_buggy_line' && answerMeta?.marked_lines) {
            // Admin preview: show pre-marked lines
        }
    });

    onDestroy(() => {
        if (editorView) {
            editorView.destroy();
            editorView = null;
        }
    });

    // Close context menu on click elsewhere
    function handleGlobalClick() {
        showContextMenu = false;
    }

    // Re-create editor when code or mode changes
    $effect(() => {
        if (editorView && code !== undefined) {
            const currentCode = editorView.state.doc.toString();
            if (currentCode !== code) {
                editorView.dispatch({
                    changes: {
                        from: 0,
                        to: editorView.state.doc.length,
                        insert: code
                    }
                });
            }
        }
    });
</script>

<svelte:window onclick={handleGlobalClick} />

<div class="code-editor-wrapper">
    <!-- Mode indicator -->
    <div class="mode-bar">
        {#if mode === 'full_edit'}
            <span class="mode-badge full-edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Full Edit
            </span>
        {:else if mode === 'find_buggy_line'}
            <span class="mode-badge find-buggy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                Find Buggy Line — Click any line to mark/unmark
            </span>
            {#if markedLines.size > 0}
                <span class="marked-count">{markedLines.size} line{markedLines.size > 1 ? 's' : ''} marked</span>
            {/if}
        {:else if mode === 'add_lines'}
            <span class="mode-badge add-line">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Lines — Right-click to insert a new line
            </span>
        {:else if mode === 'missing_lines'}
            <span class="mode-badge missing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                Fill Missing Lines — Only highlighted lines are editable
            </span>
        {/if}
    </div>

    <div class="editor-mount" bind:this={editorContainer}></div>

    <!-- Context menu for add_lines mode -->
    {#if showContextMenu && mode === 'add_lines'}
        <div class="context-menu" style="left: {contextMenuPos.x}px; top: {contextMenuPos.y}px;">
            <button
                class="context-menu-item"
                onclick={(e) => { e.stopPropagation(); insertLineAfter(contextMenuLine); }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Insert line after Line {contextMenuLine}
            </button>
        </div>
    {/if}
</div>

<style>
    .code-editor-wrapper {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
    }

    .mode-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
    }

    .mode-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.68rem;
        padding: 3px 10px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: 1px solid;
    }

    .mode-badge svg {
        width: 12px;
        height: 12px;
    }

    .mode-badge.full-edit {
        background: rgba(0, 243, 255, 0.08);
        color: #00f3ff;
        border-color: rgba(0, 243, 255, 0.2);
    }

    .mode-badge.find-buggy {
        background: rgba(239, 68, 68, 0.08);
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.2);
    }

    .mode-badge.add-line {
        background: rgba(74, 222, 128, 0.08);
        color: #4ade80;
        border-color: rgba(74, 222, 128, 0.2);
    }

    .mode-badge.missing {
        background: rgba(234, 179, 8, 0.08);
        color: #fbbf24;
        border-color: rgba(234, 179, 8, 0.2);
    }

    .marked-count {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.65rem;
        padding: 2px 8px;
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border-radius: 3px;
        font-weight: 600;
    }

    .editor-mount {
        flex: 1;
        overflow: auto;
        min-height: 0;
    }

    .editor-mount :global(.cm-editor) {
        height: 100%;
    }

    .editor-mount :global(.cm-scroller) {
        overflow: auto;
    }

    /* Context Menu */
    .context-menu {
        position: fixed;
        z-index: 1000;
        background: #1a1f2e;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 4px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        min-width: 200px;
        animation: contextIn 0.15s ease-out;
    }

    @keyframes contextIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }

    .context-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        color: #e2e8f0;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        cursor: pointer;
        border-radius: 6px;
        transition: background 0.15s;
    }

    .context-menu-item:hover {
        background: rgba(74, 222, 128, 0.12);
        color: #4ade80;
    }

    .context-menu-item svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
    }
</style>
