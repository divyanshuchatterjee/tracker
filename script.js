import { firebaseConfig } from "./firebase-config.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

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


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const trackersCollection = collection(db, "trackers");

console.log("Firebase initialized successfully");
console.log("Firestore:", db);


// ============================================================
// APPLICATION STATE
// ============================================================

let data = {
    trackers: []
};

let activeTrackerId = null;


// ============================================================
// ID GENERATOR
// ============================================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}


// ============================================================
// THEME
// ============================================================

function initializeTheme() {
    const savedTheme = localStorage.getItem("trackerTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}


function toggleTheme() {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");

    localStorage.setItem(
        "trackerTheme",
        isDark ? "dark" : "light"
    );

    updateThemeButton();
}


function updateThemeButton() {
    const button = document.getElementById("themeToggle");

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
    const columnId = generateId();

    return {
        id: generateId(),

        name: "My Tracker",

        columns: [
            {
                id: columnId,
                name: "Column 1",
                type: "text"
            },
            {
                id: generateId(),
                name: "Status",
                type: "checkbox"
            },
            {
                id: generateId(),
                name: "Notes",
                type: "text"
            },
            {
                id: generateId(),
                name: "Done",
                type: "checkbox"
            }
        ],

        rows: [
            {
                id: generateId(),

                cells: {
                    [columnId]: ""
                }
            }
        ]
    };
}


// ============================================================
// FIRESTORE HELPERS
// ============================================================

async function saveTrackerToFirestore(tracker) {
    try {
        await setDoc(
            doc(db, "trackers", tracker.id),
            tracker
        );

        console.log(
            `Tracker "${tracker.name}" saved to Firestore`
        );

    } catch (error) {
        console.error(
            "Error saving tracker to Firestore:",
            error
        );

        showToast(
            "Failed to save changes to Firebase",
            "error"
        );

        throw error;
    }
}


async function deleteTrackerFromFirestore(trackerId) {
    try {
        await deleteDoc(
            doc(db, "trackers", trackerId)
        );

        console.log(
            `Tracker "${trackerId}" deleted from Firestore`
        );

    } catch (error) {
        console.error(
            "Error deleting tracker:",
            error
        );

        showToast(
            "Failed to delete tracker from Firebase",
            "error"
        );

        throw error;
    }
}


// ============================================================
// LOAD DATA FROM FIRESTORE
// ============================================================

async function loadDataFromFirestore() {

    console.log("Loading trackers from Firestore...");

    const snapshot = await getDocs(trackersCollection);

    const trackers = [];

    snapshot.forEach((documentSnapshot) => {

        trackers.push({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        });

    });

    data.trackers = trackers;

    console.log(
        `Loaded ${trackers.length} tracker(s) from Firestore`
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initialize() {

    initializeTheme();

    try {

        // ----------------------------------------------------
        // Sign in anonymously before accessing Firestore
        // ----------------------------------------------------

        await signInAnonymously(auth);

        console.log(
            "Firebase anonymous authentication successful"
        );

        console.log(
            "User ID:",
            auth.currentUser.uid
        );

        // ----------------------------------------------------
        // Try loading from Firestore
        // ----------------------------------------------------

        await loadDataFromFirestore();


        // ----------------------------------------------------
        // If Firestore is empty, check old localStorage data
        // ----------------------------------------------------

        if (data.trackers.length === 0) {

            const oldLocalData =
                localStorage.getItem("trackerData");

            if (oldLocalData) {

                console.log(
                    "Found existing localStorage data."
                );

                try {

                    const parsedData =
                        JSON.parse(oldLocalData);

                    if (
                        parsedData &&
                        Array.isArray(parsedData.trackers) &&
                        parsedData.trackers.length > 0
                    ) {

                        data = parsedData;

                        console.log(
                            "Migrating localStorage data to Firestore..."
                        );

                        for (const tracker of data.trackers) {
                            await saveTrackerToFirestore(tracker);
                        }

                        console.log(
                            "Migration completed successfully."
                        );

                        showToast(
                            "Your existing data was migrated to Firebase"
                        );

                    }

                } catch (error) {

                    console.error(
                        "Could not migrate localStorage data:",
                        error
                    );

                }

            }


            // ------------------------------------------------
            // If still empty, create default tracker
            // ------------------------------------------------

            if (data.trackers.length === 0) {

                const defaultTracker =
                    createDefaultTracker();

                data.trackers = [
                    defaultTracker
                ];

                await saveTrackerToFirestore(
                    defaultTracker
                );

                console.log(
                    "Created default tracker in Firestore."
                );
            }
        }


        // ----------------------------------------------------
        // Select first tracker
        // ----------------------------------------------------

        if (
            !activeTrackerId ||
            !data.trackers.some(
                tracker => tracker.id === activeTrackerId
            )
        ) {

            activeTrackerId =
                data.trackers[0].id;
        }


        render();

    } catch (error) {

        console.error(
            "Failed to initialize application:",
            error
        );

        showToast(
            "Could not connect to Firebase",
            "error"
        );

        // ----------------------------------------------------
        // Fallback to localStorage
        // ----------------------------------------------------

        const savedData =
            localStorage.getItem("trackerData");

        if (savedData) {

            try {

                data = JSON.parse(savedData);

                if (data.trackers.length > 0) {
                    activeTrackerId =
                        data.trackers[0].id;
                }

                render();

            } catch (localError) {

                console.error(
                    "Local data also failed:",
                    localError
                );
            }

        } else {

            data = {
                trackers: [
                    createDefaultTracker()
                ]
            };

            activeTrackerId =
                data.trackers[0].id;

            render();
        }
    }
}


// ============================================================
// GET ACTIVE TRACKER
// ============================================================

function getActiveTracker() {

    return data.trackers.find(
        tracker =>
            tracker.id === activeTrackerId
    );
}


// ============================================================
// TOAST
// ============================================================

function showToast(message, type = "success") {

    const toast =
        document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.className =
        `toast ${type}`;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// ============================================================
// RENDER
// ============================================================

function render() {

    renderTrackerList();
    renderMain();
}


// ============================================================
// TRACKER LIST
// ============================================================

function renderTrackerList() {

    const container =
        document.getElementById("trackerList");

    if (!container) return;

    container.innerHTML = "";

    data.trackers.forEach(tracker => {

        const item =
            document.createElement("div");

        item.className =
            "tracker-item" +
            (
                tracker.id === activeTrackerId
                    ? " active"
                    : ""
            );

        item.onclick = () =>
            selectTracker(tracker.id);

        item.innerHTML = `
            <span class="tracker-item-name">
                ${escapeHTML(tracker.name)}
            </span>
        `;

        container.appendChild(item);
    });
}


// ============================================================
// MAIN
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
        renderNotesMain(container, tracker);
        return;
    }

    container.innerHTML = `
        <div class="tracker-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(tracker.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename tracker">✎</button>
            </div>
            <div class="tracker-actions">
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="tracker-table">
                <thead>
                    <tr>
                        ${tracker.columns.map(column => renderHeader(column)).join("")}
                        <th class="row-actions-header">
                            <button class="add-column-button" onclick="addColumn()" title="Add column">+</button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${tracker.rows.length === 0
                        ? `<tr><td colspan="${tracker.columns.length + 1}" class="empty-row">No rows yet.</td></tr>`
                        : tracker.rows.map(row => `
                            <tr>
                                ${tracker.columns.map(column => renderCell(row, column)).join("")}
                                <td class="row-actions">
                                    <button class="delete-row-button" onclick="deleteRow('${row.id}')" title="Delete row">×</button>
                                </td>
                            </tr>
                        `).join("")
                    }
                </tbody>
            </table>
        </div>

        <button class="add-row-button" onclick="addRow()">+ Add Row</button>
    `;
}

function renderNotesMain(container, notes) {
    container.innerHTML = `
        <div class="tracker-header notes-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(notes.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename notes">✎</button>
            </div>
            <div class="tracker-actions">
                <button class="secondary-button" onclick="addNoteCard()">+ Add Note</button>
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="notes-grid">
            ${notes.cards?.length
                ? notes.cards.map(card => renderNoteCard(notes, card)).join("")
                : `<div class="notes-empty"><div class="notes-empty-icon">📝</div><h2>No notes yet</h2><p>Click <strong>+ Add Note</strong> to create your first note.</p></div>`
            }
        </div>
    `;
}

function renderNoteCard(notes, card) {
    const color = card.color || "default";
    const content = card.content || "";
    return `
        <article class="note-card note-card-${escapeAttribute(color)}" data-note-id="${escapeAttribute(card.id)}">
            <div class="note-card-topbar">
                <input class="note-title-input" value="${escapeAttribute(card.title || "NOTE")}" aria-label="Note title"
                    onchange="updateNoteTitle('${card.id}', this.value)">
                <div class="note-card-actions">
                    <button class="note-icon-button" onclick="toggleNoteColorMenu('${card.id}')" title="Change card color">●</button>
                    <button class="note-icon-button" onclick="deleteNoteCard('${card.id}')" title="Delete note">×</button>
                </div>
            </div>
            <div id="note-color-menu-${card.id}" class="note-color-menu">
                <button class="note-color-choice matte-red" onclick="setNoteColor('${card.id}','red')">Red</button>
                <button class="note-color-choice matte-yellow" onclick="setNoteColor('${card.id}','yellow')">Yellow</button>
                <button class="note-color-choice matte-green" onclick="setNoteColor('${card.id}','green')">Green</button>
                <button class="note-color-choice matte-default" onclick="setNoteColor('${card.id}','default')">Default</button>
            </div>
            <div class="note-toolbar" onmousedown="event.preventDefault()">
                <button onclick="formatNote('bold')" title="Bold"><b>B</b></button>
                <button onclick="formatNote('italic')" title="Italic"><i>I</i></button>
                <button onclick="formatNote('underline')" title="Underline"><u>U</u></button>
                <button onclick="formatNote('strikeThrough')" title="Strikethrough"><s>S</s></button>
                <button onclick="formatNote('insertUnorderedList')" title="Bulleted list">•</button>
                <button onclick="formatNote('insertOrderedList')" title="Numbered list">1.</button>
                <button onclick="formatNote('createLink')" title="Insert link">↗</button>
                <select onchange="setNoteTextColor(this.value); this.value=''" title="Text color">
                    <option value="">A</option>
                    <option value="#222222">Black</option>
                    <option value="#b42318">Red</option>
                    <option value="#175cd3">Blue</option>
                    <option value="#087443">Green</option>
                    <option value="#6941c6">Purple</option>
                </select>
            </div>
            <div class="note-content" contenteditable="true" spellcheck="true"
                 data-note-id="${escapeAttribute(card.id)}"
                 oninput="updateNoteContent('${card.id}', this.innerHTML)">${content}</div>
        </article>
    `;
}


// ============================================================
// HEADER
// ============================================================

function renderHeader(column) {

    return `

        <th>

            <div class="column-header">

                <span>
                    ${escapeHTML(column.name)}
                </span>

                <button
                    class="column-menu-button"
                    onclick="toggleColumnMenu('${column.id}')"
                >
                    ⋮
                </button>

                <div
                    id="column-menu-${column.id}"
                    class="column-menu"
                >

                    <button
                        onclick="renameColumn('${column.id}')"
                    >
                        Rename
                    </button>

                    <button
                        onclick="deleteColumn('${column.id}')"
                    >
                        Delete
                    </button>

                </div>

            </div>

        </th>
    `;
}


// ============================================================
// CELL
// ============================================================

function renderCell(row, column) {

    const value =
        row.cells?.[column.id] ?? "";

    if (column.type === "checkbox") {

        const checked =
            value === true;

        return `

            <td class="checkbox-cell">

                <label class="custom-checkbox">

                    <input
                        type="checkbox"
                        ${checked ? "checked" : ""}
                        onchange="updateCheckbox(
                            '${row.id}',
                            '${column.id}',
                            this.checked
                        )"
                    >

                    <span class="checkmark"></span>

                </label>

            </td>

        `;

    }


    return `

        <td>

            <input
                class="cell-input"
                type="text"
                value="${escapeAttribute(value)}"
                onchange="updateCell(
                    '${row.id}',
                    '${column.id}',
                    this.value
                )"
            >

        </td>

    `;
}


// ============================================================
// SAVE CURRENT TRACKER
// ============================================================

async function saveCurrentTracker() {

    const tracker =
        getActiveTracker();

    if (!tracker) return;

    await saveTrackerToFirestore(tracker);
}


// ============================================================
// ADD TRACKER
// ============================================================

async function addTracker() {
    const createNotes = confirm("Create a Notes sheet?\n\nOK = Notes\nCancel = Tracker");

    const item = createNotes
        ? {
            id: generateId(),
            type: "notes",
            name: `Notes ${data.trackers.filter(t => t.type === "notes").length + 1}`,
            cards: []
        }
        : {
            id: generateId(),
            type: "tracker",
            name: `Tracker ${data.trackers.filter(t => t.type !== "notes").length + 1}`,
            columns: [
                { id: generateId(), name: "Column 1", type: "text" },
                { id: generateId(), name: "Status", type: "checkbox" },
                { id: generateId(), name: "Notes", type: "text" },
                { id: generateId(), name: "Done", type: "checkbox" }
            ],
            rows: []
        };

    data.trackers.push(item);
    activeTrackerId = item.id;
    render();

    try {
        await saveTrackerToFirestore(item);
        showToast(createNotes ? "Notes created" : "Tracker created");
    } catch (error) {
        data.trackers = data.trackers.filter(t => t.id !== item.id);
        activeTrackerId = data.trackers[0]?.id ?? null;
        render();
    }
}

// ============================================================
// NOTES
// ============================================================

async function addNoteCard() {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = {
        id: generateId(),
        title: "NOTE",
        content: "",
        color: "default"
    };

    if (!Array.isArray(notes.cards)) notes.cards = [];
    notes.cards.push(card);
    render();

    const cardElement = document.querySelector(`[data-note-id="${card.id}"] .note-content`);
    if (cardElement) cardElement.focus();

    try {
        await saveTrackerToFirestore(notes);
        showToast("Note added");
    } catch (error) {
        notes.cards = notes.cards.filter(c => c.id !== card.id);
        render();
    }
}

async function updateNoteTitle(cardId, value) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.title = value.trim() || "NOTE";
    await saveTrackerToFirestore(notes);
}

async function updateNoteContent(cardId, html) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.content = html;
    try { await saveTrackerToFirestore(notes); } catch (_) {}
}

async function setNoteColor(cardId, color) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.color = color;
    render();
    await saveTrackerToFirestore(notes);
}

