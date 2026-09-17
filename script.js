"use strict";

/*
 * ThonnyPad
 * Pyodide browser Python IDE
 *
 * Features:
 * - Run editor code
 * - Interactive Python shell
 * - Proper stdout/stderr handling
 * - Python print() newlines preserved
 * - input() support through a browser prompt
 * - Command history
 * - pip install PACKAGE through micropip
 * - Package list persistence
 * - Offline service-worker caching
 * - Editor autosave
 */


/* =========================================
   GLOBAL STATE
   ========================================= */

let pyodide = null;
let pyodideReady = false;

const commandHistory = [];
let historyIndex = 0;


/* =========================================
   DOM ELEMENTS
   ========================================= */

const output =
    document.getElementById("terminal-output");

const input =
    document.getElementById("terminal-input");

const code =
    document.getElementById("code");

const status =
    document.getElementById("status");


/* =========================================
   TERMINAL OUTPUT
   ========================================= */

/*
 * Write text to the terminal.
 *
 * textContent is deliberately used instead
 * of innerHTML so Python output cannot
 * accidentally be interpreted as HTML.
 *
 * white-space: pre-wrap in the CSS preserves
 * Python's \n characters.
 */

function write(text, className = "") {

    if (
        text === null ||
        text === undefined
    ) {
        return;
    }

    const span =
        document.createElement("span");

    span.textContent =
        String(text);

    if (className) {
        span.className =
            className;
    }

    output.appendChild(span);

    output.scrollTop =
        output.scrollHeight;
}


/* =========================================
   CLEAR TERMINAL
   ========================================= */

function clearTerminal() {

    output.textContent = "";

}


/* =========================================
   STATUS
   ========================================= */

function setStatus(text) {

    status.textContent =
        text;

}


/* =========================================
   PYODIDE STDOUT
   ========================================= */

/*
 * IMPORTANT:
 *
 * Use "batched" instead of "raw".
 *
 * Pyodide gives us a complete stdout batch.
 * We don't add or remove newlines ourselves.
 *
 * Therefore:
 *
 *     print("A")
 *     print("B")
 *
 * remains:
 *
 *     A
 *     B
 *
 * And:
 *
 *     print("A", end="")
 *     print("B")
 *
 * remains:
 *
 *     AB
 */

function pythonStdout(text) {

    write(text);

}


/* =========================================
   PYODIDE STDERR
   ========================================= */

function pythonStderr(text) {

    write(
        text,
        "error"
    );

}


/* =========================================
   SERVICE WORKER
   ========================================= */

if (
    "serviceWorker" in navigator
) {

    navigator.serviceWorker
        .register("./sw.js")
        .then(
            registration => {

                console.log(
                    "ThonnyPad service worker registered:",
                    registration.scope
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "Service worker registration failed:",
                    error
                );

                write(
                    "Warning: offline caching is unavailable.\n",
                    "error"
                );

            }
        );

}


/* =========================================
   PYODIDE INITIALIZATION
   ========================================= */

async function initializePython() {

    try {

        pyodideReady =
            false;

        setStatus(
            "Loading Python..."
        );

        write(
            "Loading Pyodide...\n",
            "system"
        );


        /*
         * This URL MUST match the version of
         * pyodide.js loaded in index.html.
         */

        pyodide =
            await loadPyodide({

                indexURL:
                    "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"

            });


        /*
         * Load micropip.
         */

        write(
            "Loading micropip...\n",
            "system"
        );

        await pyodide.loadPackage(
            "micropip"
        );


        /*
         * Connect Python stdout/stderr.
         *
         * Batched output preserves newlines.
         */

        pyodide.setStdout({

            batched:
                pythonStdout

        });


        pyodide.setStderr({

            batched:
                pythonStderr

        });


        /*
         * input() support.
         *
         * Pyodide can use a JavaScript callback
         * for Python's input().
         */

        pyodide.setStdin({

            stdin: function() {

                return window.prompt(
                    "Python input:"
                ) ?? "";

            }

        });


        pyodideReady =
            true;


        setStatus(
            "Python ready"
        );


        write(
            "Python environment ready.\n",
            "success"
        );

        write(
            "Type help() for Python help.\n",
            "system"
        );

        write(
            "Type pip install PACKAGE to install packages.\n\n",
            "system"
        );


        /*
         * Restore previously installed packages.
         */

        await restorePackages();


        input.focus();

    }
    catch (error) {

        console.error(
            error
        );

        pyodideReady =
            false;

        setStatus(
            "Python failed"
        );

        write(
            "\nFailed to load Python:\n" +
            error +
            "\n\n",
            "error"
        );

    }

}


