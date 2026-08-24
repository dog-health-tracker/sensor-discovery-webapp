import { deviceNamePrefix, sensorServiceUuid, batteryServiceUuid } from "./sensors.js";

let device = null;
let characteristics = new Map();
let gattChain = Promise.resolve();

// Web Bluetooth allows one GATT operation at a time and rejects overlapping
// calls with "GATT operation already in progress", so everything queues here.
function queueGattOperation(operation) {
    const result = gattChain.then(operation, operation);

    gattChain = result.catch(() => {});

    return result;
}

function canonicalUuid(uuid) {
    return typeof uuid === "number"
        ? BluetoothUUID.canonicalUUID(uuid)
        : uuid.toLowerCase();
}

export function isConnected() {
    return Boolean(device && device.gatt.connected);
}

export function deviceName() {
    return device ? device.name : null;
}

export function hasCharacteristic(uuid) {
    return characteristics.has(canonicalUuid(uuid));
}

export async function connect(onDisconnect) {
    if (!navigator.bluetooth) {
        throw new Error(
            "This browser has no Web Bluetooth. Use Chrome or Edge on desktop or Android."
        );
    }

    device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: deviceNamePrefix }],
        optionalServices: [sensorServiceUuid, batteryServiceUuid],
    });

    const server = await device.gatt.connect();

    device.addEventListener("gattserverdisconnected", () => {
        characteristics = new Map();
        onDisconnect();
    });

    characteristics = new Map();

    for (const serviceUuid of [sensorServiceUuid, batteryServiceUuid]) {
        const service = await server.getPrimaryService(serviceUuid).catch(() => null);

        if (!service) {
            continue;
        }

        for (const characteristic of await service.getCharacteristics()) {
            characteristics.set(characteristic.uuid, characteristic);
        }
    }

    if (characteristics.size === 0) {
        await disconnect();

        throw new Error(
            `${device.name} exposes neither the sensor service nor a battery service.`
        );
    }

    return device.name;
}

export async function disconnect() {
    if (isConnected()) {
        await device.gatt.disconnect();
    }

    characteristics = new Map();
}

export async function subscribe(uuid, listener) {
    const characteristic = characteristics.get(canonicalUuid(uuid));

    if (!characteristic) {
        return false;
    }

    characteristic.addEventListener("characteristicvaluechanged", event =>
        listener(event.target.value)
    );

    await queueGattOperation(() => characteristic.startNotifications());

    return true;
}

export function readValue(uuid) {
    const characteristic = characteristics.get(canonicalUuid(uuid));

    if (!characteristic) {
        return Promise.resolve(null);
    }

    return queueGattOperation(() => characteristic.readValue());
}

export function writeValue(uuid, bytes) {
    const characteristic = characteristics.get(canonicalUuid(uuid));

    if (!characteristic) {
        return Promise.reject(new Error(`Characteristic ${uuid} is not on this device.`));
    }

    return queueGattOperation(() => characteristic.writeValueWithResponse(bytes));
}
