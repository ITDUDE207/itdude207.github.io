"use strict";


/* =========================================
   GLOBAL STATE
   ========================================= */

let pyodide = null;

let pyodideReady = false;

let stdoutBuffer = "";

let stderrBuffer = "";

const commandHistory = [];

let historyIndex = 0;


/* =========================================
   DOM
   ========================================= */

const output =
    document.getElementById(
        "terminal-output"
    );

const input =
    document.getElementById(
        "terminal-input"
    );

const code =
    document.getElementById(
        "code"
    );

const status =
    document.getElementById(
        "status"
    );


/* =========================================
   TERMINAL OUTPUT
   ========================================= */

function write(
    text,
    className = ""
) {

    if (
        text === null ||
        text === undefined
    ) {
        return;
    }


    const span =
        document.createElement(
            "span"
        );


    span.textContent =
        String(text);


    if (className) {

        span.className =
            className;

    }


    output.appendChild(
        span
    );


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
   =========================================

   IMPORTANT:

   Pyodide's raw stdout callback gives us
   output as individual characters.

   We preserve those characters instead
   of adding/removing newlines ourselves.

   This means:

       print("A")
       print("B")

   correctly becomes:

       A
       B

   and:

       print("A", end="")
       print("B")

   correctly becomes:

       AB
*/


function stdoutCharacter(character) {

    stdoutBuffer += character;


    /*
     * Flush when Python sends a newline.
     */

    if (
        character === "\n"
    ) {

        write(
            stdoutBuffer
        );

        stdoutBuffer = "";

    }

}


/* =========================================
   PYODIDE STDERR
   ========================================= */

function stderrCharacter(character) {

    stderrBuffer += character;


    if (
        character === "\n"
    ) {

        write(
            stderrBuffer,
            "error"
        );

        stderrBuffer = "";

    }

}


/* =========================================
   FLUSH REMAINING OUTPUT
   ========================================= */

function flushPythonOutput() {

    if (
        stdoutBuffer.length > 0
    ) {

        write(
            stdoutBuffer
        );

        stdoutBuffer = "";

    }


    if (
        stderrBuffer.length > 0
    ) {

        write(
            stderrBuffer,
            "error"
        );

        stderrBuffer = "";

    }

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
                    "Offline service worker ready.",
                    registration
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "Service worker error:",
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
   START PYODIDE
   ========================================= */

async function initializePython() {

    try {

        write(
            "Loading Pyodide...\n",
            "system"
        );


        setStatus(
            "Loading Python..."
        );


        /*
         * IMPORTANT:
         *
         * pyodide.js and this indexURL must
         * point to the same Pyodide version.
         */

        pyodide =
            await loadPyodide({

                indexURL:
                    "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"

            });


        /*
         * Load micropip.
         */

        await pyodide.loadPackage(
            "micropip"
        );


        /*
         * Connect Python stdout/stderr.
         */

        pyodide.setStdout({

            raw:
                stdoutCharacter

        });


        pyodide.setStderr({

            raw:
                stderrCharacter

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
            "Type help() for Python help.\n\n",
            "system"
        );


        /*
         * Restore packages previously
         * installed by the user.
         */

        await restorePackages();


        input.focus();

    }
    catch (error) {

        console.error(
            error
        );


        setStatus(
            "Python failed"
        );


        write(
            "\nCould not start Pyodide:\n" +
            error +
            "\n\n" +
            "Open the app online at least once " +
            "so Pyodide can be cached.\n",
            "error"
        );

    }

}


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

        await pyodide.runPythonAsync(
            source
        );


        /*
         * Make sure output that didn't end
         * in a newline is displayed.
         */

        flushPythonOutput();


        setStatus(
            "Python ready"
        );

    }
    catch (error) {

        flushPythonOutput();


        write(
            error.toString() +
            "\n",
            "error"
        );


        setStatus(
            "Error"
        );

    }

}


/* =========================================
   TERMINAL COMMAND
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


    commandHistory.push(
        command
    );


    historyIndex =
        commandHistory.length;


    write(
        ">>> " +
        command +
        "\n",
        "command"
    );


    if (
        !pyodideReady
    ) {

        write(
            "Python is not ready yet.\n",
            "error"
        );

        return;

    }


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
            "  pip install PACKAGE\n\n" +

            "Python examples:\n\n" +

            "  print('Hello')\n" +
            "  import math\n" +
            "  math.sqrt(25)\n\n",

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
       NORMAL PYTHON
       ------------------------------------- */

    try {

        const result =
            await pyodide.runPythonAsync(
                command
            );


        flushPythonOutput();


        /*
         * Display expression results.
         *
         * Example:
         *
         * >>> 2 + 2
         * 4
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

        flushPythonOutput();


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
     * Don't interpret command-line options
     * as package names.
     */

    if (
        packages.some(
            pkg =>
                pkg.startsWith("-")
        )
    ) {

        write(
            "pip options are not supported yet.\n" +
            "Use: pip install PACKAGE\n",
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
        !packages ||
        packages.length === 0
    ) {

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
         * Give package names to Python.
         */

        pyodide.globals.set(
            "_thonny_packages",
            packages
        );


        await pyodide.runPythonAsync(`

import micropip

await micropip.install(
    _thonny_packages
)

`);


        flushPythonOutput();


        /*
         * Remember the package specification.
         */

        const savedPackages =
            JSON.parse(
                localStorage.getItem(
                    "thonny_packages"
                ) || "[]"
            );


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


        localStorage.setItem(
            "thonny_packages",
            JSON.stringify(
                savedPackages
            )
        );


        write(
            "Successfully installed: " +
            packages.join(", ") +
            "\n",
            "success"
        );


        write(
            "The browser will cache downloaded " +
            "resources when possible.\n",
            "system"
        );


        setStatus(
            "Python ready"
        );


        updatePackageList();

    }
    catch (error) {

        flushPythonOutput();


        write(
            "\nInstallation failed:\n" +
            error +
            "\n",
            "error"
        );


        setStatus(
            "Installation failed"
        );

    }

}


/* =========================================
   RESTORE PACKAGES
   ========================================= */

async function restorePackages() {

    const saved =
        JSON.parse(
            localStorage.getItem(
                "thonny_packages"
            ) || "[]"
        );


    if (
        saved.length === 0
    ) {

        return;

    }


    write(
        "Restoring installed packages...\n",
        "system"
    );


    try {

        pyodide.globals.set(
            "_thonny_restore",
            saved
        );


        await pyodide.runPythonAsync(`

import micropip

await micropip.install(
    _thonny_restore
)

`);


        flushPythonOutput();


        write(
            "Installed packages restored.\n",
            "success"
        );

    }
    catch (error) {

        flushPythonOutput();


        /*
         * This is expected when a package was
         * remembered but its files aren't
         * available offline.
         */

        write(
            "Some packages could not be restored.\n" +
            "Connect to the internet once to " +
            "download missing packages.\n",
            "error"
        );

    }

}


/* =========================================
   RESTART PYTHON
   ========================================= */

async function restartPython() {

    if (
        !pyodide
    ) {

        return;

    }


    write(
        "\nRestarting Python...\n",
        "system"
    );


    setStatus(
        "Restarting..."
    );


    try {

        /*
         * Recreate the Pyodide interpreter
         * instead of trying to manually clear
         * Python's globals.
         */

        pyodideReady =
            false;


        /*
         * Destroy the existing runtime.
         */

        pyodide = null;


        /*
         * Start it again.
         */

        await initializePython();


        write(
            "Python restarted.\n",
            "success"
        );

    }
    catch (error) {

        write(
            "Restart failed:\n" +
            error +
            "\n",
            "error"
        );

    }

}


/* =========================================
   TERMINAL INPUT
   ========================================= */

input.addEventListener(
    "keydown",
    async function(event) {


        /* ENTER */

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


        /* UP */

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


        /* DOWN */

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
         * Cmd+Enter = Mac
         * Ctrl+Enter = Windows/Linux/iPad
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
   AUTOSAVE EDITOR
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

    document.getElementById(
        "package-panel"
    ).style.display =
        "block";


    updatePackageList();

}


function hidePackages() {

    document.getElementById(
        "package-panel"
    ).style.display =
        "none";

}


function updatePackageList() {

    const packages =
        JSON.parse(
            localStorage.getItem(
                "thonny_packages"
            ) || "[]"
        );


    const element =
        document.getElementById(
            "installed-packages"
        );


    if (
        packages.length === 0
    ) {

        element.textContent =
            "No extra packages installed.";

        return;

    }


    element.textContent =
        "Remembered packages:\n\n" +
        packages
            .map(
                pkg =>
                    "• " + pkg
            )
            .join("\n");

}


async function installPackageFromPanel() {

    const packageInput =
        document.getElementById(
            "package-input"
        );


    const packageName =
        packageInput.value.trim();


    if (
        !packageName
    ) {

        return;

    }


    packageInput.value =
        "";


    hidePackages();


    await installPackages(
        [packageName]
    );

}