/*
 * Start Python.
 */

initializePython();


/* =========================================
   RUN EDITOR
   ========================================= */

async function runEditor() {

    if (
        !pyodideReady
    ) {

        write(
            "Python is still loading...\n",
            "error"
        );

        return;

    }


    const source =
        code.value;


    if (
        !source.trim()
    ) {

        write(
            "[Nothing to run]\n",
            "error"
        );

        return;

    }


    setStatus(
        "Running..."
    );


    write(
        "\n>>> Running main.py\n",
        "system"
    );


    try {

        /*
         * runPythonAsync allows async Python
         * code as well as normal Python.
         */

        const result =
            await pyodide.runPythonAsync(
                source
            );


        /*
         * If the program explicitly returns
         * something through an expression,
         * don't automatically print it here.
         *
         * Python's print() output already came
         * through stdout.
         */

        void result;


        setStatus(
            "Python ready"
        );

    }
    catch (error) {

        write(
            error.toString() +
            "\n",
            "error"
        );

        setStatus(
            "Python error"
        );

    }

}


/* =========================================
   TERMINAL COMMAND EXECUTION
   ========================================= */

async function executeCommand(
    command
) {

    command =
        command.trim();


    if (
        !command
    ) {

        return;

    }


    /*
     * Save command to history.
     */

    commandHistory.push(
        command
    );

    historyIndex =
        commandHistory.length;


    /*
     * Show command.
     */

    write(
        ">>> " +
        command +
        "\n",
        "command"
    );


    /* -------------------------------------
       CLEAR
       ------------------------------------- */

    if (
        command === "clear"
    ) {

        clearTerminal();

        return;

    }


    /* -------------------------------------
       HELP
       ------------------------------------- */

    if (
        command === "help"
    ) {

        write(
            "ThonnyPad commands:\n\n" +

            "  clear\n" +
            "  help\n" +
            "  restart\n" +
            "  packages\n" +
            "  cache\n" +
            "  pip install PACKAGE\n\n" +

            "Examples:\n\n" +

            "  print('Hello')\n" +
            "  2 + 2\n" +
            "  import math\n" +
            "  math.sqrt(25)\n",

            "system"
        );

        return;

    }


    /* -------------------------------------
       RESTART
       ------------------------------------- */

    if (
        command === "restart"
    ) {

        await restartPython();

        return;

    }


    /* -------------------------------------
       PACKAGES
       ------------------------------------- */

    if (
        command === "packages"
    ) {

        showPackages();

        return;

    }


    /* -------------------------------------
       CACHE
       ------------------------------------- */

    if (
        command === "cache"
    ) {

        await showCacheInfo();

        return;

    }


    /* -------------------------------------
       PIP
       ------------------------------------- */

    if (
        command === "pip" ||
        command.startsWith("pip ")
    ) {

        await handlePip(
            command
        );

        return;

    }


    /* -------------------------------------
       PYTHON
       ------------------------------------- */

    if (
        !pyodideReady
    ) {

        write(
            "Python is not ready yet.\n",
            "error"
        );

        return;

    }


    try {

        /*
         * Evaluate the Python command.
         */

        const result =
            await pyodide.runPythonAsync(
                command
            );


        /*
         * runPythonAsync returns the value of
         * the final expression.
         *
         * This makes:
         *
         *     >>> 2 + 2
         *
         * display:
         *
         *     4
         */

        if (
            result !== undefined &&
            result !== null
        ) {

            write(
                String(result) +
                "\n"
            );

        }

    }
    catch (error) {

        write(
            error.toString() +
            "\n",
            "error"
        );

    }

}


/* =========================================
   PIP COMMAND
   ========================================= */

async function handlePip(
    command
) {

    const parts =
        command.split(
            /\s+/
        );


    /*
     * Require:
     *
     * pip install PACKAGE
     */

    if (
        parts.length < 3 ||
        parts[0] !== "pip" ||
        parts[1] !== "install"
    ) {

        write(
            "Usage: pip install PACKAGE\n",
            "error"
        );

        return;

    }


    const packages =
        parts.slice(2);


    /*
     * Don't pass pip command-line options
     * to micropip.
     */

    if (
        packages.some(
            packageName =>
                packageName.startsWith("-")
        )
    ) {

        write(
            "pip command-line options are not supported yet.\n" +
            "Use:\n\n" +
            "pip install PACKAGE\n",
            "error"
        );

        return;

    }


    await installPackages(
        packages
    );

}


/* =========================================
   INSTALL PACKAGES
   ========================================= */

