// ============================================================
// FIREBASE IMPORTS
// ============================================================

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

import {
    firebaseConfig
} from "./firebase-config.js";


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const trackersCollection =
    collection(db, "trackers");


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
        Math.random()
            .toString(36)
            .substring(2, 9)
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
        tracker =>
            tracker.id === activeTrackerId
    );
}


function showToast(
    message,
    type = "success"
) {
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
// THEME
// ============================================================

function toggleTheme() {
    const body =
        document.body;

    const isDark =
        body.classList.toggle(
            "dark-theme"
        );

    localStorage.setItem(
        "theme",
        isDark ? "dark" : "light"
    );

    const button =
        document.getElementById(
            "themeToggle"
        );

    if (button) {
        button.textContent =
            isDark ? "☀" : "☾";
    }
}


function initializeTheme() {
    const savedTheme =
        localStorage.getItem(
            "theme"
        );

    if (savedTheme === "dark") {
        document.body.classList.add(
            "dark-theme"
        );

        const button =
            document.getElementById(
                "themeToggle"
            );

        if (button) {
            button.textContent = "☀";
        }
    }
}


// ============================================================
// DEFAULT TRACKER
// ============================================================

function createDefaultTracker() {
    const trackerId =
        generateId();

    const columnId =
        generateId();

    return {
        id: trackerId,

        name: "My Tracker",

        columns: [
            {
                id: columnId,
                name: "Task",
                type: "text"
            }
        ],

        rows: []
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


async function removeTracker(
    trackerId
) {
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
        await getDocs(
            trackersCollection
        );

    data.trackers =
        snapshot.docs.map(
            snapshotDoc => ({
                id: snapshotDoc.id,
                ...snapshotDoc.data()
            })
        );
}


// ============================================================
// INITIALIZE
// ============================================================

async function initialize() {
    try {
        initializeTheme();

        await signInAnonymously(
            auth
        );

        await loadTrackers();

        /*
         * If Firestore is empty, try to recover
         * data from old localStorage backup.
         */
        if (
            data.trackers.length === 0
        ) {
            const localData =
                localStorage.getItem(
                    "trackerData"
                );

            if (localData) {
                try {
                    const parsed =
                        JSON.parse(
                            localData
                        );

                    if (
                        parsed &&
                        Array.isArray(
                            parsed.trackers
                        )
                    ) {
                        data =
                            parsed;

                        for (
                            const tracker
                            of data.trackers
                        ) {
                            await saveTracker(
                                tracker
                            );
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
         * Create default tracker if
         * absolutely nothing exists.
         */
        if (
            data.trackers.length === 0
        ) {
            const tracker =
                createDefaultTracker();

            data.trackers.push(
                tracker
            );

            await saveTracker(
                tracker
            );
        }

        activeTrackerId =
            data.trackers[0].id;

        render();

    } catch (error) {
        console.error(
            "Initialization failed:",
            error
        );

        showToast(
            "Failed to load tracker",
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


// ============================================================
// TRACKER LIST
// ============================================================

function renderTrackerList() {
    const container =
        document.getElementById(
            "trackerList"
        );

    if (!container) return;

    container.innerHTML =
        data.trackers
            .map(tracker => {

                const active =
                    tracker.id ===
                    activeTrackerId;

                return `
                    <div
                        class="tracker-item ${
                            active
                                ? "active"
                                : ""
                        }"
                        onclick="selectTracker('${tracker.id}')"
                    >
                        <span class="tracker-item-name">
                            ${escapeHTML(
                                tracker.name
                            )}
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

            <div class="tracker-title-row">

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


            <div class="tracker-actions">

                <button
                    class="secondary-button"
                    onclick="exportCurrentTracker()"
                    title="Export this tracker only"
                >
                    Export Sheet
                </button>


                <label
                    class="secondary-button import-button"
                    title="Import a tracker as a new sheet"
                >
                    Import Sheet

                    <input
                        type="file"
                        accept=".json,application/json"
                        onchange="importCurrentTracker(event)"
                        hidden
                    >
                </label>


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

            <table class="tracker-table">

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
// COLUMN HEADER
// ============================================================

function renderColumnHeader(
    tracker,
    column
) {
    return `
        <th class="column-header">

            <div class="column-header-content">

                <span>
                    ${escapeHTML(
                        column.name
                    )}
                </span>

                <button
                    class="column-menu-button"
                    onclick="event.stopPropagation(); toggleColumnMenu('${column.id}')"
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
// ROW
// ============================================================

function renderRow(
    tracker,
    row
) {
    return `
        <tr>

            ${tracker.columns
                .map(
                    column =>
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
    if (
        column.type ===
        "checkbox"
    ) {
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
    if (
        column.type === "date"
    ) {
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
        stringValue.match(
            urlRegex
        );

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
// UPDATE LINK BUTTON WHILE TYPING
// ============================================================

function updateCellLinkButton(
    input
) {
    if (!input) return;

    const wrapper =
        input.closest(
            ".text-cell-wrapper"
        );

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
        link.href =
            match[0];

        link.style.display =
            "inline-flex";
    } else {
        link.removeAttribute(
            "href"
        );

        link.style.display =
            "none";
    }
}


// ============================================================
// ADD TRACKER
// ============================================================

async function addTracker() {
    const name =
        prompt(
            "Enter tracker name:"
        );

    if (!name || !name.trim()) {
        return;
    }

    const tracker = {
        id: generateId(),

        name: name.trim(),

        columns: [
            {
                id: generateId(),
                name: "Task",
                type: "text"
            }
        ],

        rows: []
    };

    data.trackers.push(
        tracker
    );

    activeTrackerId =
        tracker.id;

    render();

    try {
        await saveTracker(
            tracker
        );

        showToast(
            "Tracker created"
        );

    } catch (error) {
        console.error(error);

        data.trackers =
            data.trackers.filter(
                item =>
                    item.id !==
                    tracker.id
            );

        render();

        showToast(
            "Failed to create tracker",
            "error"
        );
    }
}


// ============================================================
// DELETE TRACKER
// ============================================================

async function deleteTracker() {
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

    const trackerIndex =
        data.trackers.findIndex(
            item =>
                item.id ===
                tracker.id
        );

    data.trackers.splice(
        trackerIndex,
        1
    );

    await removeTracker(
        tracker.id
    );

    if (
        data.trackers.length === 0
    ) {
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
            data.trackers[0].id;
    }

    render();

    showToast(
        "Tracker deleted"
    );
}


// ============================================================
// SELECT TRACKER
// ============================================================

function selectTracker(
    trackerId
) {
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
            "Enter new tracker name:",
            tracker.name
        );

    if (
        !newName ||
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
        await saveTracker(
            tracker
        );

        showToast(
            "Tracker renamed"
        );

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
        prompt(
            "Enter column name:"
        );

    if (
        !name ||
        !name.trim()
    ) {
        return;
    }

    const typeInput =
        prompt(
            "Column type:\n\n1 = Text\n2 = Checkbox\n3 = Date",
            "1"
        );

    let type = "text";

    if (typeInput === "2") {
        type = "checkbox";
    }

    if (typeInput === "3") {
        type = "date";
    }

    const column = {
        id: generateId(),
        name: name.trim(),
        type
    };

    tracker.columns.push(
        column
    );

    tracker.rows.forEach(
        row => {
            row.cells[column.id] =
                type === "checkbox"
                    ? false
                    : "";
        }
    );

    render();

    try {
        await saveTracker(
            tracker
        );

        showToast(
            "Column added"
        );

    } catch (error) {
        console.error(error);

        tracker.columns =
            tracker.columns.filter(
                item =>
                    item.id !==
                    column.id
            );

        tracker.rows.forEach(
            row => {
                delete row.cells[
                    column.id
                ];
            }
        );

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

async function renameColumn(
    columnId
) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const column =
        tracker.columns.find(
            item =>
                item.id ===
                columnId
        );

    if (!column) return;

    const newName =
        prompt(
            "Enter new column name:",
            column.name
        );

    if (
        !newName ||
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
        await saveTracker(
            tracker
        );

        showToast(
            "Column renamed"
        );

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

async function deleteColumn(
    columnId
) {
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
                item.id ===
                columnId
        );

    if (!column) return;

    if (
        !confirm(
            `Delete column "${column.name}"?`
        )
    ) {
        return;
    }

    const columnIndex =
        tracker.columns.findIndex(
            item =>
                item.id ===
                columnId
        );

    tracker.columns.splice(
        columnIndex,
        1
    );

    tracker.rows.forEach(
        row => {
            delete row.cells[
                columnId
            ];
        }
    );

    render();

    try {
        await saveTracker(
            tracker
        );

        showToast(
            "Column deleted"
        );

    } catch (error) {
        console.error(error);

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

    tracker.columns.forEach(
        column => {
            row.cells[column.id] =
                column.type ===
                "checkbox"
                    ? false
                    : "";
        }
    );

    tracker.rows.push(
        row
    );

    render();

    try {
        await saveTracker(
            tracker
        );

    } catch (error) {
        tracker.rows =
            tracker.rows.filter(
                item =>
                    item.id !==
                    row.id
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

async function deleteRow(
    rowId
) {
    const tracker =
        getActiveTracker();

    if (!tracker) return;

    const rowIndex =
        tracker.rows.findIndex(
            row =>
                row.id === rowId
        );

    if (rowIndex === -1) {
        return;
    }

    if (
        !confirm(
            "Delete this row?"
        )
    ) {
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
        await saveTracker(
            tracker
        );

        showToast(
            "Row deleted"
        );

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
            item =>
                item.id === rowId
        );

    if (!row) return;

    const oldValue =
        row.cells[columnId];

    row.cells[columnId] =
        value;

    try {
        await saveTracker(
            tracker
        );

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
        await saveTracker(
            tracker
        );

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
                    item.id !==
                    duplicate.id
            );

        activeTrackerId =
            tracker.id;

        render();

        showToast(
            "Failed to duplicate tracker",
            "error"
        );
    }
}


// ============================================================
// COLUMN MENU
// ============================================================

function toggleColumnMenu(
    columnId
) {
    const menu =
        document.getElementById(
            `column-menu-${columnId}`
        );

    if (!menu) return;

    document
        .querySelectorAll(
            ".column-menu"
        )
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


// ============================================================
// CLOSE COLUMN MENUS
// ============================================================

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
                .forEach(
                    menu =>
                        menu.classList.remove(
                            "show"
                        )
                );
        }

    }
);


// ============================================================
// FILE DOWNLOAD HELPER
// ============================================================

function downloadJSON(
    json,
    filename
) {
    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href = url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(
            url
        );
    }, 100);
}


// ============================================================
// CLEAN FILE NAME
// ============================================================

function sanitizeFileName(
    name
) {
    return String(name || "tracker")
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .substring(0, 100)
        || "tracker";
}


// ============================================================
// EXPORT ALL
// ============================================================

function exportJSON() {
    const json =
        JSON.stringify(
            data,
            null,
            2
        );

    downloadJSON(
        json,
        "tracker-backup.json"
    );

    showToast(
        "All trackers exported"
    );
}


// ============================================================
// IMPORT ALL
// ============================================================

async function importJSON(
    event
) {
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

        const confirmed =
            confirm(
                "Importing the full backup will replace your current trackers. Continue?"
            );

        if (!confirmed) {
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

        /*
         * Save every imported tracker.
         */
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
            "All trackers imported successfully"
        );

    } catch (error) {

        console.error(
            "Import failed:",
            error
        );

        showToast(
            "Invalid tracker backup",
            "error"
        );

    } finally {
        event.target.value = "";
    }
}


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

    const json =
        JSON.stringify(
            tracker,
            null,
            2
        );

    const filename =
        `${sanitizeFileName(
            tracker.name
        )}.json`;

    downloadJSON(
        json,
        filename
    );

    showToast(
        `"${tracker.name}" exported`
    );
}


// ============================================================
// GET UNIQUE TRACKER NAME
// ============================================================

function getUniqueTrackerName(
    originalName
) {
    const baseName =
        String(
            originalName ||
            "Imported Tracker"
        ).trim()
        || "Imported Tracker";

    const existingNames =
        new Set(
            data.trackers.map(
                tracker =>
                    tracker.name
                        .trim()
                        .toLowerCase()
            )
        );

    if (
        !existingNames.has(
            baseName.toLowerCase()
        )
    ) {
        return baseName;
    }

    let counter = 2;

    while (
        existingNames.has(
            `${baseName} (${counter})`
                .toLowerCase()
        )
    ) {
        counter++;
    }

    return `${baseName} (${counter})`;
}


// ============================================================
// VALIDATE IMPORTED SHEET
// ============================================================

function validateTracker(
    tracker
) {
    if (
        !tracker ||
        typeof tracker !==
            "object"
    ) {
        return false;
    }

    if (
        typeof tracker.name !==
        "string"
    ) {
        return false;
    }

    if (
        !Array.isArray(
            tracker.columns
        )
    ) {
        return false;
    }

    if (
        !Array.isArray(
            tracker.rows
        )
    ) {
        return false;
    }

    for (
        const column
        of tracker.columns
    ) {
        if (
            !column ||
            typeof column.id !==
                "string" ||
            typeof column.name !==
                "string"
        ) {
            return false;
        }

        if (
            ![
                "text",
                "checkbox",
                "date"
            ].includes(
                column.type
            )
        ) {
            return false;
        }
    }

    for (
        const row
        of tracker.rows
    ) {
        if (
            !row ||
            typeof row.id !==
                "string" ||
            !row.cells ||
            typeof row.cells !==
                "object"
        ) {
            return false;
        }
    }

    return true;
}


// ============================================================
// IMPORT CURRENT SHEET
// ============================================================

async function importSheetJSON(
    event
) {
    const file =
        event.target.files[0];

    if (!file) return;

    try {
        const text =
            await file.text();

        const parsed =
            JSON.parse(text);

        /*
         * Accept either:
         *
         * 1. Direct tracker JSON
         *
         * {
         *   id,
         *   name,
         *   columns,
         *   rows
         * }
         *
         * 2. A wrapper:
         *
         * {
         *   tracker: {...}
         * }
         */
        let importedTracker =
            parsed;

        if (
            parsed &&
            parsed.tracker &&
            typeof parsed.tracker ===
                "object"
        ) {
            importedTracker =
                parsed.tracker;
        }

        if (
            !validateTracker(
                importedTracker
            )
        ) {
            throw new Error(
                "Invalid sheet JSON"
            );
        }

        /*
         * Deep clone so the imported object
         * is completely independent.
         */
        const tracker =
            JSON.parse(
                JSON.stringify(
                    importedTracker
                )
            );

        /*
         * IMPORTANT:
         *
         * Always generate a new tracker ID.
         * This prevents the imported sheet from
         * overwriting an existing Firestore document.
         */
        tracker.id =
            generateId();

        /*
         * Give the imported tracker a unique
         * sheet name.
         */
        tracker.name =
            getUniqueTrackerName(
                tracker.name
            );

        /*
         * Make sure all rows have cells.
         */
        tracker.rows =
            tracker.rows.map(
                row => ({
                    ...row,
                    id:
                        row.id ||
                        generateId(),
                    cells:
                        row.cells || {}
                })
            );

        data.trackers.push(
            tracker
        );

        activeTrackerId =
            tracker.id;

        /*
         * Render immediately.
         */
        render();

        /*
         * Persist only this imported sheet.
         */
        await saveTracker(
            tracker
        );

        showToast(
            `"${tracker.name}" imported successfully`
        );

    } catch (error) {

        console.error(
            "Sheet import failed:",
            error
        );

        showToast(
            "Invalid sheet JSON file",
            "error"
        );

    } finally {
        /*
         * Reset the file input so the
         * same file can be selected again.
         */
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

window.exportCurrentTracker =
    exportCurrentTracker;

window.importSheetJSON =
    importSheetJSON;

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


// ============================================================
// START APPLICATION
// ============================================================

initialize();
