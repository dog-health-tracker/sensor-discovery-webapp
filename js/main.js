import { batteryLevelStatusUuid, batteryLevelUuid, sensors } from "./sensors.js";
import { connect, disconnect, isConnected, readValue, subscribe } from "./bluetooth.js";
import { createRecorder } from "./recorder.js";
import { createSensorCard } from "./sensor-card.js";

const connectButton = document.getElementById("connect");
const linkStatus = document.getElementById("link-status");
const battery = document.getElementById("battery");
const batteryFill = document.getElementById("battery-fill");
const batteryPercent = document.getElementById("battery-percent");
const batteryStatus = document.getElementById("battery-status");
const recordButton = document.getElementById("record");
const recordStatus = document.getElementById("record-status");
const linkRate = document.getElementById("link-rate");
const windowSelect = document.getElementById("window");
const message = document.getElementById("message");
const sensorList = document.getElementById("sensors");

const recorder = createRecorder();
const savedWindow = localStorage.getItem("sensor-disc.chart-window");

if ([...windowSelect.options].some(option => option.value === savedWindow)) {
    windowSelect.value = savedWindow;
}

let timeOrigin = null;

function sessionSeconds(microseconds) {
    if (timeOrigin === null) {
        timeOrigin = microseconds;
    }

    return (microseconds - timeOrigin) / 1e6;
}

function showMessage(text) {
    message.textContent = text;
}

let redrawScheduled = false;

function requestRedraw() {
    if (redrawScheduled) {
        return;
    }

    redrawScheduled = true;
    window.setTimeout(() => requestAnimationFrame(() => {
        redrawScheduled = false;

        for (const card of cards) {
            card.redraw();
        }
    }), 100);
}

const cards = sensors.map(sensor =>
    createSensorCard(sensor, { recorder, sessionSeconds, showMessage, requestRedraw })
);

sensorList.append(...cards.map(card => card.element));

const cardsByElement = new Map(cards.map(card => [card.element, card]));
const cardObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
        cardsByElement.get(entry.target).setVisible(entry.isIntersecting);
    }
});

for (const card of cards) {
    cardObserver.observe(card.element);
    card.setWindow(Number(windowSelect.value));
}

function showBattery(view) {
    const percent = view.getUint8(0);

    battery.hidden = false;
    batteryFill.style.width = `${Math.min(100, percent)}%`;
    batteryFill.parentElement.classList.toggle("low", percent < 20);
    batteryPercent.textContent = `${percent} %`;
}

function showBatteryStatus(view) {
    const powerState = view.getUint16(1, true);
    const wiredPower = (powerState >> 1) & 0x03;
    const chargeState = (powerState >> 5) & 0x03;
    const faults = (powerState >> 12) & 0x07;

    batteryStatus.textContent = chargeState === 1
        ? "charging"
        : wiredPower === 1 && chargeState === 3 && faults === 0 ? "charged" : "";
    batteryStatus.hidden = batteryStatus.textContent === "";
}

function showDisconnected() {
    const downloaded = finishRecording();

    linkStatus.textContent = "Not connected";
    linkStatus.classList.remove("connected");
    connectButton.textContent = "Connect";
    connectButton.disabled = false;
    battery.hidden = true;
    batteryStatus.textContent = "";
    batteryStatus.hidden = true;
    recordButton.disabled = true;

    for (const card of cards) {
        card.detach();
    }

    if (downloaded) {
        showMessage("Disconnected while recording. The CSV file was downloaded.");
    }
}

connectButton.addEventListener("click", async () => {
    if (isConnected()) {
        await disconnect();
        showDisconnected();

        return;
    }

    showMessage("");
    connectButton.disabled = true;
    connectButton.textContent = "Connecting";

    try {
        timeOrigin = null;

        const name = await connect(showDisconnected);

        linkStatus.textContent = `Connected to ${name}`;
        linkStatus.classList.add("connected");
        connectButton.textContent = "Disconnect";
        connectButton.disabled = false;
        recordButton.disabled = false;

        const level = await readValue(batteryLevelUuid);

        if (level) {
            showBattery(level);
        }

        await subscribe(batteryLevelUuid, showBattery);

        const status = await readValue(batteryLevelStatusUuid);

        if (status) {
            showBatteryStatus(status);
        }

        await subscribe(batteryLevelStatusUuid, showBatteryStatus);

        for (const card of cards) {
            await card.attach();
        }
    } catch (error) {
        showDisconnected();

        if (error.name !== "NotFoundError") {
            showMessage(error.message);
        }
    }
});

function finishRecording() {
    if (!recorder.isRecording()) {
        return false;
    }

    recorder.stop();
    recorder.download();
    recordButton.textContent = "Start recording";
    recordButton.classList.remove("active");
    recordStatus.classList.remove("recording");
    refreshRecordStatus();

    return true;
}

recordButton.addEventListener("click", async () => {
    if (recorder.isRecording()) {
        finishRecording();
        recordButton.disabled = true;
        await Promise.all(cards.map(card => card.stopRecording()));
        recordButton.disabled = !isConnected();

        return;
    }

    if (!cards.some(card => card.canRecord())) {
        showMessage("Enable at least one sensor available on this device.");

        return;
    }

    showMessage("");
    recorder.start();
    recordButton.textContent = "Stop and download";
    recordButton.classList.add("active");
    recordStatus.classList.add("recording");
    recordButton.disabled = true;
    refreshRecordStatus();

    await Promise.all(cards.map(card => card.startRecording()));
    recordButton.disabled = !isConnected();
});

windowSelect.addEventListener("change", () => {
    localStorage.setItem("sensor-disc.chart-window", windowSelect.value);

    for (const card of cards) {
        card.setWindow(Number(windowSelect.value));
    }
});

function formatDuration(seconds) {
    const whole = Math.floor(seconds);
    const parts = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60];

    return parts.map(part => String(part).padStart(2, "0")).join(":");
}

let rateStart = performance.now();
let rateBytes = 0;

function refreshLinkRate() {
    let bytes = 0;
    let lost = 0;

    for (const card of cards) {
        const statistics = card.statistics();

        bytes += statistics.bytes;
        lost += statistics.lost;
    }

    const now = performance.now();
    const elapsed = now - rateStart;

    if (elapsed < 1000) {
        return;
    }

    const rate = ((bytes - rateBytes) * 1000) / elapsed / 1024;

    rateBytes = bytes;
    rateStart = now;

    if (bytes === 0 && lost === 0) {
        linkRate.textContent = "";

        return;
    }

    linkRate.textContent = lost === 0
        ? `${rate.toFixed(1)} kB/s received`
        : `${rate.toFixed(1)} kB/s received · ${lost.toLocaleString()} samples lost`;

    linkRate.classList.toggle("lost", lost > 0);
}

function refreshRecordStatus() {
    const rows = recorder.rowCount().toLocaleString();

    if (recorder.isRecording()) {
        recordStatus.textContent = `Recording ${formatDuration(recorder.elapsedSeconds())} · ${rows} rows`;

        return;
    }

    recordStatus.textContent = rows === "0" ? "Not recording" : `Saved ${rows} rows`;
}

window.setInterval(() => {
    refreshRecordStatus();
    refreshLinkRate();
}, 1000);
