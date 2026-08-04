// 📟 WEBASSEMBLY x86 HARDWARE ARCHITECTURE SETTINGS
window.addEventListener('load', () => {
    const stateText = document.getElementById('vm-state');
    if (!stateText) return;

    // Check if V86Starter is available
    if (typeof V86Starter === 'undefined') {
        stateText.innerText = "ERROR: V86 LIBRARY NOT LOADED";
        stateText.style.color = "#ff0000";
        console.error("V86Starter not found. Check library loading.");
        return;
    }

    try {
        // Initialize v86 core
        const emulator = new V86Starter({
            screen_container: document.getElementById("terminal-container"),
            bios: { url: "https://unpkg.com/v86@0.2.0/bios/seabios.bin" },
            vga_bios: { url: "https://unpkg.com/v86@0.2.0/bios/vgabios.bin" },
            cdrom: { url: "https://unpkg.com/v86@0.2.0/images/linux.iso" },
            autostart: true,
            memory_size: 32 * 1024 * 1024 // 32MB
        });

        let hasBooted = false;

        // Monitor boot progress
        const monitor = setInterval(() => {
            const terminal = document.getElementById("terminal-container");
            if (terminal && !hasBooted && terminal.innerText.includes("Welcome to Linux")) {
                hasBooted = true;
                stateText.innerText = "ONLINE (READY FOR INPUTS)";
                stateText.style.color = "#00ff66";
                clearInterval(monitor);
                console.log("✅ VM booted successfully!");
            }
            
            // Update status if still booting
            if (!hasBooted && terminal) {
                stateText.innerText = "BOOTING...";
            }
        }, 1000);

        // Handle errors
        emulator.add_listener("error", (msg) => {
            stateText.innerText = `ERROR: ${msg}`;
            stateText.style.color = "#ff0000";
            console.error("VM Error:", msg);
        });

    } catch (error) {
        stateText.innerText = `ERROR: ${error.message}`;
        stateText.style.color = "#ff0000";
        console.error("VM initialization error:", error);
    }
});