function toggleNoteColorMenu(cardId) {
    document.querySelectorAll(".note-color-menu.show").forEach(menu => menu.classList.remove("show"));
    const menu = document.getElementById(`note-color-menu-${cardId}`);
    if (menu) menu.classList.toggle("show");
}

function formatNote(command) {
    if (command === "createLink") {
        const url = prompt("Enter URL:");
        if (!url) return;
        document.execCommand("createLink", false, url);
    } else {
        document.execCommand(command, false, null);
    }
    const active = document.querySelector(".note-content:focus");
    if (active) {
        const cardId = active.dataset.noteId;
        updateNoteContent(cardId, active.innerHTML);
    }
}

function setNoteTextColor(color) {
    if (!color) return;
    document.execCommand("foreColor", false, color);
    const active = document.querySelector(".note-content:focus");
    if (active) updateNoteContent(active.dataset.noteId, active.innerHTML);
}

async function deleteNoteCard(cardId) {
    const notes = getActiveTracker();
    if (!notes?.cards) return;
    if (!confirm("Delete this note?")) return;

    notes.cards = notes.cards.filter(card => card.id !== cardId);
    render();
    await saveTrackerToFirestore(notes);
    showToast("Note deleted");
}


// ============================================================
// DELETE TRACKER
// ============================================================

