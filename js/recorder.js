import { sensors } from "./sensors.js";

// Sensors interleave, so rows arrive slightly out of order. Buffering twice the
// flush size and sorting before every flush restores a monotonic time column,
// as long as the disorder never exceeds one flush.
const bufferedRows = 8192;
const flushedRows = 4096;

export function createRecorder() {
    const columns = sensors.flatMap(sensor => sensor.channels.map(channel => channel.column));

    const layouts = new Map();
    let offset = 0;

    for (const sensor of sensors) {
        layouts.set(sensor.key, {
            lead: ",".repeat(offset),
            trail: ",".repeat(columns.length - offset - sensor.channels.length),
            decimals: sensor.channels.map(channel => channel.decimals),
        });

        offset += sensor.channels.length;
    }

    const header = ["time_s", ...columns].join(",");

    let chunks = [];
    let buffer = [];
    let rows = 0;
    let recording = false;
    let startSeconds = null;
    let startedAt = null;

    function flush(count) {
        if (count === 0) {
            return;
        }

        buffer.sort((first, second) => first.time - second.time);

        chunks.push(buffer.slice(0, count).map(entry => entry.row).join("\n") + "\n");
        buffer = buffer.slice(count);
    }

    return {
        isRecording() {
            return recording;
        },

        rowCount() {
            return rows;
        },

        elapsedSeconds() {
            return startedAt ? (Date.now() - startedAt) / 1000 : 0;
        },

        start() {
            chunks = [];
            buffer = [];
            rows = 0;
            startSeconds = null;
            startedAt = Date.now();
            recording = true;
        },

        stop() {
            recording = false;
            flush(buffer.length);
        },

        add(sensor, timeSeconds, values) {
            if (!recording) {
                return;
            }

            if (startSeconds === null) {
                startSeconds = timeSeconds;
            }

            const layout = layouts.get(sensor.key);
            const time = timeSeconds - startSeconds;
            const fields = values.map((value, index) =>
                Number.isFinite(value) ? value.toFixed(layout.decimals[index]) : ""
            );

            buffer.push({
                time,
                row: `${time.toFixed(6)},${layout.lead}${fields.join(",")}${layout.trail}`,
            });

            rows++;

            if (buffer.length >= bufferedRows) {
                flush(flushedRows);
            }
        },

        download() {
            const stamp = new Date(startedAt ?? Date.now())
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);

            const blob = new Blob([`${header}\n`, ...chunks], { type: "text/csv" });
            const link = document.createElement("a");

            link.href = URL.createObjectURL(blob);
            link.download = `sensor-disc-${stamp}.csv`;
            link.click();

            URL.revokeObjectURL(link.href);
        },
    };
}
