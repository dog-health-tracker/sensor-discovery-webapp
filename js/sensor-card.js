import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
} from "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/+esm";

import {
    configBytes,
    controlIndex,
    controlLabel,
    controlValue,
    defaultConfig,
    packetDroppedOffset,
    packetHeaderBytes,
} from "./sensors.js";

import { hasCharacteristic, subscribe, writeValue } from "./bluetooth.js";

Chart.register(LineController, LineElement, PointElement, LinearScale);

const pointsPerWindow = 500;

function styleValue(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function buildSelect(labels, onChange) {
    const select = document.createElement("select");

    for (const [index, label] of labels.entries()) {
        const option = document.createElement("option");

        option.value = String(index);
        option.textContent = label;
        select.append(option);
    }

    select.addEventListener("change", () => onChange(Number(select.value)));

    return select;
}

function labelledControl(text, select) {
    const label = document.createElement("label");

    label.append(text, select);

    return label;
}

export function createSensorCard(
    sensor,
    { recorder, sessionSeconds, showMessage, requestRedraw }
) {
    const config = defaultConfig(sensor);
    const savedConfig = JSON.parse(localStorage.getItem(`sensor-disc.${sensor.key}`));

    if (Array.isArray(savedConfig) && savedConfig.length === configBytes) {
        config.set(savedConfig);
    }

    const buckets = sensor.channels.map(() => null);
    const latestValues = sensor.channels.map(() => null);

    let windowSeconds = 10;
    let bucketSeconds = windowSeconds / pointsPerWindow;
    let latestTime = 0;
    let dirty = false;
    let present = false;
    let visible = true;

    let receivedSamples = 0;
    let lostSamples = 0;
    let receivedBytes = 0;
    let packetEndMicroseconds = null;
    let rateSamples = 0;
    let rateStart = performance.now();
    let sampleRate = 0;

    const element = document.createElement("article");
    element.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("div");
    title.className = "card-title";

    const heading = document.createElement("h2");
    heading.textContent = sensor.name;

    const part = document.createElement("p");
    part.className = "card-part";
    part.textContent = sensor.part;

    title.append(heading, part);

    const stats = document.createElement("span");
    stats.className = "stats";

    const enableLabel = document.createElement("label");
    enableLabel.className = "sensor-enable";

    const enableCheckbox = document.createElement("input");
    enableCheckbox.type = "checkbox";
    enableCheckbox.checked = config[0] === 1;

    enableLabel.append(enableCheckbox, " Enable");

    header.append(title, stats);

    const plot = document.createElement("div");
    plot.className = "plot";

    const canvas = document.createElement("canvas");
    plot.append(canvas);

    const readout = document.createElement("div");
    readout.className = "readout";

    const readouts = sensor.channels.map(channel => {
        const span = document.createElement("span");

        const dot = document.createElement("b");
        dot.style.background = channel.colour;

        const name = document.createElement("em");
        name.textContent = channel.label;

        const value = document.createElement("output");
        value.textContent = "--";

        span.append(dot, name, value);
        readout.append(span);

        return value;
    });

    const settings = document.createElement("div");
    settings.className = "settings";

    const primarySettings = document.createElement("div");
    primarySettings.className = "primary-settings";

    const rateSelect = buildSelect(
        sensor.rates.map(rate => `${rate} Hz`),
        index => {
            config[1] = index;
            saveConfig();
        }
    );

    primarySettings.append(enableLabel, labelledControl("Rate", rateSelect));

    const controlSelects = sensor.controls.map(control => {
        const select = buildSelect(control.options.map(controlLabel), index => {
            config[control.byte] = controlValue(control, index);
            saveConfig();
        });

        settings.append(labelledControl(control.label, select));

        return select;
    });

    element.append(header, plot, readout, primarySettings, settings);

    const chart = new Chart(canvas, {
        type: "line",
        data: {
            datasets: sensor.channels.map(channel => ({
                data: [],
                borderColor: channel.colour,
                borderWidth: 1.4,
                yAxisID: channel.axis,
            })),
        },
        options: {
            parsing: false,
            normalized: true,
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            spanGaps: true,
            events: [],
            elements: { point: { radius: 0 }, line: { tension: 0 } },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: windowSeconds,
                    border: { color: styleValue("--border") },
                    grid: { color: styleValue("--grid") },
                    ticks: {
                        color: styleValue("--muted"),
                        count: 6,
                        callback: value => `${value.toFixed(1)} s`,
                    },
                },
                y: {
                    type: "linear",
                    position: "left",
                    title: { display: true, text: sensor.units[0], color: styleValue("--muted") },
                    border: { color: styleValue("--border") },
                    grid: { color: styleValue("--grid") },
                    ticks: { color: styleValue("--muted"), maxTicksLimit: 5 },
                },
                y2: {
                    type: "linear",
                    position: "right",
                    display: sensor.units.length > 1,
                    title: { display: true, text: sensor.units[1], color: styleValue("--muted") },
                    border: { color: styleValue("--border") },
                    grid: { drawOnChartArea: false },
                    ticks: { color: styleValue("--muted"), maxTicksLimit: 5 },
                },
            },
        },
    });

    function markPlotDirty() {
        dirty = true;

        if (visible) {
            requestRedraw();
        }
    }

    function clearPlot() {
        for (const dataset of chart.data.datasets) {
            dataset.data.length = 0;
        }

        buckets.fill(null);
        latestTime = 0;
        markPlotDirty();
    }

    function pushPoint(index, time, value) {
        const points = chart.data.datasets[index].data;
        const bucket = buckets[index];
        const slot = Math.floor(time / bucketSeconds);

        if (bucket && bucket.slot === slot) {
            if (value < bucket.low) {
                bucket.low = value;
                bucket.lowTime = time;
            }

            if (value > bucket.high) {
                bucket.high = value;
                bucket.highTime = time;
            }

            return;
        }

        if (bucket) {
            if (bucket.lowTime === bucket.highTime) {
                points.push({ x: bucket.lowTime, y: bucket.low });
            } else if (bucket.lowTime < bucket.highTime) {
                points.push({ x: bucket.lowTime, y: bucket.low });
                points.push({ x: bucket.highTime, y: bucket.high });
            } else {
                points.push({ x: bucket.highTime, y: bucket.high });
                points.push({ x: bucket.lowTime, y: bucket.low });
            }
        }

        if (!visible && points.length > pointsPerWindow * 4) {
            points.splice(0, pointsPerWindow * 2);
        }

        buckets[index] = { slot, low: value, high: value, lowTime: time, highTime: time };
    }

    function receivePacket(view) {
        const channelCount = sensor.channels.length;
        const sampleBytes = channelCount * 4;
        const sampleCount = Math.floor((view.byteLength - packetHeaderBytes) / sampleBytes);

        if (sampleCount < 1) {
            return;
        }

        const startMicroseconds =
            view.getUint32(0, true) + view.getUint32(4, true) * 4294967296;

        const rate = sensor.rates[config[1]] ?? sensor.rates[0];
        const intervalMicroseconds = 1e6 / rate;
        const values = new Array(channelCount);

        const reportedDropped = view.getUint32(packetDroppedOffset, true);
        const gapMicroseconds =
            packetEndMicroseconds === null ? 0 : startMicroseconds - packetEndMicroseconds;
        const gapSamples = Math.max(0, Math.round(gapMicroseconds / intervalMicroseconds));

        lostSamples += Math.max(reportedDropped, gapSamples);
        receivedSamples += sampleCount;
        receivedBytes += view.byteLength;
        rateSamples += sampleCount;
        packetEndMicroseconds = startMicroseconds + sampleCount * intervalMicroseconds;

        for (let sample = 0; sample < sampleCount; sample++) {
            const time = sessionSeconds(startMicroseconds + sample * intervalMicroseconds);
            let offset = packetHeaderBytes + sample * sampleBytes;

            for (let channel = 0; channel < channelCount; channel++) {
                const value = view.getFloat32(offset, true);

                values[channel] = value;
                latestValues[channel] = value;
                pushPoint(channel, time, value);

                offset += 4;
            }

            recorder.add(sensor, time, values);
            latestTime = time;
        }

        markPlotDirty();
    }

    function refreshStatistics() {
        const now = performance.now();
        const elapsed = now - rateStart;

        if (elapsed >= 1000) {
            sampleRate = (rateSamples * 1000) / elapsed;
            rateSamples = 0;
            rateStart = now;
        }

        if (receivedSamples === 0 && lostSamples === 0) {
            stats.textContent = "";

            return;
        }

        const loss = (lostSamples / (receivedSamples + lostSamples)) * 100;

        stats.textContent = `${sampleRate.toFixed(1)} Hz\n${lostSamples.toLocaleString()} lost (${loss.toFixed(1)}%)`;

        stats.classList.toggle("lost", lostSamples > 0);
    }

    function refreshControls() {
        rateSelect.value = String(config[1]);
        enableCheckbox.checked = config[0] === 1;

        sensor.controls.forEach((control, index) => {
            controlSelects[index].value = String(controlIndex(control, config[control.byte]));
        });
    }

    function resetStatistics() {
        receivedSamples = 0;
        lostSamples = 0;
        receivedBytes = 0;
        packetEndMicroseconds = null;
        rateSamples = 0;
        rateStart = performance.now();
        sampleRate = 0;
    }

    function saveConfig() {
        refreshControls();
        localStorage.setItem(`sensor-disc.${sensor.key}`, JSON.stringify(Array.from(config)));

        if (!present || !recorder.isRecording()) {
            return;
        }

        writeValue(sensor.configUuid, Uint8Array.from(config)).catch(error => {
            showMessage(`${sensor.name}: ${error.message}`);
        });
    }

    enableCheckbox.addEventListener("change", () => {
        config[0] = enableCheckbox.checked ? 1 : 0;
        saveConfig();
    });

    refreshControls();

    return {
        element,

        async attach() {
            present = hasCharacteristic(sensor.dataUuid) && hasCharacteristic(sensor.configUuid);

            if (!present) {
                part.textContent = `${sensor.part}, not on this device`;

                return;
            }

            await subscribe(sensor.dataUuid, receivePacket);
        },

        detach() {
            present = false;
            part.textContent = sensor.part;
        },

        canRecord() {
            return present && config[0] === 1;
        },

        async startRecording() {
            if (!present) {
                return false;
            }

            if (config[0] === 1) {
                clearPlot();
                resetStatistics();
            }

            try {
                await writeValue(sensor.configUuid, Uint8Array.from(config));

                return config[0] === 1;
            } catch (error) {
                showMessage(`${sensor.name}: ${error.message}`);

                return false;
            }
        },

        async stopRecording() {
            if (!present || config[0] !== 1) {
                return;
            }

            const stoppedConfig = Uint8Array.from(config);
            stoppedConfig[0] = 0;

            try {
                await writeValue(sensor.configUuid, stoppedConfig);
            } catch (error) {
                showMessage(`${sensor.name}: ${error.message}`);
            }
        },

        setWindow(seconds) {
            windowSeconds = seconds;
            bucketSeconds = seconds / pointsPerWindow;
            clearPlot();
        },

        setVisible(isVisible) {
            visible = isVisible;

            if (visible && dirty) {
                requestRedraw();
            }
        },

        redraw() {
            if (!dirty || !visible) {
                return;
            }

            dirty = false;

            const start = Math.max(0, latestTime - windowSeconds);

            for (const dataset of chart.data.datasets) {
                let stale = 0;

                while (stale < dataset.data.length && dataset.data[stale].x < start) {
                    stale++;
                }

                if (stale > 0) {
                    dataset.data.splice(0, stale);
                }
            }

            chart.options.scales.x.min = start;
            chart.options.scales.x.max = start + windowSeconds;
            chart.update("none");

            sensor.channels.forEach((channel, index) => {
                const value = latestValues[index];

                readouts[index].textContent =
                    value === null ? "--" : `${value.toFixed(channel.decimals)} ${channel.unit}`;
            });

            refreshStatistics();
        },

        statistics() {
            return { bytes: receivedBytes, samples: receivedSamples, lost: lostSamples };
        },
    };
}