async function deleteTracker() {

    if (data.trackers.length <= 1) {

        showToast(
            "You must keep at least one tracker",
            "error"
        );

        return;
    }


    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const confirmed =
        confirm(
            `Delete "${tracker.name}"?`
        );

    if (!confirmed) return;


    const oldIndex =
        data.trackers.findIndex(
            item => item.id === tracker.id
        );


    data.trackers =
        data.trackers.filter(
            item => item.id !== tracker.id
        );


    activeTrackerId =
        data.trackers[
            Math.max(
                0,
                oldIndex - 1
            )
        ].id;


    render();


    try {

        await deleteTrackerFromFirestore(
            tracker.id
        );

        showToast("Tracker deleted");

    } catch (error) {

        // Restore tracker if deletion failed
        data.trackers.splice(
            oldIndex,
            0,
            tracker
        );

        activeTrackerId =
            tracker.id;

        render();
    }
}


// ============================================================
// SELECT TRACKER
// ============================================================

function selectTracker(trackerId) {

    activeTrackerId =
        trackerId;

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
            "Enter tracker name:",
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

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Tracker renamed");

    } catch (error) {

        tracker.name =
            oldName;

        render();
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
        prompt(
            "Enter column name:"
        );


    if (
        name === null ||
        !name.trim()
    ) {
        return;
    }


    const typeChoice =
        prompt(
            "Column type:\n\n1 = Text\n2 = Checkbox",
            "1"
        );


    if (
        typeChoice !== "1" &&
        typeChoice !== "2"
    ) {
        return;
    }


    const column = {

        id: generateId(),

        name: name.trim(),

        type:
            typeChoice === "2"
                ? "checkbox"
                : "text"

    };


    tracker.columns.push(column);


    // Give existing rows a default value
    tracker.rows.forEach(row => {

        row.cells[column.id] =
            column.type === "checkbox"
                ? false
                : "";

    });


    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column added");

    } catch (error) {

        tracker.columns =
            tracker.columns.filter(
                item => item.id !== column.id
            );

        tracker.rows.forEach(row => {
            delete row.cells[column.id];
        });

        render();
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
            item => item.id === columnId
        );

    if (!column) return;


    const newName =
        prompt(
            "Enter column name:",
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

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column renamed");

    } catch (error) {

        column.name =
            oldName;

        render();
    }
}


