export const deviceNamePrefix = "Sensor Disc";

export const sensorServiceUuid = "5e550000-1487-4453-8e57-6325943ddeba";
export const batteryServiceUuid = 0x180f;
export const batteryLevelUuid = 0x2a19;
export const batteryLevelStatusUuid = 0x2bed;

export const packetHeaderBytes = 12;
export const packetDroppedOffset = 8;
export const configBytes = 6;

const channelPalette = [
    "#3b82f6",
    "#f97316",
    "#22c55e",
    "#a855f7",
    "#ec4899",
    "#06b6d4",
];

const ledCurrentOptions = [
    { label: "Off", value: 0 },
    { label: "5 mA", value: 10 },
    { label: "10 mA", value: 20 },
    { label: "20 mA", value: 40 },
    { label: "30 mA", value: 60 },
    { label: "50 mA", value: 100 },
    { label: "75 mA", value: 150 },
    { label: "100 mA", value: 200 },
    { label: "124 mA", value: 248 },
];

export const sensors = [
    {
        key: "motion",
        name: "Inertial motion",
        part: "LSM6DSV16BX",
        dataUuid: "5e550101-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550102-1487-4453-8e57-6325943ddeba",
        channels: [
            { key: "accel_x", label: "Accel X", unit: "g", decimals: 4 },
            { key: "accel_y", label: "Accel Y", unit: "g", decimals: 4 },
            { key: "accel_z", label: "Accel Z", unit: "g", decimals: 4 },
            { key: "gyro_x", label: "Gyro X", unit: "dps", decimals: 2 },
            { key: "gyro_y", label: "Gyro Y", unit: "dps", decimals: 2 },
            { key: "gyro_z", label: "Gyro Z", unit: "dps", decimals: 2 },
        ],
        rates: [15, 30, 60, 120, 240, 480],
        defaultRate: 3,
        controls: [
            {
                byte: 2,
                label: "Accel range",
                options: ["±2 g", "±4 g", "±8 g", "±16 g"],
                default: 2,
            },
            {
                byte: 3,
                label: "Gyro range",
                options: ["±125 dps", "±250 dps", "±500 dps", "±1000 dps", "±2000 dps", "±4000 dps"],
                default: 4,
            },
        ],
    },
    {
        key: "vibration",
        name: "Cardiac vibration",
        part: "ADXL382",
        dataUuid: "5e550201-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550202-1487-4453-8e57-6325943ddeba",
        channels: [
            { key: "x", label: "X", unit: "g", decimals: 5 },
            { key: "y", label: "Y", unit: "g", decimals: 5 },
            { key: "z", label: "Z", unit: "g", decimals: 5 },
        ],
        rates: [125, 250, 500, 1000],
        defaultRate: 2,
        controls: [
            {
                byte: 2,
                label: "Range",
                options: ["±15 g", "±30 g", "±60 g"],
                default: 0,
            },
        ],
    },
    {
        key: "pulse",
        name: "Optical pulse",
        part: "MAXM86161",
        dataUuid: "5e550301-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550302-1487-4453-8e57-6325943ddeba",
        channels: [
            { key: "green", label: "Green", unit: "nA", decimals: 2, colour: "#22c55e" },
            { key: "infrared", label: "Infrared", unit: "nA", decimals: 2, colour: "#f97316" },
            { key: "red", label: "Red", unit: "nA", decimals: 2, colour: "#ef4444" },
        ],
        rates: [25, 50, 100, 200, 400],
        defaultRate: 2,
        controls: [
            {
                byte: 2,
                label: "ADC full scale",
                options: ["4096 nA", "8192 nA", "16384 nA", "32768 nA"],
                default: 2,
            },
            { byte: 3, label: "Green LED", options: ledCurrentOptions, default: 4 },
            { byte: 4, label: "Infrared LED", options: ledCurrentOptions, default: 4 },
            { byte: 5, label: "Red LED", options: ledCurrentOptions, default: 4 },
        ],
    },
    {
        key: "ecg",
        name: "ECG",
        part: "MAX30001",
        dataUuid: "5e550401-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550402-1487-4453-8e57-6325943ddeba",
        channels: [{ key: "ecg", label: "ECG", unit: "mV", decimals: 4 }],
        rates: [128, 256, 512],
        defaultRate: 1,
        controls: [
            {
                byte: 2,
                label: "Gain",
                options: ["20 V/V", "40 V/V", "80 V/V", "160 V/V"],
                default: 1,
            },
            {
                byte: 3,
                label: "Low pass",
                options: ["Bypass", "40 Hz", "100 Hz", "150 Hz"],
                default: 1,
            },
        ],
    },
    {
        key: "respiration",
        name: "Respiration",
        part: "MAX30001 bioimpedance",
        dataUuid: "5e550501-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550502-1487-4453-8e57-6325943ddeba",
        channels: [{ key: "impedance", label: "Impedance", unit: "Ω", decimals: 3 }],
        rates: [32, 64],
        defaultRate: 1,
        controls: [
            {
                byte: 2,
                label: "Drive current",
                options: ["8 µA", "16 µA", "32 µA", "48 µA", "64 µA", "80 µA", "96 µA"],
                default: 2,
            },
            {
                byte: 3,
                label: "Gain",
                options: ["10 V/V", "20 V/V", "40 V/V", "80 V/V"],
                default: 1,
            },
        ],
    },
    {
        key: "sound",
        name: "Body sound",
        part: "V2S200D",
        dataUuid: "5e550601-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550602-1487-4453-8e57-6325943ddeba",
        channels: [{ key: "envelope", label: "Envelope", unit: "dBFS", decimals: 2 }],
        rates: [25, 50, 100, 200],
        defaultRate: 2,
        controls: [
            {
                byte: 2,
                label: "Band",
                options: ["Heart 20–150 Hz", "Lung 150–1000 Hz", "Wide 20–4000 Hz"],
                default: 0,
            },
        ],
    },
    {
        key: "temperature",
        name: "Temperature",
        part: "TMP117",
        dataUuid: "5e550701-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550702-1487-4453-8e57-6325943ddeba",
        channels: [{ key: "temperature", label: "Temperature", unit: "°C", decimals: 4 }],
        rates: [0.25, 1, 2, 4, 8],
        defaultRate: 1,
        controls: [
            {
                byte: 2,
                label: "Averaging",
                options: ["None", "8 samples", "32 samples", "64 samples"],
                default: 1,
            },
        ],
    },
    {
        key: "pressure",
        name: "Barometric pressure",
        part: "BMP581",
        dataUuid: "5e550801-1487-4453-8e57-6325943ddeba",
        configUuid: "5e550802-1487-4453-8e57-6325943ddeba",
        channels: [{ key: "pressure", label: "Pressure", unit: "hPa", decimals: 3 }],
        rates: [1, 5, 10, 25, 50],
        defaultRate: 0,
        controls: [
            {
                byte: 2,
                label: "Oversampling",
                options: ["×1", "×4", "×16", "×64", "×128"],
                default: 2,
            },
        ],
    },
];

const asciiUnits = { "°C": "degC", "Ω": "ohm" };

for (const sensor of sensors) {
    const units = [...new Set(sensor.channels.map(channel => channel.unit))];

    sensor.channels.forEach((channel, index) => {
        const unit = asciiUnits[channel.unit] ?? channel.unit;
        const name = channel.key === sensor.key ? sensor.key : `${sensor.key}_${channel.key}`;

        channel.colour ??= channelPalette[index % channelPalette.length];
        channel.axis = units.indexOf(channel.unit) === 0 ? "y" : "y2";
        channel.column = `${name}_${unit}`;
    });

    sensor.units = units;
}

export function defaultConfig(sensor) {
    const config = new Uint8Array(configBytes);

    config[1] = sensor.defaultRate;

    for (const control of sensor.controls) {
        config[control.byte] = controlValue(control, control.default);
    }

    return config;
}

export function controlValue(control, index) {
    const option = control.options[index];

    return typeof option === "string" ? index : option.value;
}

export function controlIndex(control, value) {
    if (typeof control.options[0] === "string") {
        return value;
    }

    const index = control.options.findIndex(option => option.value === value);

    return index < 0 ? 0 : index;
}

export function controlLabel(option) {
    return typeof option === "string" ? option : option.label;
}
