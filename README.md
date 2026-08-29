# Sensor Disc logger

Web Bluetooth app for streaming, watching and logging the Sensor Disc sensors.
Built for vet clinicians and researchers running test sessions on a dog: every
sensor gets its own graph, enable checkbox and settings, and one button starts
and records every enabled sensor to a CSV.

## Running it

Web Bluetooth needs Chrome or Edge, on desktop or Android. The page must be
served over http, because ES modules do not load from `file://`.

1. Serve this directory:

    ```sh
    python3 -m http.server 8000
    ```

1. Open the app:

    ```sh
    xdg-open http://localhost:8000
    ```

1. Press **Connect** and pick the device from the browser's chooser.

Chart.js loads from jsDelivr, pinned to an exact version in `sensor-card.js`.
There is no build step and nothing to install.

## Files

```sh
├── index.html      # the whole page
├── style.css       # the whole stylesheet
└── js
    ├── main.js         # composition root: connect, battery, record, redraw loop
    ├── sensors.js      # the Bluetooth spec, as data
    ├── bluetooth.js    # Web Bluetooth transport
    ├── sensor-card.js  # one sensor: DOM, chart, packet decode, config writes
    └── recorder.js     # CSV capture and download
```

Adding a sensor means adding one entry to `sensors.js`. Nothing else changes.

## Bluetooth

[`docs/bluetooth-protocol.md`](https://github.com/dog-health-tracker/sensor-discovery-hardware/blob/main/docs/bluetooth-protocol.md)
in the hardware repository is the source of truth for the service, the
characteristics, the packet format and the per-sensor settings. `js/sensors.js`
is that spec as data, one entry per sensor.

## Data rate and loss

Each card shows the sample rate it is actually receiving, averaged over a
second, and the record bar shows the payload the whole app is receiving in
kB/s. Both are measured, not derived from the configured rate.

Device-side loss is exact: every packet carries a count of the samples the
device gathered but could not send. Every packet also carries the device
timestamp of its first sample. A gap in the timestamps wider than the reported
count identifies additional loss on the link, so the card takes whichever of
the two is larger and never counts the same loss twice. A card turns red once
it has lost anything.

The kB/s figure is payload the app received. It is not link utilisation, which
would have to include the link layer overhead, the PHY rate and retransmissions
that the browser never exposes.

## CSV

**Start recording** applies the displayed settings and starts every enabled
sensor. **Stop and download** stops them and downloads the file. A disconnect
also stops the recording and downloads the captured data. The browser keeps
the enabled sensors, sensor settings and chart window across reloads.

There is one row per sample. `time_s` counts from the earliest recorded sample
and rows come out in time order. `sensor` identifies the source, while the wide
sample columns carry ASCII names with the unit on the end and remain blank for
other sensors.

`rate_Hz` and the sensor-specific setting columns contain the applied settings,
not merely the selections requested by the browser. They are repeated on every
sample so setting changes can be located directly in the data. Loss applies to
a packet rather than each sample: `device_dropped_before` and
`total_lost_before` are populated only on the packet's first sample. Summing
either column therefore does not count a multi-sample packet more than once.
`total_lost_before` includes additional loss inferred from timestamp gaps.

```csv
time_s,sensor,rate_Hz,device_dropped_before,total_lost_before,motion_accel_x_g,…,motion_accel_range_g,…,ecg_mV,…
0.000000,motion,240,0,0,0.0317,…,8,…,,…
0.004167,motion,240,,,0.0309,…,8,…,,…
0.005000,ecg,256,0,0,,…,,…,0.0878,…
```