// ============================================================
// DELETE COLUMN
// ============================================================

async function deleteColumn(columnId) {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    if (tracker.columns.length <= 1) {

        showToast(
            "You must keep at least one column",
            "error"
        );

        return;
    }


    const column =
        tracker.columns.find(
            item => item.id === columnId
        );

    if (!column) return;


    const confirmed =
        confirm(
            `Delete column "${column.name}"?`
        );

    if (!confirmed) return;


    const oldColumns =
        [...tracker.columns];


    const oldCells =
        tracker.rows.map(row => ({
            rowId: row.id,
            value: row.cells[columnId]
        }));


    tracker.columns =
        tracker.columns.filter(
            item => item.id !== columnId
        );


    tracker.rows.forEach(row => {
        delete row.cells[columnId];
    });


    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column deleted");

    } catch (error) {

        tracker.columns =
            oldColumns;

        oldCells.forEach(item => {

            const row =
                tracker.rows.find(
                    r => r.id === item.rowId
                );

            if (row) {
                row.cells[columnId] =
                    item.value;
            }
        });

        render();
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

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        tracker.rows =
            tracker.rows.filter(
                item => item.id !== row.id
            );

        render();
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
            row => row.id === rowId
        );

    if (rowIndex === -1) return;


    const deletedRow =
        tracker.rows[rowIndex];


    tracker.rows.splice(
        rowIndex,
        1
    );

    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        tracker.rows.splice(
            rowIndex,
            0,
            deletedRow
        );

        render();
    }
}


// ============================================================
// UPDATE TEXT CELL
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
            item => item.id === rowId
        );

    if (!row) return;


    const oldValue =
        row.cells[columnId];


    row.cells[columnId] =
        value;


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        row.cells[columnId] =
            oldValue;

        render();
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
            item => item.id === rowId
        );

    if (!row) return;


    const oldValue =
        row.cells[columnId];


    row.cells[columnId] =
        checked;


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        row.cells[columnId] =
            oldValue;

        render();
    }
}


// ============================================================
// DUPLICATE TRACKER
// ============================================================

async function duplicateTracker() {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const duplicate = JSON.parse(JSON.stringify(tracker));
    duplicate.id = generateId();
    duplicate.name = `${tracker.name} Copy`;


    data.trackers.push(
        duplicate
    );

    activeTrackerId =
        duplicate.id;

    render();


    try {

        await saveTrackerToFirestore(
            duplicate
        );

        showToast("Tracker duplicated");

    } catch (error) {

        data.trackers =
            data.trackers.filter(
                item =>
                    item.id !== duplicate.id
            );

        activeTrackerId =
            tracker.id;

        render();
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


// Close menus when clicking elsewhere
document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".column-header"
            )
        ) {

            document
                .querySelectorAll(
                    ".column-menu"
                )
                .forEach(menu =>
                    menu.classList.remove(
                        "show"
                    )
                );
        }
    }
);


// ============================================================
// EXPORT JSON
// ============================================================