async function installPackages(
    packages
) {

    if (
        !pyodideReady
    ) {

        write(
            "Python is not ready.\n",
            "error"
        );

        return;

    }


    if (
        !packages ||
        packages.length === 0
    ) {

        write(
            "No package specified.\n",
            "error"
        );

        return;

    }


    setStatus(
        "Installing..."
    );


    write(
        "Using micropip...\n",
        "system"
    );


    try {

        /*
         * Pass package names from JavaScript
         * into Python.
         */

        pyodide.globals.set(
            "_thonny_packages",
            packages
        );


        /*
         * Install through micropip.
         *
         * micropip downloads compatible
         * PyPI wheels and pure-Python packages.
         */

        await pyodide.runPythonAsync(`

import micropip

await micropip.install(
    _thonny_packages
)

`);


        /*
         * Remember package names.
         */

        const savedPackages =
            getSavedPackages();


        for (
            const packageName
            of packages
        ) {

            if (
                !savedPackages.includes(
                    packageName
                )
            ) {

                savedPackages.push(
                    packageName
                );

            }

        }


        savePackages(
            savedPackages
        );


        write(
            "Successfully installed: " +
            packages.join(", ") +
            "\n",
            "success"
        );


        write(
            "Downloaded resources have been passed " +
            "through the browser cache.\n",
            "system"
        );


        setStatus(
            "Python ready"
        );


        updatePackageList();

    }
    catch (error) {

        write(
            "\nPackage installation failed:\n" +
            error +
            "\n\n" +

            "Possible reasons:\n" +
            "• The package is not compatible with Pyodide.\n" +
            "• It requires native CPython extensions.\n" +
            "• No compatible wheel exists.\n" +
            "• You are offline and the package was not cached.\n",

            "error"
        );


        setStatus(
            "Install failed"
        );

    }

}


/* =========================================
   PACKAGE STORAGE
   ========================================= */

function getSavedPackages() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "thonny_packages"
            ) || "[]"
        );

    }
    catch {

        return [];

    }

}


function savePackages(
    packages
) {

    try {

        localStorage.setItem(
            "thonny_packages",
            JSON.stringify(
                packages
            )
        );

    }
    catch (error) {

        console.warn(
            "Could not save packages:",
            error
        );

    }

}


/* =========================================
   RESTORE PACKAGES
   ========================================= */

async function restorePackages() {

    const packages =
        getSavedPackages();


    if (
        packages.length === 0
    ) {

        return;

    }


    write(
        "Restoring packages:\n" +
        packages.join(", ") +
        "\n",
        "system"
    );


    try {

        pyodide.globals.set(
            "_thonny_restore",
            packages
        );


        await pyodide.runPythonAsync(`

import micropip

await micropip.install(
    _thonny_restore
)

`);


        write(
            "Packages restored successfully.\n",
            "success"
        );

    }
    catch (error) {

        write(
            "Some packages could not be restored.\n" +
            "If you are offline, connect to the internet " +
            "and run pip install again.\n",
            "error"
        );

    }

}


/* =========================================
   CACHE INFORMATION
   ========================================= */

async function showCacheInfo() {

    if (
        !("caches" in window)
    ) {

        write(
            "The Cache API is unavailable.\n",
            "error"
        );

        return;

    }


    try {

        const cache =
            await caches.open(
                "thonny-pad-v3"
            );


        const requests =
            await cache.keys();


        const pyodideFiles =
            requests.filter(
                request =>
                    request.url.includes(
                        "/pyodide/"
                    )
            );


        write(
            "\nOffline cache:\n\n" +

            "Total cached resources: " +
            requests.length +
            "\n" +

            "Pyodide resources: " +
            pyodideFiles.length +
            "\n\n",

            "system"
        );


        if (
            pyodideFiles.length === 0
        ) {

            write(
                "No Pyodide resources have been " +
                "cached yet.\n",
                "system"
            );

            return;

        }


        /*
         * Show the first 20 cached Pyodide
         * resources.
         */

        for (
            const request
            of pyodideFiles.slice(
                0,
                20
            )
        ) {

            write(
                "• " +
                request.url +
                "\n",
                "system"
            );

        }


        if (
            pyodideFiles.length > 20
        ) {

            write(
                "...and " +
                (
                    pyodideFiles.length - 20
                ) +
                " more.\n",
                "system"
            );

        }

    }
    catch (error) {

        write(
            "Could not inspect the cache:\n" +
            error +
            "\n",
            "error"
        );

    }

}


/* =========================================
   RESTART PYTHON
   ========================================= */

