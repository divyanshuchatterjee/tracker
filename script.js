// ============================================================
// FIREBASE IMPORTS
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    setDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const trackersCollection = collection(db, "trackers");


// ============================================================
// APPLICATION STATE
// ============================================================

let data = {
    trackers: []
};

let activeTrackerId = null;


// ============================================================
// UTILITIES
// ============================================================

function generateId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 9)
    );
}


function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {
    return escapeHTML(value);
}


function getActiveTracker() {
    return data.trackers.find(
        tracker => tracker.id === activeTrackerId
    );
}


function clone(value) {
    return JSON.parse(JSON.stringify(value));
}


function sanitizeFileName(name) {
    return String(name || "tracker")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100) || "tracker";
}


function uniqueTrackerName(baseName) {
    const existingNames = new Set(
        data.trackers.map(tracker =>
            String(tracker.name || "").trim().toLowerCase()
        )
    );

    const cleanBase =
        String(baseName || "Imported Tracker").trim() ||
        "Imported Tracker";

    if (!existingNames.has(cleanBase.toLowerCase())) {
        return cleanBase;
    }

    let index = 2;

    while (
        existingNames.has(
            `${cleanBase} ${index}`.toLowerCase()
        )
    ) {
        index++;
    }

    return `${cleanBase} ${index}`;
}


function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