function exportJSON() {

    const json =
        JSON.stringify(
            data,
            null,
            2
        );


    const blob =
        new Blob(
            [json],
            {
                type: "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "tracker-backup.json";

    a.click();


    URL.revokeObjectURL(url);

    showToast("JSON exported");
}


// ============================================================
// IMPORT JSON
// ============================================================

async function importJSON(event) {

    const file =
        event.target.files[0];

    if (!file) return;


    try {

        const text =
            await file.text();

        const importedData =
            JSON.parse(text);


        if (
            !importedData ||
            !Array.isArray(
                importedData.trackers
            )
        ) {

            throw new Error(
                "Invalid tracker JSON"
            );
        }


        const confirmed =
            confirm(
                "Importing will replace your current trackers. Continue?"
            );

        if (!confirmed) {
            event.target.value = "";
            return;
        }


        data =
            importedData;


        if (data.trackers.length === 0) {

            data.trackers = [
                createDefaultTracker()
            ];
        }


        activeTrackerId =
            data.trackers[0].id;


        // Save all imported trackers
        for (
            const tracker of data.trackers
        ) {

            await saveTrackerToFirestore(
                tracker
            );
        }


        render();

        showToast(
            "JSON imported successfully"
        );

    } catch (error) {

        console.error(
            "Import error:",
            error
        );

        showToast(
            "Invalid JSON file",
            "error"
        );

    } finally {

        event.target.value = "";
    }
}


// ============================================================
// HTML ESCAPING
// ============================================================

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


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.toggleTheme =
    toggleTheme;

window.exportJSON =
    exportJSON;

window.importJSON =
    importJSON;

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

window.duplicateTracker =
    duplicateTracker;

window.toggleColumnMenu =
    toggleColumnMenu;

window.addNoteCard =
    addNoteCard;

window.updateNoteTitle =
    updateNoteTitle;

window.updateNoteContent =
    updateNoteContent;

window.setNoteColor =
    setNoteColor;

window.toggleNoteColorMenu =
    toggleNoteColorMenu;

window.formatNote =
    formatNote;

window.setNoteTextColor =
    setNoteTextColor;

window.deleteNoteCard =
    deleteNoteCard;


// ============================================================
// START APPLICATION
// ============================================================

initialize();import { firebaseConfig } from "./firebase-config.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

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


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const trackersCollection = collection(db, "trackers");

console.log("Firebase initialized successfully");
console.log("Firestore:", db);


// ============================================================
// APPLICATION STATE
// ============================================================

let data = {
    trackers: []
};

let activeTrackerId = null;


// ============================================================
// ID GENERATOR
// ============================================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}


// ============================================================
// THEME
// ============================================================

function initializeTheme() {
    const savedTheme = localStorage.getItem("trackerTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}


function toggleTheme() {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");

    localStorage.setItem(
        "trackerTheme",
        isDark ? "dark" : "light"
    );

    updateThemeButton();
}


function updateThemeButton() {
    const button = document.getElementById("themeToggle");

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
    const columnId = generateId();

    return {
        id: generateId(),

        name: "My Tracker",

        columns: [
            {
                id: columnId,
                name: "Column 1",
                type: "text"
            },
            {
                id: generateId(),
                name: "Status",
                type: "checkbox"
            },
            {
                id: generateId(),
                name: "Notes",
                type: "text"
            },
            {
                id: generateId(),
                name: "Done",
                type: "checkbox"
            }
        ],

        rows: [
            {
                id: generateId(),

                cells: {
                    [columnId]: ""
                }
            }
        ]
    };
}


// ============================================================
// FIRESTORE HELPERS
// ============================================================

async function saveTrackerToFirestore(tracker) {
    try {
        await setDoc(
            doc(db, "trackers", tracker.id),
            tracker
        );

        console.log(
            `Tracker "${tracker.name}" saved to Firestore`
        );

    } catch (error) {
        console.error(
            "Error saving tracker to Firestore:",
            error
        );

        showToast(
            "Failed to save changes to Firebase",
            "error"
        );

        throw error;
    }
}


async function deleteTrackerFromFirestore(trackerId) {
    try {
        await deleteDoc(
            doc(db, "trackers", trackerId)
        );

        console.log(
            `Tracker "${trackerId}" deleted from Firestore`
        );

    } catch (error) {
        console.error(
            "Error deleting tracker:",
            error
        );

        showToast(
            "Failed to delete tracker from Firebase",
            "error"
        );

        throw error;
    }
}


// ============================================================
// LOAD DATA FROM FIRESTORE
// ============================================================

async function loadDataFromFirestore() {

    console.log("Loading trackers from Firestore...");

    const snapshot = await getDocs(trackersCollection);

    const trackers = [];

    snapshot.forEach((documentSnapshot) => {

        trackers.push({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        });

    });

    data.trackers = trackers;

    console.log(
        `Loaded ${trackers.length} tracker(s) from Firestore`
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initialize() {

    initializeTheme();

    try {

        // ----------------------------------------------------
        // Sign in anonymously before accessing Firestore
        // ----------------------------------------------------

        await signInAnonymously(auth);

        console.log(
            "Firebase anonymous authentication successful"
        );

        console.log(
            "User ID:",
            auth.currentUser.uid
        );

        // ----------------------------------------------------
        // Try loading from Firestore
        // ----------------------------------------------------

        await loadDataFromFirestore();


        // ----------------------------------------------------
        // If Firestore is empty, check old localStorage data
        // ----------------------------------------------------

        if (data.trackers.length === 0) {

            const oldLocalData =
                localStorage.getItem("trackerData");

            if (oldLocalData) {

                console.log(
                    "Found existing localStorage data."
                );

                try {

                    const parsedData =
                        JSON.parse(oldLocalData);

                    if (
                        parsedData &&
                        Array.isArray(parsedData.trackers) &&
                        parsedData.trackers.length > 0
                    ) {

                        data = parsedData;

                        console.log(
                            "Migrating localStorage data to Firestore..."
                        );

                        for (const tracker of data.trackers) {
                            await saveTrackerToFirestore(tracker);
                        }

                        console.log(
                            "Migration completed successfully."
                        );

                        showToast(
                            "Your existing data was migrated to Firebase"
                        );

                    }

                } catch (error) {

                    console.error(
                        "Could not migrate localStorage data:",
                        error
                    );

                }

            }


            // ------------------------------------------------
            // If still empty, create default tracker
            // ------------------------------------------------

            if (data.trackers.length === 0) {

                const defaultTracker =
                    createDefaultTracker();

                data.trackers = [
                    defaultTracker
                ];

                await saveTrackerToFirestore(
                    defaultTracker
                );

                console.log(
                    "Created default tracker in Firestore."
                );
            }
        }


        // ----------------------------------------------------
        // Select first tracker
        // ----------------------------------------------------

        if (
            !activeTrackerId ||
            !data.trackers.some(
                tracker => tracker.id === activeTrackerId
            )
        ) {

            activeTrackerId =
                data.trackers[0].id;
        }


        render();

    } catch (error) {

        console.error(
            "Failed to initialize application:",
            error
        );

        showToast(
            "Could not connect to Firebase",
            "error"
        );

        // ----------------------------------------------------
        // Fallback to localStorage
        // ----------------------------------------------------

        const savedData =
            localStorage.getItem("trackerData");

        if (savedData) {

            try {

                data = JSON.parse(savedData);

                if (data.trackers.length > 0) {
                    activeTrackerId =
                        data.trackers[0].id;
                }

                render();

            } catch (localError) {

                console.error(
                    "Local data also failed:",
                    localError
                );
            }

        } else {

            data = {
                trackers: [
                    createDefaultTracker()
                ]
            };

            activeTrackerId =
                data.trackers[0].id;

            render();
        }
    }
}


// ============================================================
// GET ACTIVE TRACKER
// ============================================================

function getActiveTracker() {

    return data.trackers.find(
        tracker =>
            tracker.id === activeTrackerId
    );
}


// ============================================================
// TOAST
// ============================================================

function showToast(message, type = "success") {

    const toast =
        document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.className =
        `toast ${type}`;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// ============================================================
// RENDER
// ============================================================

function render() {

    renderTrackerList();
    renderMain();
}


// ============================================================
// TRACKER LIST
// ============================================================

function renderTrackerList() {

    const container =
        document.getElementById("trackerList");

    if (!container) return;

    container.innerHTML = "";

    data.trackers.forEach(tracker => {

        const item =
            document.createElement("div");

        item.className =
            "tracker-item" +
            (
                tracker.id === activeTrackerId
                    ? " active"
                    : ""
            );

        item.onclick = () =>
            selectTracker(tracker.id);

        item.innerHTML = `
            <span class="tracker-item-name">
                ${escapeHTML(tracker.name)}
            </span>
        `;

        container.appendChild(item);
    });
}


// ============================================================
// MAIN
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
        renderNotesMain(container, tracker);
        return;
    }

    container.innerHTML = `
        <div class="tracker-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(tracker.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename tracker">✎</button>
            </div>
            <div class="tracker-actions">
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="tracker-table">
                <thead>
                    <tr>
                        ${tracker.columns.map(column => renderHeader(column)).join("")}
                        <th class="row-actions-header">
                            <button class="add-column-button" onclick="addColumn()" title="Add column">+</button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${tracker.rows.length === 0
                        ? `<tr><td colspan="${tracker.columns.length + 1}" class="empty-row">No rows yet.</td></tr>`
                        : tracker.rows.map(row => `
                            <tr>
                                ${tracker.columns.map(column => renderCell(row, column)).join("")}
                                <td class="row-actions">
                                    <button class="delete-row-button" onclick="deleteRow('${row.id}')" title="Delete row">×</button>
                                </td>
                            </tr>
                        `).join("")
                    }
                </tbody>
            </table>
        </div>

        <button class="add-row-button" onclick="addRow()">+ Add Row</button>
    `;
}

function renderNotesMain(container, notes) {
    container.innerHTML = `
        <div class="tracker-header notes-header">
            <div class="tracker-title-row">
                <h1>${escapeHTML(notes.name)}</h1>
                <button class="icon-button small" onclick="renameTracker()" title="Rename notes">✎</button>
            </div>
            <div class="tracker-actions">
                <button class="secondary-button" onclick="addNoteCard()">+ Add Note</button>
                <button class="secondary-button" onclick="duplicateTracker()">Duplicate</button>
                <button class="danger-button" onclick="deleteTracker()">Delete</button>
            </div>
        </div>

        <div class="notes-grid">
            ${notes.cards?.length
                ? notes.cards.map(card => renderNoteCard(notes, card)).join("")
                : `<div class="notes-empty"><div class="notes-empty-icon">📝</div><h2>No notes yet</h2><p>Click <strong>+ Add Note</strong> to create your first note.</p></div>`
            }
        </div>
    `;
}

function renderNoteCard(notes, card) {
    const color = card.color || "default";
    const content = card.content || "";
    return `
        <article class="note-card note-card-${escapeAttribute(color)}" data-note-id="${escapeAttribute(card.id)}">
            <div class="note-card-topbar">
                <input class="note-title-input" value="${escapeAttribute(card.title || "NOTE")}" aria-label="Note title"
                    onchange="updateNoteTitle('${card.id}', this.value)">
                <div class="note-card-actions">
                    <button class="note-icon-button" onclick="toggleNoteColorMenu('${card.id}')" title="Change card color">●</button>
                    <button class="note-icon-button" onclick="deleteNoteCard('${card.id}')" title="Delete note">×</button>
                </div>
            </div>
            <div id="note-color-menu-${card.id}" class="note-color-menu">
                <button class="note-color-choice matte-red" onclick="setNoteColor('${card.id}','red')">Red</button>
                <button class="note-color-choice matte-yellow" onclick="setNoteColor('${card.id}','yellow')">Yellow</button>
                <button class="note-color-choice matte-green" onclick="setNoteColor('${card.id}','green')">Green</button>
                <button class="note-color-choice matte-default" onclick="setNoteColor('${card.id}','default')">Default</button>
            </div>
            <div class="note-toolbar" onmousedown="event.preventDefault()">
                <button onclick="formatNote('bold')" title="Bold"><b>B</b></button>
                <button onclick="formatNote('italic')" title="Italic"><i>I</i></button>
                <button onclick="formatNote('underline')" title="Underline"><u>U</u></button>
                <button onclick="formatNote('strikeThrough')" title="Strikethrough"><s>S</s></button>
                <button onclick="formatNote('insertUnorderedList')" title="Bulleted list">•</button>
                <button onclick="formatNote('insertOrderedList')" title="Numbered list">1.</button>
                <button onclick="formatNote('createLink')" title="Insert link">↗</button>
                <select onchange="setNoteTextColor(this.value); this.value=''" title="Text color">
                    <option value="">A</option>
                    <option value="#222222">Black</option>
                    <option value="#b42318">Red</option>
                    <option value="#175cd3">Blue</option>
                    <option value="#087443">Green</option>
                    <option value="#6941c6">Purple</option>
                </select>
            </div>
            <div class="note-content" contenteditable="true" spellcheck="true"
                 data-note-id="${escapeAttribute(card.id)}"
                 oninput="updateNoteContent('${card.id}', this.innerHTML)">${content}</div>
        </article>
    `;
}


// ============================================================
// HEADER
// ============================================================

function renderHeader(column) {

    return `

        <th>

            <div class="column-header">

                <span>
                    ${escapeHTML(column.name)}
                </span>

                <button
                    class="column-menu-button"
                    onclick="toggleColumnMenu('${column.id}')"
                >
                    ⋮
                </button>

                <div
                    id="column-menu-${column.id}"
                    class="column-menu"
                >

                    <button
                        onclick="renameColumn('${column.id}')"
                    >
                        Rename
                    </button>

                    <button
                        onclick="deleteColumn('${column.id}')"
                    >
                        Delete
                    </button>

                </div>

            </div>

        </th>
    `;
}


// ============================================================
// CELL
// ============================================================

function renderCell(row, column) {

    const value =
        row.cells?.[column.id] ?? "";

    if (column.type === "checkbox") {

        const checked =
            value === true;

        return `

            <td class="checkbox-cell">

                <label class="custom-checkbox">

                    <input
                        type="checkbox"
                        ${checked ? "checked" : ""}
                        onchange="updateCheckbox(
                            '${row.id}',
                            '${column.id}',
                            this.checked
                        )"
                    >

                    <span class="checkmark"></span>

                </label>

            </td>

        `;

    }


    return `

        <td>

            <input
                class="cell-input"
                type="text"
                value="${escapeAttribute(value)}"
                onchange="updateCell(
                    '${row.id}',
                    '${column.id}',
                    this.value
                )"
            >

        </td>

    `;
}


// ============================================================
// SAVE CURRENT TRACKER
// ============================================================

async function saveCurrentTracker() {

    const tracker =
        getActiveTracker();

    if (!tracker) return;

    await saveTrackerToFirestore(tracker);
}


// ============================================================
// ADD TRACKER
// ============================================================

async function addTracker() {
    const createNotes = confirm("Create a Notes sheet?\n\nOK = Notes\nCancel = Tracker");

    const item = createNotes
        ? {
            id: generateId(),
            type: "notes",
            name: `Notes ${data.trackers.filter(t => t.type === "notes").length + 1}`,
            cards: []
        }
        : {
            id: generateId(),
            type: "tracker",
            name: `Tracker ${data.trackers.filter(t => t.type !== "notes").length + 1}`,
            columns: [
                { id: generateId(), name: "Column 1", type: "text" },
                { id: generateId(), name: "Status", type: "checkbox" },
                { id: generateId(), name: "Notes", type: "text" },
                { id: generateId(), name: "Done", type: "checkbox" }
            ],
            rows: []
        };

    data.trackers.push(item);
    activeTrackerId = item.id;
    render();

    try {
        await saveTrackerToFirestore(item);
        showToast(createNotes ? "Notes created" : "Tracker created");
    } catch (error) {
        data.trackers = data.trackers.filter(t => t.id !== item.id);
        activeTrackerId = data.trackers[0]?.id ?? null;
        render();
    }
}

// ============================================================
// NOTES
// ============================================================

async function addNoteCard() {
    const notes = getActiveTracker();
    if (!notes || notes.type !== "notes") return;

    const card = {
        id: generateId(),
        title: "NOTE",
        content: "",
        color: "default"
    };

    if (!Array.isArray(notes.cards)) notes.cards = [];
    notes.cards.push(card);
    render();

    const cardElement = document.querySelector(`[data-note-id="${card.id}"] .note-content`);
    if (cardElement) cardElement.focus();

    try {
        await saveTrackerToFirestore(notes);
        showToast("Note added");
    } catch (error) {
        notes.cards = notes.cards.filter(c => c.id !== card.id);
        render();
    }
}

async function updateNoteTitle(cardId, value) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.title = value.trim() || "NOTE";
    await saveTrackerToFirestore(notes);
}

async function updateNoteContent(cardId, html) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.content = html;
    try { await saveTrackerToFirestore(notes); } catch (_) {}
}

async function setNoteColor(cardId, color) {
    const notes = getActiveTracker();
    const card = notes?.cards?.find(c => c.id === cardId);
    if (!card) return;
    card.color = color;
    render();
    await saveTrackerToFirestore(notes);
}

function toggleNoteColorMenu(cardId) {
    document.querySelectorAll(".note-color-menu.show").forEach(menu => menu.classList.remove("show"));
    const menu = document.getElementById(`note-color-menu-${cardId}`);
    if (menu) menu.classList.toggle("show");
}

function formatNote(command) {
    if (command === "createLink") {
        const url = prompt("Enter URL:");
        if (!url) return;
        document.execCommand("createLink", false, url);
    } else {
        document.execCommand(command, false, null);
    }
    const active = document.querySelector(".note-content:focus");
    if (active) {
        const cardId = active.dataset.noteId;
        updateNoteContent(cardId, active.innerHTML);
    }
}

function setNoteTextColor(color) {
    if (!color) return;
    document.execCommand("foreColor", false, color);
    const active = document.querySelector(".note-content:focus");
    if (active) updateNoteContent(active.dataset.noteId, active.innerHTML);
}

async function deleteNoteCard(cardId) {
    const notes = getActiveTracker();
    if (!notes?.cards) return;
    if (!confirm("Delete this note?")) return;

    notes.cards = notes.cards.filter(card => card.id !== cardId);
    render();
    await saveTrackerToFirestore(notes);
    showToast("Note deleted");
}


// ============================================================
// DELETE TRACKER
// ============================================================

async function deleteTracker() {

    if (data.trackers.length <= 1) {

        showToast(
            "You must keep at least one tracker",
            "error"
        );

        return;
    }


    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const confirmed =
        confirm(
            `Delete "${tracker.name}"?`
        );

    if (!confirmed) return;


    const oldIndex =
        data.trackers.findIndex(
            item => item.id === tracker.id
        );


    data.trackers =
        data.trackers.filter(
            item => item.id !== tracker.id
        );


    activeTrackerId =
        data.trackers[
            Math.max(
                0,
                oldIndex - 1
            )
        ].id;


    render();


    try {

        await deleteTrackerFromFirestore(
            tracker.id
        );

        showToast("Tracker deleted");

    } catch (error) {

        // Restore tracker if deletion failed
        data.trackers.splice(
            oldIndex,
            0,
            tracker
        );

        activeTrackerId =
            tracker.id;

        render();
    }
}


// ============================================================
// SELECT TRACKER
// ============================================================

function selectTracker(trackerId) {

    activeTrackerId =
        trackerId;

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
            "Enter tracker name:",
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

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Tracker renamed");

    } catch (error) {

        tracker.name =
            oldName;

        render();
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
        prompt(
            "Enter column name:"
        );


    if (
        name === null ||
        !name.trim()
    ) {
        return;
    }


    const typeChoice =
        prompt(
            "Column type:\n\n1 = Text\n2 = Checkbox",
            "1"
        );


    if (
        typeChoice !== "1" &&
        typeChoice !== "2"
    ) {
        return;
    }


    const column = {

        id: generateId(),

        name: name.trim(),

        type:
            typeChoice === "2"
                ? "checkbox"
                : "text"

    };


    tracker.columns.push(column);


    // Give existing rows a default value
    tracker.rows.forEach(row => {

        row.cells[column.id] =
            column.type === "checkbox"
                ? false
                : "";

    });


    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column added");

    } catch (error) {

        tracker.columns =
            tracker.columns.filter(
                item => item.id !== column.id
            );

        tracker.rows.forEach(row => {
            delete row.cells[column.id];
        });

        render();
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
            item => item.id === columnId
        );

    if (!column) return;


    const newName =
        prompt(
            "Enter column name:",
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

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column renamed");

    } catch (error) {

        column.name =
            oldName;

        render();
    }
}


// ============================================================
// DELETE COLUMN
// ============================================================

async function deleteColumn(columnId) {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    if (tracker.columns.length <= 1) {

        showToast(
            "You must keep at least one column",
            "error"
        );

        return;
    }


    const column =
        tracker.columns.find(
            item => item.id === columnId
        );

    if (!column) return;


    const confirmed =
        confirm(
            `Delete column "${column.name}"?`
        );

    if (!confirmed) return;


    const oldColumns =
        [...tracker.columns];


    const oldCells =
        tracker.rows.map(row => ({
            rowId: row.id,
            value: row.cells[columnId]
        }));


    tracker.columns =
        tracker.columns.filter(
            item => item.id !== columnId
        );


    tracker.rows.forEach(row => {
        delete row.cells[columnId];
    });


    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

        showToast("Column deleted");

    } catch (error) {

        tracker.columns =
            oldColumns;

        oldCells.forEach(item => {

            const row =
                tracker.rows.find(
                    r => r.id === item.rowId
                );

            if (row) {
                row.cells[columnId] =
                    item.value;
            }
        });

        render();
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

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        tracker.rows =
            tracker.rows.filter(
                item => item.id !== row.id
            );

        render();
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
            row => row.id === rowId
        );

    if (rowIndex === -1) return;


    const deletedRow =
        tracker.rows[rowIndex];


    tracker.rows.splice(
        rowIndex,
        1
    );

    render();


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        tracker.rows.splice(
            rowIndex,
            0,
            deletedRow
        );

        render();
    }
}


