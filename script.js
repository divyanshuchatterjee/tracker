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
// FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const trackersCollection = collection(db, "trackers");

console.log("Firebase initialized successfully");


// ============================================================
// APP STATE
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


// ============================================================
// TOAST
// ============================================================

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


// ============================================================
// THEME
// ============================================================

function initializeTheme() {
    const theme = localStorage.getItem("trackerTheme");

    if (theme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}

function toggleTheme() {
    document.body.classList.toggle("dark-mode");

    const isDark =
        document.body.classList.contains("dark-mode");

    localStorage.setItem(
        "trackerTheme",
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
    const column1 = generateId();
    const status = generateId();
    const notes = generateId();
    const done = generateId();

    return {
        id: generateId(),

        name: "My Tracker",

        columns: [
            {
                id: column1,
                name: "Column 1",
                type: "text"
            },
            {
                id: status,
                name: "Status",
                type: "checkbox"
            },
            {
                id: notes,
                name: "Notes",
                type: "text"
            },
            {
                id: done,
                name: "Done",
                type: "checkbox"
            }
        ],

        rows: [
            {
                id: generateId(),

                cells: {
                    [column1]: "",
                    [status]: false,
                    [notes]: "",
                    [done]: false
                }
            }
        ]
    };
}


// ============================================================
// FIRESTORE
// ============================================================

async function saveTracker(tracker) {
    await setDoc(
        doc(db, "trackers", tracker.id),
        tracker
    );

    console.log(
        "Saved tracker:",
        tracker.name
    );
}

async function removeTracker(trackerId) {
    await deleteDoc(
        doc(db, "trackers", trackerId)
    );

    console.log(
        "Deleted tracker:",
        trackerId
    );
}

async function loadTrackers() {
    const snapshot =
        await getDocs(trackersCollection);

    data.trackers = snapshot.docs.map(
        snapshotDoc => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        })
    );

    console.log(
        `Loaded ${data.trackers.length} tracker(s)`
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initialize() {
    initializeTheme();

    try {

        console.log(
            "Signing in anonymously..."
        );

        await signInAnonymously(auth);

        console.log(
            "Firebase anonymous authentication successful"
        );

        console.log(
            "User ID:",
            auth.currentUser.uid
        );


        await loadTrackers();


        // ----------------------------------------------------
        // If Firestore is empty, migrate local data if present
        // ----------------------------------------------------

        if (data.trackers.length === 0) {

            const localData =
                localStorage.getItem("trackerData");

            if (localData) {

                try {

                    const parsed =
                        JSON.parse(localData);

                    if (
                        parsed &&
                        Array.isArray(parsed.trackers) &&
                        parsed.trackers.length > 0
                    ) {

                        data = parsed;

                        for (
                            const tracker
                            of data.trackers
                        ) {
                            await saveTracker(tracker);
                        }

                        console.log(
                            "Local data migrated to Firestore"
                        );

                        showToast(
                            "Existing data migrated to Firebase"
                        );
                    }

                } catch (error) {

                    console.error(
                        "Migration failed:",
                        error
                    );
                }
            }
        }


        // ----------------------------------------------------
        // Still empty → create default tracker
        // ----------------------------------------------------

        if (data.trackers.length === 0) {

            const tracker =
                createDefaultTracker();

            data.trackers = [tracker];

            await saveTracker(tracker);

            console.log(
                "Default tracker created"
            );
        }


        // ----------------------------------------------------
        // Select tracker
        // ----------------------------------------------------

        activeTrackerId =
            data.trackers[0].id;

        render();

    } catch (error) {

        console.error(
            "Firebase initialization failed:",
            error
        );

        showToast(
            "Could not connect to Firebase",
            "error"
        );


        // Fallback to localStorage

        const localData =
            localStorage.getItem("trackerData");

        if (localData) {

            try {

                data =
                    JSON.parse(localData);

                if (
                    data.trackers.length > 0
                ) {
                    activeTrackerId =
                        data.trackers[0].id;
                }

                render();

            } catch (localError) {

                console.error(
                    "Local data error:",
                    localError
                );
            }

        } else {

            const tracker =
                createDefaultTracker();

            data.trackers = [tracker];

            activeTrackerId =
                tracker.id;

            render();
        }
    }
}


// ============================================================
// RENDER
// ============================================================

function render() {
    renderTrackerList();
    renderMain();
}

function renderTrackerList() {
    const list =
        document.getElementById("trackerList");

    if (!list) return;

    list.innerHTML = "";

    data.trackers.forEach(tracker => {

        const item =
            document.createElement("div");

        item.className =
            `tracker-item ${
                tracker.id === activeTrackerId
                    ? "active"
                    : ""
            }`;

        item.onclick = () => {
            selectTracker(tracker.id);
        };

        item.innerHTML = `
            <span class="tracker-item-name">
                ${escapeHTML(tracker.name)}
            </span>
        `;

        list.appendChild(item);
    });
}

function renderMain() {
    const container =
        document.getElementById("mainContent");

    if (!container) return;

    const tracker =
        getActiveTracker();

    if (!tracker) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No tracker selected</h2>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="tracker-header">

            <div class="tracker-header-left">

                <h1>
                    ${escapeHTML(tracker.name)}
                </h1>

                <button
                    class="icon-button small"
                    onclick="renameTracker()"
                    title="Rename tracker"
                >
                    ✎
                </button>

            </div>

            <div class="tracker-header-actions">

                <button
                    class="secondary-button"
                    onclick="duplicateTracker()"
                >
                    Duplicate
                </button>

                <button
                    class="danger-button"
                    onclick="deleteTracker()"
                >
                    Delete
                </button>

            </div>

        </div>

        <div class="table-wrapper">

            <table>

                <thead>
                    <tr>

                        ${tracker.columns
                            .map(renderHeader)
                            .join("")}

                        <th class="row-actions-header">
                            <button
                                class="add-column-button"
                                onclick="addColumn()"
                                title="Add column"
                            >
                                +
                            </button>
                        </th>

                    </tr>
                </thead>

                <tbody>

                    ${
                        tracker.rows.length === 0
                            ? `
                                <tr>
                                    <td
                                        colspan="${
                                            tracker.columns.length + 1
                                        }"
                                        class="empty-row"
                                    >
                                        No rows yet.
                                    </td>
                                </tr>
                              `
                            :
                              tracker.rows
                                .map(renderRow)
                                .join("")
                    }

                </tbody>

            </table>

        </div>

        <button
            class="add-row-button"
            onclick="addRow()"
        >
            + Add Row
        </button>
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

                <div class="column-menu-wrapper">

                    <button
                        type="button"
                        class="column-menu-button"
                        onclick="event.stopPropagation(); toggleColumnMenu('${column.id}')"
                        title="Column options"
                    >
                        ⋮
                    </button>

                    <div
                        id="column-menu-${column.id}"
                        class="column-menu"
                        onclick="event.stopPropagation()"
                    >
                        <button
                            type="button"
                            onclick="renameColumn('${column.id}')"
                        >
                            Rename
                        </button>

                        <button
                            type="button"
                            onclick="deleteColumn('${column.id}')"
                        >
                            Delete
                        </button>
                    </div>

                </div>

            </div>
        </th>
    `;
}


// ============================================================
// ROW
// ============================================================

function renderRow(row) {

    const tracker =
        getActiveTracker();

    return `
        <tr>

            ${tracker.columns
                .map(column =>
                    renderCell(row, column)
                )
                .join("")}

            <td class="row-actions">

                <button
                    class="delete-row-button"
                    onclick="deleteRow('${row.id}')"
                    title="Delete row"
                >
                    ×
                </button>

            </td>

        </tr>
    `;
}


// ============================================================
// CELL
// ============================================================

function renderCell(row, column) {

    const value =
        row.cells?.[column.id] ?? "";

    // ============================================================
    // CHECKBOX
    // ============================================================

    if (column.type === "checkbox") {

        const checked =
            value === true;

        return `
            <td class="checkbox-cell">

                <label class="custom-checkbox">

                    <input
                        type="checkbox"
                        ${checked ? "checked" : ""}
                        onchange="
                            updateCheckbox(
                                '${row.id}',
                                '${column.id}',
                                this.checked
                            )
                        "
                    >

                    <span class="checkmark"></span>

                </label>

            </td>
        `;
    }


    // ============================================================
    // DATE
    // ============================================================

    if (column.type === "date") {

        return `
            <td>

                <input
                    class="cell-input"
                    type="date"
                    value="${escapeAttribute(value)}"
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


    // ============================================================
    // TEXT
    // ============================================================

    return `
        <td>

            <input
                class="cell-input"
                type="text"
                value="${escapeAttribute(value)}"
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


// ============================================================
// TRACKER OPERATIONS
// ============================================================

async function addTracker() {

    const tracker = {

        id: generateId(),

        name:
            `Tracker ${data.trackers.length + 1}`,

        columns: [
            {
                id: generateId(),
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

        rows: []
    };


    data.trackers.push(tracker);

    activeTrackerId =
        tracker.id;

    render();


    try {

        await saveTracker(tracker);

        showToast(
            "Tracker created"
        );

    } catch (error) {

        data.trackers =
            data.trackers.filter(
                item =>
                    item.id !== tracker.id
            );

        activeTrackerId =
            data.trackers[0]?.id ?? null;

        render();
    }
}


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


    if (
        !confirm(
            `Delete "${tracker.name}"?`
        )
    ) {
        return;
    }


    const index =
        data.trackers.findIndex(
            item =>
                item.id === tracker.id
        );


    data.trackers.splice(
        index,
        1
    );


    activeTrackerId =
        data.trackers[
            Math.max(0, index - 1)
        ].id;


    render();


    try {

        await removeTracker(
            tracker.id
        );

        showToast(
            "Tracker deleted"
        );

    } catch (error) {

        data.trackers.splice(
            index,
            0,
            tracker
        );

        activeTrackerId =
            tracker.id;

        render();
    }
}


function selectTracker(trackerId) {

    activeTrackerId =
        trackerId;

    render();
}


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

        await saveTracker(tracker);

        showToast(
            "Tracker renamed"
        );

    } catch (error) {

        tracker.name =
            oldName;

        render();
    }
}


// ============================================================
// COLUMN OPERATIONS
// ============================================================

async function addColumn() {
    const tracker = getActiveTracker();

    if (!tracker) return;

    const name = prompt("Enter column name:");

    if (name === null || !name.trim()) {
        return;
    }

    const typeChoice = prompt(
        "Column type:\n\n1 = Text\n2 = Checkbox\n3 = Date",
        "1"
    );

    if (
        typeChoice !== "1" &&
        typeChoice !== "2" &&
        typeChoice !== "3"
    ) {
        return;
    }

    const column = {
        id: generateId(),
        name: name.trim(),
        type:
            typeChoice === "2"
                ? "checkbox"
                : typeChoice === "3"
                    ? "date"
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
        await saveTracker(tracker);

        showToast("Column added");

    } catch (error) {

        console.error(
            "Failed to add column:",
            error
        );

        tracker.columns =
            tracker.columns.filter(
                item => item.id !== column.id
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


    const name =
        prompt(
            "Enter column name:",
            column.name
        );


    if (
        name === null ||
        !name.trim()
    ) {
        return;
    }


    const oldName =
        column.name;

    column.name =
        name.trim();


    render();


    try {

        await saveTracker(tracker);

        showToast(
            "Column renamed"
        );

    } catch (error) {

        column.name =
            oldName;

        render();
    }
}


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
            item =>
                item.id === columnId
        );

    if (!column) return;


    if (
        !confirm(
            `Delete column "${column.name}"?`
        )
    ) {
        return;
    }


    const oldColumns =
        [...tracker.columns];


    const oldValues =
        tracker.rows.map(row => ({
            rowId: row.id,
            value: row.cells[columnId]
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

        showToast(
            "Column deleted"
        );

    } catch (error) {

        tracker.columns =
            oldColumns;


        oldValues.forEach(item => {

            const row =
                tracker.rows.find(
                    r =>
                        r.id === item.rowId
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
// ROW OPERATIONS
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
    }
}


async function deleteRow(rowId) {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const index =
        tracker.rows.findIndex(
            row =>
                row.id === rowId
        );


    if (index === -1) return;


    const deletedRow =
        tracker.rows[index];


    tracker.rows.splice(
        index,
        1
    );


    render();


    try {

        await saveTracker(tracker);

    } catch (error) {

        tracker.rows.splice(
            index,
            0,
            deletedRow
        );

        render();
    }
}


// ============================================================
// CELL UPDATES
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
    }
}


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
    }
}


// ============================================================
// DUPLICATE TRACKER
// ============================================================

async function duplicateTracker() {

    const tracker =
        getActiveTracker();

    if (!tracker) return;


    const duplicate = {

        id: generateId(),

        name:
            `${tracker.name} Copy`,

        columns:
            JSON.parse(
                JSON.stringify(
                    tracker.columns
                )
            ),

        rows:
            JSON.parse(
                JSON.stringify(
                    tracker.rows
                )
            )
    };


    data.trackers.push(
        duplicate
    );

    activeTrackerId =
        duplicate.id;


    render();


    try {

        await saveTracker(
            duplicate
        );

        showToast(
            "Tracker duplicated"
        );

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
                item.classList.remove(
                    "show"
                );
            }
        });


    menu.classList.toggle(
        "show"
    );
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
                .querySelectorAll(
                    ".column-menu"
                )
                .forEach(menu => {

                    menu.classList.remove(
                        "show"
                    );
                });
        }
    }
);


// ============================================================
// JSON EXPORT
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
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;
    link.download =
        "tracker-backup.json";


    document.body.appendChild(
        link
    );

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


    showToast(
        "JSON exported"
    );
}


// ============================================================
// JSON IMPORT
// ============================================================

async function importJSON(event) {

    const file =
        event.target.files[0];

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
                "Invalid tracker data"
            );
        }


        if (
            !confirm(
                "Importing will replace your current trackers. Continue?"
            )
        ) {
            event.target.value = "";
            return;
        }


        data =
            imported;


        if (
            data.trackers.length === 0
        ) {

            data.trackers = [
                createDefaultTracker()
            ];
        }


        activeTrackerId =
            data.trackers[0].id;


        for (
            const tracker
            of data.trackers
        ) {

            await saveTracker(
                tracker
            );
        }


        render();


        showToast(
            "JSON imported successfully"
        );

    } catch (error) {

        console.error(
            "Import failed:",
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
// GLOBAL FUNCTIONS
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


// ============================================================
// START
// ============================================================

initialize();
