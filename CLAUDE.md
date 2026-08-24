# Sensor discovery web app

Web Bluetooth plotting and CSV logging for the Stage 1 dog sensor testing
platform, built for the client 5oceans. Stage 1 captures every sensor modality
for analysis. Do not design around Stage 2 commercialization features.

`README.md` is the source of truth for running the app and its file layout.
[`docs/bluetooth-protocol.md`](https://github.com/dog-health-tracker/sensor-discovery-hardware/blob/main/docs/bluetooth-protocol.md)
in the hardware repository is the source of truth for the Bluetooth service,
characteristics, and packet format. Change the protocol, firmware, and every
app that speaks it in the same coordinated change.

## Stage 1 data

- Log every channel raw and time-synchronized.
- Capture a simultaneous reference for every channel.
- Record session metadata across a diverse dog cohort.
- Treat the IMU as the anchor and optical PPG as the highest-risk modality.

## Repository facts

- The GitHub remote is private and contains client material.
- `.github/workflows/pages.yml` publishes the app to the public internet on
  pushes to `main` that change app or workflow files.
- The app is plain ES modules with no build step. Chart.js loads from a pinned
  CDN URL.