// ============================================================
// UPDATE TEXT CELL
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
            item => item.id === rowId
        );

    if (!row) return;


    const oldValue =
        row.cells[columnId];


    row.cells[columnId] =
        value;


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        row.cells[columnId] =
            oldValue;

        render();
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
            item => item.id === rowId
        );

    if (!row) return;


    const oldValue =
        row.cells[columnId];


    row.cells[columnId] =
        checked;


    try {

        await saveTrackerToFirestore(
            tracker
        );

    } catch (error) {

        row.cells[columnId] =
            oldValue;

        render();
    }
}


// ============================================================
// DUPLICATE TRACKER
// ============================================================

async function duplicateTracker() {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const duplicate = JSON.parse(JSON.stringify(tracker));
    duplicate.id = generateId();
    duplicate.name = `${tracker.name} Copy`;


    data.trackers.push(
        duplicate
    );

    activeTrackerId =
        duplicate.id;

    render();


    try {

        await saveTrackerToFirestore(
            duplicate
        );

        showToast("Tracker duplicated");

    } catch (error) {

        data.trackers =
            data.trackers.filter(
                item =>
                    item.id !== duplicate.id
            );

        activeTrackerId =
            tracker.id;

        render();
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


// Close menus when clicking elsewhere
document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".column-header"
            )
        ) {

            document
                .querySelectorAll(
                    ".column-menu"
                )
                .forEach(menu =>
                    menu.classList.remove(
                        "show"
                    )
                );
        }
    }
);