function downloadJSON(json, filename) {
    const blob = new Blob(
        [json],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}


function normalizeTracker(tracker) {
    if (!tracker || typeof tracker !== "object") {
        throw new Error("Invalid tracker");
    }

    const type = tracker.type === "notes" ? "notes" : "tracker";

    if (type === "notes") {
        const cards = Array.isArray(tracker.cards)
            ? tracker.cards
            : [];

        return {
            id: String(tracker.id || generateId()),
            name: String(tracker.name || "Notes").trim() || "Notes",
            type: "notes",
            cards: cards.map(card => ({
                id: String(card.id || generateId()),
                title: String(card.title ?? "NOTE"),
                html: String(card.html ?? (card.text ? escapeHTML(String(card.text)).replace(/\n/g, "<br>") : "")),
                text: String(card.text ?? ""),
                color: ["red", "yellow", "green"].includes(card.color) ? card.color : ""
            }))
        };
    }

    const columns = Array.isArray(tracker.columns)
        ? tracker.columns
        : [];

    if (columns.length === 0) {
        throw new Error("Tracker must contain columns");
    }

    const normalizedColumns = columns.map(column => ({
        id: String(column.id || generateId()),
        name: String(column.name || "Column"),
        type:
            column.type === "checkbox"
                ? "checkbox"
                : column.type === "date"
                    ? "date"
                    : "text"
    }));

    const rows = Array.isArray(tracker.rows)
        ? tracker.rows
        : [];

    const normalizedRows = rows.map(row => ({
        id: String(row.id || generateId()),
        cells:
            row.cells && typeof row.cells === "object"
                ? { ...row.cells }
                : {}
    }));

    return {
        id: String(tracker.id || generateId()),
        name: String(tracker.name || "My Tracker").trim() || "My Tracker",
        type: "tracker",
        columns: normalizedColumns,
        rows: normalizedRows
    };
}


// ============================================================
// THEME
// ============================================================

function initializeTheme() {
    const savedTheme =
        localStorage.getItem("theme") ||
        localStorage.getItem("trackerTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}


function toggleTheme() {
    const isDark =
        document.body.classList.toggle("dark-mode");

    localStorage.setItem(
        "theme",
        isDark ? "dark" : "light"
    );

    updateThemeButton();
}


function updateThemeButton() {
    const button =
        document.getElementById("themeToggle");

    if (!button) return;

    button.textContent =
        document.body.classList.contains("dark-mode")
            ? "☀"
            : "☾";
}


// ============================================================
// DEFAULT TRACKER
// ============================================================

function createDefaultTracker() {
    return {
        id: generateId(),
        name: "My Tracker",
        type: "tracker",
        columns: [
            {
                id: generateId(),
                name: "Task",
                type: "text"
            }
        ],
        rows: []
    };
}


function createNotes(name) {
    return {
        id: generateId(),
        name: String(name || "Notes").trim() || "Notes",
        type: "notes",
        cards: []
    };
}


// ============================================================
// FIRESTORE
// ============================================================

async function saveTracker(tracker) {
    await setDoc(
        doc(
            db,
            "trackers",
            tracker.id
        ),
        tracker
    );
}


async function removeTracker(trackerId) {
    await deleteDoc(
        doc(
            db,
            "trackers",
            trackerId
        )
    );
}


async function loadTrackers() {
    const snapshot =
        await getDocs(trackersCollection);

    data.trackers =
        snapshot.docs.map(snapshotDoc => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        }));
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initialize() {
    initializeTheme();

    try {
        await signInAnonymously(auth);
        await loadTrackers();

        /*
         * Recover old localStorage data if Firestore
         * is completely empty.
         */
        if (data.trackers.length === 0) {
            const localData =
                localStorage.getItem("trackerData");

            if (localData) {
                try {
                    const parsed =
                        JSON.parse(localData);

                    if (
                        parsed &&
                        Array.isArray(parsed.trackers)
                    ) {
                        data.trackers =
                            parsed.trackers.map(
                                normalizeTracker
                            );

                        for (
                            const tracker of data.trackers
                        ) {
                            await saveTracker(tracker);
                        }
                    }
                } catch (error) {
                    console.error(
                        "Local migration failed:",
                        error
                    );
                }
            }
        }

        /*
         * Create a default tracker if nothing exists.
         */
        if (data.trackers.length === 0) {
            const tracker =
                createDefaultTracker();

            data.trackers.push(tracker);

            await saveTracker(tracker);
        }

        activeTrackerId =
            data.trackers[0].id;

        render();

    } catch (error) {
        console.error(
            "Initialization failed:",
            error
        );

        /*
         * Fallback to localStorage when Firebase
         * cannot be reached.
         */
        const savedData =
            localStorage.getItem("trackerData");

        if (savedData) {
            try {
                const parsed =
                    JSON.parse(savedData);

                if (
                    parsed &&
                    Array.isArray(parsed.trackers)
                ) {
                    data.trackers =
                        parsed.trackers.map(
                            normalizeTracker
                        );
                }
            } catch (localError) {
                console.error(
                    "Local data recovery failed:",
                    localError
                );
            }
        }

        if (data.trackers.length === 0) {
            data.trackers = [
                createDefaultTracker()
            ];
        }

        activeTrackerId =
            data.trackers[0].id;

        render();

        showToast(
            "Using local data because Firebase could not be reached",
            "error"
        );
    }
}


// ============================================================
// MAIN RENDER
// ============================================================

function render() {
    renderTrackerList();
    renderMain();
}


function renderTrackerList() {
    const container =
        document.getElementById("trackerList");

    if (!container) return;

    container.innerHTML =
        data.trackers
            .map(tracker => {
                const active =
                    tracker.id === activeTrackerId;

                return `
                    <div
                        class="tracker-item ${
                            active ? "active" : ""
                        }"
                        onclick="selectTracker('${tracker.id}')"
                    >
                        <span class="tracker-item-name">
                            ${escapeHTML(tracker.name)}
                        </span>
                    </div>
                `;
            })
            .join("");
}


// ============================================================
// MAIN CONTENT
// ============================================================

function renderMain() {
    const container = document.getElementById("mainContent");

    if (!container) return;

    const tracker = getActiveTracker();

    if (!tracker) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No tracker selected</h2>
            </div>
        `;
        return;
    }

    if (tracker.type === "notes") {
        renderNotes(container, tracker);
        return;
    }

    container.innerHTML = `
        <div class="tracker-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(tracker.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename tracker">✎</button>
            </div>

            <div class="tracker-actions">
                <button class="secondary-button" onclick="exportCurrentTracker()" title="Export this tracker only">Export Sheet</button>
                <label class="secondary-button import-button" title="Import a tracker as a new sheet">
                    Import Sheet
                    <input type="file" accept=".json,application/json" onchange="importCurrentTracker(event)" hidden>
                </label>
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="tracker-table">
                <thead>
                    <tr>
                        ${tracker.columns.map(column => renderColumnHeader(tracker, column)).join("")}
                        <th class="row-actions-header">
                            <button class="add-column-button" onclick="addColumn()" title="Add column">+</button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${tracker.rows.length === 0
                        ? `<tr><td colspan="${tracker.columns.length + 1}" class="empty-row">No rows yet.</td></tr>`
                        : tracker.rows.map(row => renderRow(tracker, row)).join("")}
                </tbody>
            </table>
        </div>

        <button class="add-row-button" onclick="addRow()">+ Add Row</button>
    `;
}


// ============================================================
// NOTES / CARDS
// ============================================================

function renderNotes(container, notes) {
    container.innerHTML = `
        <div class="tracker-header notes-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(notes.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename notes">✎</button>
            </div>

            <div class="tracker-actions">
                <button class="secondary-button" onclick="exportCurrentTracker()" title="Export these notes">Export Notes</button>
                <label class="secondary-button import-button" title="Import notes as a new sheet">
                    Import Notes
                    <input type="file" accept=".json,application/json" onchange="importCurrentTracker(event)" hidden>
                </label>
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="notes-toolbar">
            <button class="primary-button" onclick="addNoteCard()">+ Add Card</button>
            <span class="notes-count">${notes.cards.length} ${notes.cards.length === 1 ? "card" : "cards"}</span>
        </div>

        <div class="notes-grid">
            ${notes.cards.length === 0
                ? `
                    <div class="notes-empty-state">
                        <div class="notes-empty-icon">✎</div>
                        <h2>No cards yet</h2>
                        <p>Add a card to start writing notes.</p>
                        <button class="primary-button" onclick="addNoteCard()">+ Add Card</button>
                    </div>
                `
                : notes.cards.map(card => renderNoteCard(card)).join("")}
        </div>
    `;
}


function sanitizeNoteHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html ?? "");

    const allowedTags = new Set([
        "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
        "SPAN", "BR", "DIV", "P", "UL", "OL", "LI", "A"
    ]);

    const walker = document.createTreeWalker(
        template.content,
        NodeFilter.SHOW_ELEMENT
    );

    const elements = [];
    while (walker.nextNode()) {
        elements.push(walker.currentNode);
    }

    elements.forEach(element => {
        if (!allowedTags.has(element.tagName)) {
            const parent = element.parentNode;
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            return;
        }

        [...element.attributes].forEach(attribute => {
            if (attribute.name === "style") {
                const colorMatch = attribute.value.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|[a-zA-Z]+)\s*;?/i);
                if (colorMatch) {
                    element.setAttribute("style", `color: ${colorMatch[1]};`);
                } else {
                    element.removeAttribute("style");
                }
            } else if (attribute.name === "href" && element.tagName === "A") {
                const href = attribute.value.trim();
                if (/^https?:\/\//i.test(href)) {
                    element.setAttribute("href", href);
                    element.setAttribute("target", "_blank");
                    element.setAttribute("rel", "noopener noreferrer");
                } else {
                    element.removeAttribute("href");
                }
            } else {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return template.innerHTML;
}


function noteCardColorClass(color) {
    return ["red", "yellow", "green"].includes(color)
        ? `note-${color}`
        : "";
}


function renderNoteCard(card) {
    const cardColor = card.color || "";
    const colorClass = noteCardColorClass(cardColor);
    const content = card.html !== undefined
        ? sanitizeNoteHtml(card.html)
        : escapeHTML(card.text || "").replace(/\n/g, "<br>");

    return `
        <article class="note-card ${colorClass}" data-card-id="${escapeAttribute(card.id)}">
            <div class="note-card-header">
                <input
                    type="text"
                    class="note-card-title"
                    value="${escapeAttribute(card.title || "NOTE")}" 
                    oninput="updateNoteCardTitle('${card.id}', this.value)"
                    aria-label="Note title"
                >

                <div class="note-card-header-actions">
                    <div class="note-card-colors" title="Card color">
                        <button class="note-color-dot note-color-default ${!cardColor ? "active" : ""}" onmousedown="event.preventDefault()" onclick="setNoteCardColor('${card.id}', '')" title="Default"></button>
                        <button class="note-color-dot note-color-red ${cardColor === "red" ? "active" : ""}" onmousedown="event.preventDefault()" onclick="setNoteCardColor('${card.id}', 'red')" title="Matte red"></button>
                        <button class="note-color-dot note-color-yellow ${cardColor === "yellow" ? "active" : ""}" onmousedown="event.preventDefault()" onclick="setNoteCardColor('${card.id}', 'yellow')" title="Matte yellow"></button>
                        <button class="note-color-dot note-color-green ${cardColor === "green" ? "active" : ""}" onmousedown="event.preventDefault()" onclick="setNoteCardColor('${card.id}', 'green')" title="Matte green"></button>
                    </div>

                    <button
                        class="note-card-delete"
                        onclick="deleteNoteCard('${card.id}')"
                        title="Delete card"
                    >
                        🗑
                    </button>
                </div>
            </div>

            <div class="note-format-toolbar" aria-label="Text formatting">
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'bold')" title="Bold"><strong>B</strong></button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'italic')" title="Italic"><em>I</em></button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'underline')" title="Underline"><u>U</u></button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'strikeThrough')" title="Strikethrough"><s>S</s></button>
                <span class="note-toolbar-separator"></span>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'insertUnorderedList')" title="Bullet list">•≡</button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNote('${card.id}', 'insertOrderedList')" title="Numbered list">1≡</button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatNoteLink('${card.id}')" title="Add link">🔗</button>
                <span class="note-toolbar-separator"></span>
                <button type="button" class="note-text-color-button" onmousedown="event.preventDefault()" onclick="formatNoteColor('${card.id}', '#202124')" title="Dark text">A</button>
                <button type="button" class="note-text-color-button text-red" onmousedown="event.preventDefault()" onclick="formatNoteColor('${card.id}', '#c62828')" title="Red text">A</button>
                <button type="button" class="note-text-color-button text-blue" onmousedown="event.preventDefault()" onclick="formatNoteColor('${card.id}', '#1565c0')" title="Blue text">A</button>
                <button type="button" class="note-text-color-button text-green" onmousedown="event.preventDefault()" onclick="formatNoteColor('${card.id}', '#2e7d32')" title="Green text">A</button>
                <button type="button" class="note-text-color-button text-purple" onmousedown="event.preventDefault()" onclick="formatNoteColor('${card.id}', '#6a1b9a')" title="Purple text">A</button>
            </div>

            <div
                id="note-editor-${escapeAttribute(card.id)}"
                class="note-card-text"
                contenteditable="true"
                data-placeholder="Start writing..."
                oninput="updateNoteCard('${card.id}', this.innerHTML)"
                onfocus="activeNoteEditorId='${card.id}'"
                onclick="activeNoteEditorId='${card.id}'"
                onkeyup="activeNoteEditorId='${card.id}'"
                spellcheck="true"
            >${content}</div>
        </article>
    `;
}


let activeNoteEditorId = null;
let noteSaveTimers = new Map();
let noteTitleSaveTimers = new Map();


async function saveNoteCardDebounced(notes, cardId) {
    if (noteSaveTimers.has(cardId)) {
        clearTimeout(noteSaveTimers.get(cardId));
    }

    const timer = setTimeout(async () => {
        try {
            await saveTracker(notes);
        } catch (error) {
            console.error("Failed to save note card:", error);
            showToast("Failed to save note", "error");
        } finally {
            noteSaveTimers.delete(cardId);
        }
    }, 500);

    noteSaveTimers.set(cardId, timer);
}


function updateNoteCardTitle(cardId, value) {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = notes.cards.find(item => item.id === cardId);
    if (!card) return;

    card.title = value;

    if (noteTitleSaveTimers.has(cardId)) {
        clearTimeout(noteTitleSaveTimers.get(cardId));
    }

    const timer = setTimeout(async () => {
        try {
            await saveTracker(notes);
        } catch (error) {
            console.error("Failed to save note title:", error);
            showToast("Failed to save note title", "error");
        } finally {
            noteTitleSaveTimers.delete(cardId);
        }
    }, 500);

    noteTitleSaveTimers.set(cardId, timer);
}


function updateNoteCard(cardId, html) {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = notes.cards.find(item => item.id === cardId);
    if (!card) return;

    card.html = sanitizeNoteHtml(html);
    card.text = card.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    saveNoteCardDebounced(notes, cardId);
}


function getNoteEditor(cardId) {
    return document.getElementById(`note-editor-${cardId}`);
}


function restoreNoteSelection(editor) {
    if (!editor) return false;
    editor.focus();
    return true;
}


function formatNote(cardId, command) {
    const editor = getNoteEditor(cardId);
    if (!restoreNoteSelection(editor)) return;

    document.execCommand(command, false, null);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
}


function formatNoteColor(cardId, color) {
    const editor = getNoteEditor(cardId);
    if (!restoreNoteSelection(editor)) return;

    document.execCommand("foreColor", false, color);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
}


function formatNoteLink(cardId) {
    const editor = getNoteEditor(cardId);
    if (!restoreNoteSelection(editor)) return;

    const url = prompt("Enter URL:", "https://");
    if (!url) return;

    const cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
        showToast("Please enter a valid http/https URL", "error");
        return;
    }

    document.execCommand("createLink", false, cleanUrl);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
}


async function setNoteCardColor(cardId, color) {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = notes.cards.find(item => item.id === cardId);
    if (!card) return;

    card.color = ["red", "yellow", "green"].includes(color)
        ? color
        : "";

    render();

    try {
        await saveTracker(notes);
    } catch (error) {
        console.error("Failed to save card color:", error);
        showToast("Failed to save card color", "error");
    }
}


async function addNoteCard() {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = {
        id: generateId(),
        title: "NOTE",
        html: "",
        text: "",
        color: ""
    };

    notes.cards.push(card);
    render();

    try {
        await saveTracker(notes);

        requestAnimationFrame(() => {
            const editors = document.querySelectorAll(".note-card-text");
            const last = editors[editors.length - 1];
            if (last) last.focus();
        });
    } catch (error) {
        notes.cards = notes.cards.filter(item => item.id !== card.id);
        render();
        showToast("Failed to add card", "error");
    }
}


async function deleteNoteCard(cardId) {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const index = notes.cards.findIndex(card => card.id === cardId);
    if (index === -1) return;

    if (!confirm("Delete this card?")) return;

    const deletedCard = notes.cards[index];
    notes.cards.splice(index, 1);
    render();

    try {
        await saveTracker(notes);
        showToast("Card deleted");
    } catch (error) {
        notes.cards.splice(index, 0, deletedCard);
        render();
        showToast("Failed to delete card", "error");
    }
}

// ============================================================
// COLUMN HEADER
// ============================================================

function renderColumnHeader(
    tracker,
    column
) {
    return `
        <th>

            <div class="column-header">

                <span>
                    ${escapeHTML(column.name)}
                </span>

                <button
                    class="column-menu-button"
                    onclick="
                        event.stopPropagation();
                        toggleColumnMenu('${column.id}')
                    "
                    title="Column options"
                >
                    ⋮
                </button>

                <div
                    id="column-menu-${column.id}"
                    class="column-menu"
                >

                    <button
                        onclick="
                            event.stopPropagation();
                            renameColumn('${column.id}')
                        "
                    >
                        Rename
                    </button>

                    <button
                        onclick="
                            event.stopPropagation();
                            deleteColumn('${column.id}')
                        "
                    >
                        Delete
                    </button>

                </div>

            </div>

        </th>
    `;
}


// ============================================================
// ROW
// ============================================================

function renderRow(
    tracker,
    row
) {
    return `
        <tr>

            ${tracker.columns
                .map(column =>
                    renderCell(
                        tracker,
                        row,
                        column
                    )
                )
                .join("")}

            <td class="row-actions">

                <button
                    class="delete-row-button"
                    onclick="deleteRow('${row.id}')"
                    title="Delete row"
                >
                    🗑
                </button>

            </td>

        </tr>
    `;
}


// ============================================================
// CELL
// ============================================================

function renderCell(
    tracker,
    row,
    column
) {
    const value =
        row.cells?.[column.id];

    /*
     * CHECKBOX
     */
    if (column.type === "checkbox") {
        return `
            <td class="checkbox-cell">

                <input
                    type="checkbox"
                    ${
                        value
                            ? "checked"
                            : ""
                    }
                    onchange="
                        updateCheckbox(
                            '${row.id}',
                            '${column.id}',
                            this.checked
                        )
                    "
                >

            </td>
        `;
    }


    /*
     * DATE
     */
    if (column.type === "date") {
        return `
            <td>

                <input
                    type="date"
                    class="cell-input"
                    value="${escapeAttribute(
                        value || ""
                    )}"
                    onchange="
                        updateCell(
                            '${row.id}',
                            '${column.id}',
                            this.value
                        )
                    "
                >

            </td>
        `;
    }


    /*
     * TEXT
     */
    const stringValue =
        String(value ?? "");

    const urlRegex =
        /https?:\/\/[^\s<>"']+/i;

    const urlMatch =
        stringValue.match(urlRegex);

    const detectedUrl =
        urlMatch
            ? urlMatch[0]
            : "";

    return `
        <td class="text-cell">

            <div class="text-cell-wrapper">

                <input
                    type="text"
                    class="cell-input"
                    value="${escapeAttribute(
                        stringValue
                    )}"
                    oninput="
                        updateCellLinkButton(this)
                    "
                    onchange="
                        updateCell(
                            '${row.id}',
                            '${column.id}',
                            this.value
                        )
                    "
                >

                <a
                    class="cell-link-button"
                    href="${escapeAttribute(
                        detectedUrl
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link"
                    ${
                        detectedUrl
                            ? ""
                            : 'style="display:none;"'
                    }
                    onclick="
                        event.stopPropagation()
                    "
                >
                    ↗
                </a>

            </div>

        </td>
    `;
}


// ============================================================
// URL BUTTON
// ============================================================

function updateCellLinkButton(input) {
    if (!input) return;

    const wrapper =
        input.closest(".text-cell-wrapper");

    if (!wrapper) return;

    const link =
        wrapper.querySelector(
            ".cell-link-button"
        );

    if (!link) return;

    const value =
        input.value || "";

    const urlRegex =
        /https?:\/\/[^\s<>"']+/i;

    const match =
        value.match(urlRegex);

    if (match) {
        link.href = match[0];
        link.style.display = "inline-flex";
    } else {
        link.removeAttribute("href");
        link.style.display = "none";
    }
}


// ============================================================
// ADD TRACKER
// ============================================================

async function addTracker() {
    const choice = prompt(
        "What do you want to create?\n\n1 = Tracker\n2 = Notes (new)",
        "1"
    );

    if (choice === null) return;

    const trimmedChoice = choice.trim().toLowerCase();

    if (trimmedChoice !== "1" && trimmedChoice !== "2" && trimmedChoice !== "tracker" && trimmedChoice !== "notes") {
        showToast("Please choose 1 for Tracker or 2 for Notes", "error");
        return;
    }

    const isNotes = trimmedChoice === "2" || trimmedChoice === "notes";

    const name = prompt(
        isNotes ? "Enter notes name:" : "Enter tracker name:",
        isNotes ? "Notes" : "My Tracker"
    );

    if (name === null || !name.trim()) return;

    const item = isNotes
        ? createNotes(name.trim())
        : {
            id: generateId(),
            name: name.trim(),
            type: "tracker",
            columns: [
                { id: generateId(), name: "Task", type: "text" }
            ],
            rows: []
        };

    data.trackers.push(item);
    activeTrackerId = item.id;
    render();

    try {
        await saveTracker(item);
        showToast(isNotes ? "Notes created" : "Tracker created");
    } catch (error) {
        console.error(error);
        data.trackers = data.trackers.filter(current => current.id !== item.id);
        activeTrackerId = data.trackers[0]?.id || null;
        render();
        showToast(isNotes ? "Failed to create notes" : "Failed to create tracker", "error");
    }
}


// ============================================================
// DELETE TRACKER
// ============================================================

async function deleteTracker() {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    if (!confirm(
        `Delete "${tracker.name}"?`
    )) {
        return;
    }

    const trackerIndex =
        data.trackers.findIndex(
            item =>
                item.id === tracker.id
        );

    data.trackers.splice(
        trackerIndex,
        1
    );

    try {
        await removeTracker(
            tracker.id
        );

    } catch (error) {
        data.trackers.splice(
            trackerIndex,
            0,
            tracker
        );

        render();

        showToast(
            "Failed to delete tracker",
            "error"
        );

        return;
    }

    if (data.trackers.length === 0) {
        const newTracker =
            createDefaultTracker();

        data.trackers.push(
            newTracker
        );

        activeTrackerId =
            newTracker.id;

        await saveTracker(
            newTracker
        );

    } else {
        activeTrackerId =
            data.trackers[
                Math.max(
                    0,
                    trackerIndex - 1
                )
            ].id;
    }

    render();

    showToast("Tracker deleted");
}


// ============================================================
// SELECT TRACKER
// ============================================================

function selectTracker(trackerId) {
    if (
        !data.trackers.some(
            tracker =>
                tracker.id === trackerId
        )
    ) {
        return;
    }

    activeTrackerId = trackerId;

    render();
}


// ============================================================
// RENAME TRACKER
// ============================================================

async function renameTracker() {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const newName =
        prompt(
            "Enter new tracker name:",
            tracker.name
        );

    if (
        newName === null ||
        !newName.trim()
    ) {
        return;
    }

    const oldName =
        tracker.name;

    tracker.name =
        newName.trim();

    render();

    try {
        await saveTracker(tracker);

        showToast("Tracker renamed");

    } catch (error) {
        tracker.name =
            oldName;

        render();

        showToast(
            "Failed to rename tracker",
            "error"
        );
    }
}


// ============================================================
// ADD COLUMN
// ============================================================

async function addColumn() {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const name =
        prompt("Enter column name:");

    if (
        name === null ||
        !name.trim()
    ) {
        return;
    }

    const typeInput =
        prompt(
            "Column type:\n\n1 = Text\n2 = Checkbox\n3 = Date",
            "1"
        );

    if (
        typeInput !== "1" &&
        typeInput !== "2" &&
        typeInput !== "3"
    ) {
        return;
    }

    const type =
        typeInput === "2"
            ? "checkbox"
            : typeInput === "3"
                ? "date"
                : "text";

    const column = {
        id: generateId(),
        name: name.trim(),
        type
    };

    tracker.columns.push(column);

    tracker.rows.forEach(row => {
        row.cells[column.id] =
            type === "checkbox"
                ? false
                : "";
    });

    render();

    try {
        await saveTracker(tracker);

        showToast("Column added");

    } catch (error) {
        tracker.columns =
            tracker.columns.filter(
                item =>
                    item.id !== column.id
            );

        tracker.rows.forEach(row => {
            delete row.cells[column.id];
        });

        render();

        showToast(
            "Failed to add column",
            "error"
        );
    }
}


// ============================================================
// RENAME COLUMN
// ============================================================

async function renameColumn(columnId) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const column =
        tracker.columns.find(
            item =>
                item.id === columnId
        );

    if (!column) return;

    const newName =
        prompt(
            "Enter new column name:",
            column.name
        );

    if (
        newName === null ||
        !newName.trim()
    ) {
        return;
    }

    const oldName =
        column.name;

    column.name =
        newName.trim();

    render();

    try {
        await saveTracker(tracker);

        showToast("Column renamed");

    } catch (error) {
        column.name =
            oldName;

        render();

        showToast(
            "Failed to rename column",
            "error"
        );
    }
}


// ============================================================
// DELETE COLUMN
// ============================================================

async function deleteColumn(columnId) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    if (
        tracker.columns.length <= 1
    ) {
        showToast(
            "A tracker must have at least one column",
            "error"
        );

        return;
    }

    const column =
        tracker.columns.find(
            item =>
                item.id === columnId
        );

    if (!column) return;

    if (!confirm(
        `Delete column "${column.name}"?`
    )) {
        return;
    }

    const oldColumns =
        clone(tracker.columns);

    const oldCells =
        tracker.rows.map(row => ({
            rowId: row.id,
            value: row.cells?.[columnId]
        }));

    tracker.columns =
        tracker.columns.filter(
            item =>
                item.id !== columnId
        );

    tracker.rows.forEach(row => {
        delete row.cells[columnId];
    });

    render();

    try {
        await saveTracker(tracker);

        showToast("Column deleted");

    } catch (error) {
        tracker.columns =
            oldColumns;

        oldCells.forEach(item => {
            const row =
                tracker.rows.find(
                    currentRow =>
                        currentRow.id ===
                        item.rowId
                );

            if (row) {
                row.cells[columnId] =
                    item.value;
            }
        });

        render();

        showToast(
            "Failed to delete column",
            "error"
        );
    }
}


// ============================================================
// ADD ROW
// ============================================================

async function addRow() {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const row = {
        id: generateId(),
        cells: {}
    };

    tracker.columns.forEach(column => {
        row.cells[column.id] =
            column.type === "checkbox"
                ? false
                : "";
    });

    tracker.rows.push(row);

    render();

    try {
        await saveTracker(tracker);

    } catch (error) {
        tracker.rows =
            tracker.rows.filter(
                item =>
                    item.id !== row.id
            );

        render();

        showToast(
            "Failed to add row",
            "error"
        );
    }
}


// ============================================================
// DELETE ROW
// ============================================================

async function deleteRow(rowId) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const rowIndex =
        tracker.rows.findIndex(
            row =>
                row.id === rowId
        );

    if (rowIndex === -1) return;

    if (!confirm("Delete this row?")) {
        return;
    }

    const deletedRow =
        tracker.rows[rowIndex];

    tracker.rows.splice(
        rowIndex,
        1
    );

    render();

    try {
        await saveTracker(tracker);

        showToast("Row deleted");

    } catch (error) {
        tracker.rows.splice(
            rowIndex,
            0,
            deletedRow
        );

        render();

        showToast(
            "Failed to delete row",
            "error"
        );
    }
}


// ============================================================
// UPDATE TEXT / DATE CELL
// ============================================================

async function updateCell(
    rowId,
    columnId,
    value
) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const row =
        tracker.rows.find(
            item =>
                item.id === rowId
        );

    if (!row) return;

    const oldValue =
        row.cells[columnId];

    row.cells[columnId] =
        value;

    try {
        await saveTracker(tracker);

    } catch (error) {
        row.cells[columnId] =
            oldValue;

        render();

        showToast(
            "Failed to save change",
            "error"
        );
    }
}


// ============================================================
// UPDATE CHECKBOX
// ============================================================

async function updateCheckbox(
    rowId,
    columnId,
    checked
) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const row =
        tracker.rows.find(
            item =>
                item.id === rowId
        );

    if (!row) return;

    const oldValue =
        row.cells[columnId];

    row.cells[columnId] =
        checked;

    try {
        await saveTracker(tracker);

    } catch (error) {
        row.cells[columnId] =
            oldValue;

        render();

        showToast(
            "Failed to save checkbox",
            "error"
        );
    }
}


// ============================================================
// DUPLICATE TRACKER
// ============================================================

async function duplicateTracker() {
    const tracker = getActiveTracker();

    if (!tracker) return;

    const duplicate = clone(tracker);
    duplicate.id = generateId();
    duplicate.name = uniqueTrackerName(`${tracker.name} Copy`);

    if (duplicate.type === "notes") {
        duplicate.cards = (duplicate.cards || []).map(card => ({
            ...card,
            id: generateId(),
            title: String(card.title ?? "NOTE"),
            html: String(card.html ?? ""),
            text: String(card.text ?? ""),
            color: ["red", "yellow", "green"].includes(card.color) ? card.color : ""
        }));
    } else {
        duplicate.type = "tracker";
        duplicate.columns = (duplicate.columns || []).map(column => ({
            ...column,
            id: generateId()
        }));

        const oldColumns = tracker.columns || [];
        const columnMap = {};
        oldColumns.forEach((column, index) => {
            if (duplicate.columns[index]) {
                columnMap[column.id] = duplicate.columns[index].id;
            }
        });

        duplicate.rows = (duplicate.rows || []).map(row => {
            const cells = {};
            Object.entries(row.cells || {}).forEach(([oldId, value]) => {
                const newId = columnMap[oldId];
                if (newId) cells[newId] = value;
            });
            return { id: generateId(), cells };
        });
    }

    data.trackers.push(duplicate);
    activeTrackerId = duplicate.id;
    render();

    try {
        await saveTracker(duplicate);
        showToast(tracker.type === "notes" ? "Notes duplicated" : "Tracker duplicated");
    } catch (error) {
        data.trackers = data.trackers.filter(item => item.id !== duplicate.id);
        activeTrackerId = tracker.id;
        render();
        showToast("Failed to duplicate", "error");
    }
}


// ============================================================
// COLUMN MENU
// ============================================================

function toggleColumnMenu(columnId) {
    const menu =
        document.getElementById(
            `column-menu-${columnId}`
        );

    if (!menu) return;

    document
        .querySelectorAll(".column-menu")
        .forEach(item => {
            if (item !== menu) {
                item.classList.remove("show");
            }
        });

    menu.classList.toggle("show");
}


document.addEventListener(
    "click",
    event => {
        if (
            !event.target.closest(
                ".column-header"
            )
        ) {
            document
                .querySelectorAll(".column-menu")
                .forEach(menu => {
                    menu.classList.remove(
                        "show"
                    );
                });
        }
    }
);


// ============================================================
// EXPORT CURRENT SHEET
// ============================================================

function exportCurrentTracker() {
    const tracker =
        getActiveTracker();

    if (!tracker) {
        showToast(
            "No tracker selected",
            "error"
        );
        return;
    }

    downloadJSON(
        JSON.stringify(
            tracker,
            null,
            2
        ),
        `${sanitizeFileName(tracker.name)}.json`
    );

    showToast(
        `"${tracker.name}" exported`
    );
}


// ============================================================
// IMPORT CURRENT SHEET
// ============================================================

async function importCurrentTracker(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        const imported = JSON.parse(text);

        let sourceTracker = imported;

        if (imported && Array.isArray(imported.trackers)) {
            if (imported.trackers.length !== 1) {
                throw new Error("This is a full backup. Use Import All instead.");
            }
            sourceTracker = imported.trackers[0];
        }

        const normalized = normalizeTracker(sourceTracker);
        const importedTracker = clone(normalized);
        importedTracker.id = generateId();
        importedTracker.name = uniqueTrackerName(normalized.name);

        if (importedTracker.type === "notes") {
            importedTracker.cards = (normalized.cards || []).map(card => ({
                ...card,
                id: generateId(),
                title: String(card.title ?? "NOTE"),
                html: String(card.html ?? ""),
                text: String(card.text ?? ""),
                color: ["red", "yellow", "green"].includes(card.color) ? card.color : ""
            }));
        } else {
            importedTracker.type = "tracker";
            importedTracker.columns = normalized.columns.map(column => ({
                id: generateId(),
                name: column.name,
                type: column.type
            }));

            const columnMap = {};
            normalized.columns.forEach((oldColumn, index) => {
                columnMap[oldColumn.id] = importedTracker.columns[index].id;
            });

            importedTracker.rows = normalized.rows.map(row => {
                const cells = {};
                normalized.columns.forEach(column => {
                    const newColumnId = columnMap[column.id];
                    let value = row.cells?.[column.id];

                    if (column.type === "checkbox") {
                        value = value === true;
                    } else if (value === undefined || value === null) {
                        value = "";
                    }

                    cells[newColumnId] = value;
                });

                return { id: generateId(), cells };
            });
        }

        if (!confirm(`Import "${importedTracker.name}" as a new sheet?`)) return;

        data.trackers.push(importedTracker);
        activeTrackerId = importedTracker.id;

        await saveTracker(importedTracker);
        render();
        showToast(`"${importedTracker.name}" imported`);
    } catch (error) {
        console.error("Sheet import failed:", error);
        showToast(error.message || "Invalid tracker JSON", "error");
    } finally {
        event.target.value = "";
    }
}


// ============================================================
// EXPORT ALL
// ============================================================

function exportJSON() {
    downloadJSON(
        JSON.stringify(
            data,
            null,
            2
        ),
        "tracker-backup.json"
    );

    showToast(
        "All trackers exported"
    );
}


// ============================================================
// IMPORT ALL
// ============================================================

async function importJSON(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    try {
        const text =
            await file.text();

        const imported =
            JSON.parse(text);

        if (
            !imported ||
            !Array.isArray(
                imported.trackers
            )
        ) {
            throw new Error(
                "Invalid tracker backup"
            );
        }

        if (!confirm(
            "Importing the full backup will replace your current trackers. Continue?"
        )) {
            return;
        }

        const normalizedTrackers =
            imported.trackers.map(
                normalizeTracker
            );

        if (
            normalizedTrackers.length === 0
        ) {
            normalizedTrackers.push(
                createDefaultTracker()
            );
        }

        /*
         * Remove existing Firestore trackers
         * before writing the imported set.
         */
        const existingIds =
            data.trackers.map(
                tracker => tracker.id
            );

        for (
            const trackerId of existingIds
        ) {
            try {
                await removeTracker(
                    trackerId
                );
            } catch (error) {
                console.warn(
                    "Could not remove old tracker:",
                    trackerId,
                    error
                );
            }
        }

        data.trackers =
            normalizedTrackers;

        activeTrackerId =
            data.trackers[0].id;

        for (
            const tracker of data.trackers
        ) {
            await saveTracker(tracker);
        }

        render();

        showToast(
            "All trackers imported successfully"
        );

    } catch (error) {
        console.error(
            "Import failed:",
            error
        );

        showToast(
            error.message ||
            "Invalid JSON file",
            "error"
        );

    } finally {
        event.target.value = "";
    }
}


// ============================================================
// EXPOSE FUNCTIONS TO INLINE HTML HANDLERS
// ============================================================

window.toggleTheme =
    toggleTheme;

window.exportJSON =
    exportJSON;

window.importJSON =
    importJSON;

window.exportCurrentTracker =
    exportCurrentTracker;

window.importCurrentTracker =
    importCurrentTracker;

window.addTracker =
    addTracker;

window.deleteTracker =
    deleteTracker;

window.selectTracker =
    selectTracker;

window.renameTracker =
    renameTracker;

window.addColumn =
    addColumn;

window.renameColumn =
    renameColumn;

window.deleteColumn =
    deleteColumn;

window.addRow =
    addRow;

window.deleteRow =
    deleteRow;

window.updateCell =
    updateCell;

window.updateCheckbox =
    updateCheckbox;

window.updateCellLinkButton =
    updateCellLinkButton;

window.duplicateTracker =
    duplicateTracker;

window.toggleColumnMenu =
    toggleColumnMenu;

window.addNoteCard =
    addNoteCard;

window.setNoteCardColor =
    setNoteCardColor;

window.formatNote =
    formatNote;

window.formatNoteColor =
    formatNoteColor;

window.formatNoteLink =
    formatNoteLink;

window.updateNoteCard =
    updateNoteCard;

window.updateNoteCardTitle =
    updateNoteCardTitle;

window.updateNoteCard =
    updateNoteCard;

window.updateNoteCardTitle =
    updateNoteCardTitle;

window.deleteNoteCard =
    deleteNoteCard;


// ============================================================
// START APPLICATION
// ============================================================

initialize();
