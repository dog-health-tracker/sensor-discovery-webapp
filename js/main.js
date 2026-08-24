import { batteryLevelStatusUuid, batteryLevelUuid, sensors } from "./sensors.js";
import { connect, disconnect, isConnected, readValue, subscribe } from "./bluetooth.js";
import { createRecorder } from "./recorder.js";
import { createSensorCard } from "./sensor-card.js";

const redrawIntervalMilliseconds = 50;

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

const cards = sensors.map(sensor =>
    createSensorCard(sensor, { recorder, sessionSeconds, showMessage })
);

sensorList.append(...cards.map(card => card.element));

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
    linkStatus.textContent = "Not connected";
    linkStatus.classList.remove("connected");
    connectButton.textContent = "Connect";
    connectButton.disabled = false;
    battery.hidden = true;
    batteryStatus.textContent = "";
    batteryStatus.hidden = true;
    recordButton.disabled = !recorder.isRecording();

    if (recorder.isRecording()) {
        showMessage("Link lost while recording. Press Stop and save to keep what was captured.");
    }

    for (const card of cards) {
        card.detach();
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

recordButton.addEventListener("click", () => {
    if (recorder.isRecording()) {
        recorder.stop();
        recorder.download();
        recordButton.textContent = "Record CSV";
        recordButton.classList.remove("active");
        recordStatus.classList.remove("recording");

        return;
    }

    if (!cards.some(card => card.isStreaming())) {
        showMessage("Start at least one sensor before recording.");

        return;
    }

    showMessage("");
    recorder.start();
    recordButton.textContent = "Stop and save";
    recordButton.classList.add("active");
    recordStatus.classList.add("recording");
});

windowSelect.addEventListener("change", () => {
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

let lastRedraw = 0;

function redraw(now) {
    requestAnimationFrame(redraw);

    if (now - lastRedraw < redrawIntervalMilliseconds) {
        return;
    }

    lastRedraw = now;

    for (const card of cards) {
        card.redraw();
    }

    refreshRecordStatus();
    refreshLinkRate();
}

requestAnimationFrame(redraw);