// ============================================================
// EXPORT JSON
// ============================================================

function exportJSON() {

    const json =
        JSON.stringify(
            data,
            null,
            2
        );


    const blob =
        new Blob(
            [json],
            {
                type: "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "tracker-backup.json";

    a.click();


    URL.revokeObjectURL(url);

    showToast("JSON exported");
}


// ============================================================
// IMPORT JSON
// ============================================================

async function importJSON(event) {

    const file =
        event.target.files[0];

    if (!file) return;


    try {

        const text =
            await file.text();

        const importedData =
            JSON.parse(text);


        if (
            !importedData ||
            !Array.isArray(
                importedData.trackers
            )
        ) {

            throw new Error(
                "Invalid tracker JSON"
            );
        }


        const confirmed =
            confirm(
                "Importing will replace your current trackers. Continue?"
            );

        if (!confirmed) {
            event.target.value = "";
            return;
        }


        data =
            importedData;


        if (data.trackers.length === 0) {

            data.trackers = [
                createDefaultTracker()
            ];
        }


        activeTrackerId =
            data.trackers[0].id;


        // Save all imported trackers
        for (
            const tracker of data.trackers
        ) {

            await saveTrackerToFirestore(
                tracker
            );
        }


        render();

        showToast(
            "JSON imported successfully"
        );

    } catch (error) {

        console.error(
            "Import error:",
            error
        );

        showToast(
            "Invalid JSON file",
            "error"
        );

    } finally {

        event.target.value = "";
    }
}


// ============================================================
// HTML ESCAPING
// ============================================================

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


// ============================================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ============================================================

window.toggleTheme =
    toggleTheme;

window.exportJSON =
    exportJSON;

window.importJSON =
    importJSON;

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

window.duplicateTracker =
    duplicateTracker;

window.toggleColumnMenu =
    toggleColumnMenu;

window.addNoteCard =
    addNoteCard;

window.updateNoteTitle =
    updateNoteTitle;

window.updateNoteContent =
    updateNoteContent;

window.setNoteColor =
    setNoteColor;

window.toggleNoteColorMenu =
    toggleNoteColorMenu;

window.formatNote =
    formatNote;

window.setNoteTextColor =
    setNoteTextColor;

window.deleteNoteCard =
    deleteNoteCard;


// ============================================================
// START APPLICATION
// ============================================================

initialize();