async function restartPython() {

    /*
     * Reloading the page gives us a completely
     * fresh JavaScript/Pyodide environment.
     *
     * Saved code and package names remain in
     * localStorage.
     */

    write(
        "\nRestarting Python...\n",
        "system"
    );


    setStatus(
        "Restarting..."
    );


    setTimeout(
        () => {

            window.location.reload();

        },
        250
    );

}


/* =========================================
   TERMINAL HISTORY
   ========================================= */

input.addEventListener(
    "keydown",
    async function(event) {


        /* -----------------------------------
           ENTER
           ----------------------------------- */

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();


            const command =
                input.value;


            input.value =
                "";


            await executeCommand(
                command
            );


            return;

        }


        /* -----------------------------------
           ARROW UP
           ----------------------------------- */

        if (
            event.key === "ArrowUp"
        ) {

            event.preventDefault();


            if (
                commandHistory.length === 0
            ) {

                return;

            }


            historyIndex =
                Math.max(
                    0,
                    historyIndex - 1
                );


            input.value =
                commandHistory[
                    historyIndex
                ];


            return;

        }


        /* -----------------------------------
           ARROW DOWN
           ----------------------------------- */

        if (
            event.key === "ArrowDown"
        ) {

            event.preventDefault();


            if (
                commandHistory.length === 0
            ) {

                return;

            }


            historyIndex =
                Math.min(
                    commandHistory.length,
                    historyIndex + 1
                );


            if (
                historyIndex ===
                commandHistory.length
            ) {

                input.value =
                    "";

            }
            else {

                input.value =
                    commandHistory[
                        historyIndex
                    ];

            }

        }

    }
);


/* =========================================
   EDITOR TAB SUPPORT
   ========================================= */

code.addEventListener(
    "keydown",
    function(event) {

        /*
         * Press Tab to insert four spaces.
         */

        if (
            event.key === "Tab"
        ) {

            event.preventDefault();


            const start =
                code.selectionStart;

            const end =
                code.selectionEnd;


            code.value =
                code.value.substring(
                    0,
                    start
                ) +

                "    " +

                code.value.substring(
                    end
                );


            code.selectionStart =
                code.selectionEnd =
                    start + 4;

        }


        /*
         * Cmd+Enter on Mac
         *
         * Ctrl+Enter on Windows,
         * Linux and iPad keyboards.
         */

        if (
            event.key === "Enter" &&
            (
                event.metaKey ||
                event.ctrlKey
            )
        ) {

            event.preventDefault();

            runEditor();

        }

    }
);


/* =========================================
   EDITOR AUTOSAVE
   ========================================= */

try {

    const savedCode =
        localStorage.getItem(
            "thonny_pad_code"
        );


    if (
        savedCode !== null
    ) {

        code.value =
            savedCode;

    }


    code.addEventListener(
        "input",
        function() {

            localStorage.setItem(
                "thonny_pad_code",
                code.value
            );

        }
    );

}
catch (error) {

    console.warn(
        "localStorage unavailable:",
        error
    );

}


/* =========================================
   PACKAGE WINDOW
   ========================================= */

function showPackages() {

    const panel =
        document.getElementById(
            "package-panel"
        );


    if (!panel) {

        write(
            "Package panel is unavailable.\n",
            "error"
        );

        return;

    }


    panel.style.display =
        "block";


    updatePackageList();

}


function hidePackages() {

    const panel =
        document.getElementById(
            "package-panel"
        );


    if (panel) {

        panel.style.display =
            "none";

    }

}


function updatePackageList() {

    const element =
        document.getElementById(
            "installed-packages"
        );


    if (!element) {

        return;

    }


    const packages =
        getSavedPackages();


    if (
        packages.length === 0
    ) {

        element.textContent =
            "No packages installed.";

        return;

    }


    element.textContent =
        "Remembered packages:\n\n" +

        packages
            .map(
                packageName =>
                    "• " +
                    packageName
            )
            .join("\n");

}


/* =========================================
   INSTALL FROM PACKAGE PANEL
   ========================================= */

async function installPackageFromPanel() {

    const element =
        document.getElementById(
            "package-input"
        );


    if (!element) {

        return;

    }


    const packageName =
        element.value.trim();


    if (
        !packageName
    ) {

        return;

    }


    element.value =
        "";


    hidePackages();


    await installPackages(
        [packageName]
    );

}


/* =========================================
   EXPOSE FUNCTIONS TO HTML
   ========================================= */

/*
 * Because index.html uses onclick="...",
 * these functions need to be available on
 * window.
 */

window.runEditor =
    runEditor;

window.clearTerminal =
    clearTerminal;

window.restartPython =
    restartPython;

window.showPackages =
    showPackages;

window.hidePackages =
    hidePackages;

window.installPackageFromPanel =
    installPackageFromPanel;
