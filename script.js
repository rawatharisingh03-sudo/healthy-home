/* =========================================================
   HEALTHY HOME - MEDICAL DASHBOARD
   script.js
   ========================================================= */

const state = {
    connected: false,
    serialPort: null,
    reader: null,
    patientId: "",
    patientName: "",
    readings: [],
    ecgData: [],
    current: {
        pulse: "--",
        spo2: "--",
        temperature: "--",
        humidity: "--"
    }
};

const MAX_ECG_POINTS = 180;
const MAX_READINGS = 60;

const $ = (id) => document.getElementById(id);

/* ---------- Safe element helpers ---------- */

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function numberValue(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/* ---------- Patient ---------- */

function savePatient() {
    const id = $("patientId")?.value.trim() || "";
    const name = $("patientName")?.value.trim() || "";

    state.patientId = id;
    state.patientName = name;

    localStorage.setItem(
        "healthyHomePatient",
        JSON.stringify({
            id,
            name
        })
    );

    updatePatientDisplay();
}

function loadPatient() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("healthyHomePatient") || "{}"
        );

        state.patientId = saved.id || "";
        state.patientName = saved.name || "";

        if ($("patientId")) $("patientId").value = state.patientId;
        if ($("patientName")) $("patientName").value = state.patientName;
    } catch {
        state.patientId = "";
        state.patientName = "";
    }

    updatePatientDisplay();
}

function updatePatientDisplay() {
    setText("displayPatientId", state.patientId || "--");
    setText("displayPatientName", state.patientName || "--");
}

/* ---------- Dashboard values ---------- */

function updateVital(id, value, suffix = "") {
    const el = $(id);
    if (!el) return;

    if (value === "--" || value === null || value === undefined) {
        el.textContent = "--";
        return;
    }

    el.textContent = `${value}${suffix}`;
}

function updateDashboard(data) {
    if (data.pulse !== undefined) {
        const v = numberValue(data.pulse);
        if (v !== null) state.current.pulse = v;
    }

    if (data.spo2 !== undefined) {
        const v = numberValue(data.spo2);
        if (v !== null) state.current.spo2 = v;
    }

    if (data.temperature !== undefined) {
        const v = numberValue(data.temperature);
        if (v !== null) state.current.temperature = v;
    }

    if (data.humidity !== undefined) {
        const v = numberValue(data.humidity);
        if (v !== null) state.current.humidity = v;
    }

    updateVital("pulse", state.current.pulse, " BPM");
    updateVital("spo2", state.current.spo2, " %");
    updateVital("temperature", state.current.temperature, " °C");
    updateVital("humidity", state.current.humidity, " %");

    updateStatus();
    updateTime();
}

/* ---------- Health status ---------- */

function updateStatus() {
    const pulse = numberValue(state.current.pulse);
    const spo2 = numberValue(state.current.spo2);

    let status = "Waiting for data";

    if (pulse !== null && spo2 !== null) {
        if (spo2 < 90) {
            status = "Attention";
        } else if (pulse < 50 || pulse > 120) {
            status = "Attention";
        } else {
            status = "Monitoring";
        }
    }

    setText("healthStatus", status);
    setText("overallStatus", status);
}

/* ---------- Time ---------- */

function updateTime() {
    const el = $("lastUpdated");
    if (!el) return;

    const now = new Date();

    el.textContent = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

/* ---------- ECG ---------- */

function addECGPoint(value) {
    const v = numberValue(value);

    if (v === null) return;

    state.ecgData.push(v);

    if (state.ecgData.length > MAX_ECG_POINTS) {
        state.ecgData.shift();
    }

    drawECG();
}

function drawECG() {
    const canvas = $("ecgCanvas");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    /* ECG grid */

    ctx.beginPath();

    for (let x = 0; x <= width; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.strokeStyle = "rgba(0, 180, 220, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (state.ecgData.length < 2) {
        return;
    }

    let min = Math.min(...state.ecgData);
    let max = Math.max(...state.ecgData);

    if (max === min) {
        max += 1;
        min -= 1;
    }

    const padding = 18;

    ctx.beginPath();

    state.ecgData.forEach((value, index) => {
        const x =
            (index / (MAX_ECG_POINTS - 1)) *
            (width - padding * 2) +
            padding;

        const y =
            height -
            ((value - min) / (max - min)) *
                (height - padding * 2) -
            padding;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.strokeStyle = "#16d9ff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
}

/* ---------- Records ---------- */

function addRecord() {
    const record = {
        time: new Date().toLocaleString("en-IN"),
        patientId: state.patientId,
        patientName: state.patientName,
        pulse: state.current.pulse,
        spo2: state.current.spo2,
        temperature: state.current.temperature,
        humidity: state.current.humidity
    };

    state.readings.unshift(record);

    if (state.readings.length > MAX_READINGS) {
        state.readings.pop();
    }

    localStorage.setItem(
        "healthyHomeRecords",
        JSON.stringify(state.readings)
    );

    renderRecords();
}

function loadRecords() {
    try {
        state.readings = JSON.parse(
            localStorage.getItem("healthyHomeRecords") || "[]"
        );

        if (!Array.isArray(state.readings)) {
            state.readings = [];
        }
    } catch {
        state.readings = [];
    }

    renderRecords();
}

function renderRecords() {
    const tbody = $("recordsBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    state.readings.forEach((record) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHTML(record.time)}</td>
            <td>${escapeHTML(record.patientId || "--")}</td>
            <td>${escapeHTML(record.patientName || "--")}</td>
            <td>${escapeHTML(record.pulse)} BPM</td>
            <td>${escapeHTML(record.spo2)} %</td>
            <td>${escapeHTML(record.temperature)} °C</td>
            <td>${escapeHTML(record.humidity)} %</td>
        `;

        tbody.appendChild(tr);
    });

    setText("recordCount", state.readings.length);
}

function clearRecords() {
    state.readings = [];

    localStorage.removeItem("healthyHomeRecords");

    renderRecords();
}

/* ---------- Serial / ESP32 ---------- */

async function connectESP32() {
    if (!("serial" in navigator)) {
        alert(
            "Web Serial is not supported in this browser. Use Chrome or Edge on a supported device."
        );
        return;
    }

    try {
        const port = await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        state.serialPort = port;
        state.connected = true;

        updateConnectionUI(true);

        readSerialData();
    } catch (error) {
        console.error("ESP32 connection error:", error);
        updateConnectionUI(false);
    }
}

async function disconnectESP32() {
    try {
        if (state.reader) {
            await state.reader.cancel();
            state.reader = null;
        }

        if (state.serialPort) {
            await state.serialPort.close();
        }
    } catch (error) {
        console.error(error);
    }

    state.serialPort = null;
    state.connected = false;

    updateConnectionUI(false);
}

function updateConnectionUI(connected) {
    setText(
        "connectionStatus",
        connected ? "ESP32 Connected" : "ESP32 Disconnected"
    );

    const indicator = $("connectionIndicator");

    if (indicator) {
        indicator.classList.toggle("connected", connected);
    }
}

/* ---------- Serial parser ---------- */

async function readSerialData() {
    if (!state.serialPort) return;

    const decoder = new TextDecoder();

    let buffer = "";

    try {
        while (state.serialPort.readable && state.connected) {
            state.reader = state.serialPort.readable.getReader();

            try {
                while (true) {
                    const { value, done } =
                        await state.reader.read();

                    if (done) break;

                    if (value) {
                        buffer += decoder.decode(value, {
                            stream: true
                        });

                        const lines = buffer.split(/\r?\n/);

                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            parseESP32Line(line.trim());
                        }
                    }
                }
            } finally {
                state.reader.releaseLock();
                state.reader = null;
            }
        }
    } catch (error) {
        console.error("Serial read error:", error);
        state.connected = false;
        updateConnectionUI(false);
    }
}

function parseESP32Line(line) {
    if (!line) return;

    console.log("ESP32:", line);

    /*
       Supported formats:

       JSON:
       {"pulse":78,"spo2":98,"temperature":27.4,"humidity":61,"ecg":512}

       CSV:
       78,98,27.4,61,512

       Key/value:
       pulse=78,spo2=98,temp=27.4,humidity=61,ecg=512
    */

    let data = null;

    /* JSON */

    if (line.startsWith("{") && line.endsWith("}")) {
        try {
            data = JSON.parse(line);
        } catch {
            data = null;
        }
    }

    /* CSV */

    if (!data && line.includes(",")) {
        const parts = line.split(",");

        if (
            parts.length >= 2 &&
            parts.every((p) => p.trim() !== "")
        ) {
            const values = parts.map((p) => numberValue(p));

            if (values.every((v) => v !== null)) {
                data = {
                    pulse: values[0],
                    spo2: values[1],
                    temperature: values[2],
                    humidity: values[3],
                    ecg: values[4]
                };
            }
        }
    }

    /* Key/value */

    if (!data && line.includes("=")) {
        data = {};

        line.split(",").forEach((part) => {
            const [key, value] = part.split("=");

            if (!key || value === undefined) return;

            const cleanKey = key.trim().toLowerCase();

            const cleanValue = value.trim();

            if (
                cleanKey === "pulse" ||
                cleanKey === "bpm" ||
                cleanKey === "heartrate" ||
                cleanKey === "heart_rate"
            ) {
                data.pulse = cleanValue;
            }

            if (
                cleanKey === "spo2" ||
                cleanKey === "oxygen" ||
                cleanKey === "o2"
            ) {
                data.spo2 = cleanValue;
            }

            if (
                cleanKey === "temperature" ||
                cleanKey === "temp"
            ) {
                data.temperature = cleanValue;
            }

            if (cleanKey === "humidity") {
                data.humidity = cleanValue;
            }

            if (cleanKey === "ecg") {
                data.ecg = cleanValue;
            }
        });
    }

    if (!data) return;

    normalizeData(data);
}

/* ---------- Normalize sensor names ---------- */

function normalizeData(data) {
    const normalized = {};

    normalized.pulse =
        data.pulse ??
        data.bpm ??
        data.heartRate ??
        data.heart_rate;

    normalized.spo2 =
        data.spo2 ??
        data.SpO2 ??
        data.oxygen ??
        data.o2;

    normalized.temperature =
        data.temperature ??
        data.temp ??
        data.tempC;

    normalized.humidity =
        data.humidity ??
        data.hum;

    normalized.ecg =
        data.ecg ??
        data.ECG ??
        data.adc;

    updateDashboard(normalized);

    if (normalized.ecg !== undefined) {
        addECGPoint(normalized.ecg);
    }
}

/* ---------- Report ---------- */

function generateReport() {
    const patientName =
        state.patientName || "Patient";

    const patientId =
        state.patientId || "--";

    const reportDate =
        new Date().toLocaleString("en-IN");

    const reportHTML = `
        <div class="report-header">
            <h2>Healthy Home Health Report</h2>
            <p>${escapeHTML(reportDate)}</p>
        </div>

        <div class="report-patient">
            <p><strong>Patient ID:</strong> ${escapeHTML(patientId)}</p>
            <p><strong>Patient Name:</strong> ${escapeHTML(patientName)}</p>
        </div>

        <div class="report-vitals">
            <p><strong>Pulse Rate:</strong> ${escapeHTML(state.current.pulse)} BPM</p>
            <p><strong>SpO₂:</strong> ${escapeHTML(state.current.spo2)} %</p>
            <p><strong>Temperature:</strong> ${escapeHTML(state.current.temperature)} °C</p>
            <p><strong>Humidity:</strong> ${escapeHTML(state.current.humidity)} %</p>
        </div>

        <div class="report-ecg">
            <h3>ECG Recording</h3>
            <canvas id="reportECGCanvas" width="900" height="280"></canvas>
        </div>
    `;

    const reportContainer = $("reportContent");

    if (reportContainer) {
        reportContainer.innerHTML = reportHTML;

        drawReportECG();
    }

    const reportSection = $("reportSection");

    if (reportSection) {
        reportSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function drawReportECG() {
    const canvas = $("reportECGCanvas");

    if (!canvas || state.ecgData.length < 2) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const width = canvas.width;
    const height = canvas.height;

    let min = Math.min(...state.ecgData);
    let max = Math.max(...state.ecgData);

    if (max === min) {
        max += 1;
        min -= 1;
    }

    /* Grid */

    ctx.beginPath();

    for (let x = 0; x < width; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    for (let y = 0; y < height; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.strokeStyle = "rgba(0, 180, 220, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* ECG */

    ctx.beginPath();

    state.ecgData.forEach((value, index) => {
        const x =
            (index / (state.ecgData.length - 1)) *
            width;

        const y =
            height -
            ((value - min) / (max - min)) *
                (height - 20) -
            10;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.strokeStyle = "#16d9ff";
    ctx.lineWidth = 2;
    ctx.stroke();
}

/* ---------- Print report ---------- */

function printReport() {
    window.print();
}

/* ---------- HTML safety ---------- */

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "--";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ---------- Buttons ---------- */

function setupButtons() {
    const connectBtn = $("connectESP32");

    if (connectBtn) {
        connectBtn.addEventListener(
            "click",
            connectESP32
        );
    }

    const disconnectBtn = $("disconnectESP32");

    if (disconnectBtn) {
        disconnectBtn.addEventListener(
            "click",
            disconnectESP32
        );
    }

    const patientBtn = $("savePatient");

    if (patientBtn) {
        patientBtn.addEventListener(
            "click",
            savePatient
        );
    }

    const recordBtn = $("saveRecord");

    if (recordBtn) {
        recordBtn.addEventListener(
            "click",
            addRecord
        );
    }

    const clearBtn = $("clearRecords");

    if (clearBtn) {
        clearBtn.addEventListener(
            "click",
            clearRecords
        );
    }

    const reportBtn = $("generateReport");

    if (reportBtn) {
        reportBtn.addEventListener(
            "click",
            generateReport
        );
    }

    const printBtn = $("printReport");

    if (printBtn) {
        printBtn.addEventListener(
            "click",
            printReport
        );
    }
}

/* ---------- Start ---------- */

document.addEventListener("DOMContentLoaded", () => {
    loadPatient();
    loadRecords();
    setupButtons();

    updateDashboard({
        pulse: "--",
        spo2: "--",
        temperature: "--",
        humidity: "--"
    });

    drawECG();

    if ("serial" in navigator) {
        navigator.serial.addEventListener(
            "disconnect",
            () => {
                state.connected = false;
                updateConnectionUI(false);
            }
        );
    }
});

/* ---------- Global access ---------- */

window.HealthyHome = {
    connectESP32,
    disconnectESP32,
    savePatient,
    addRecord,
    clearRecords,
    generateReport,
    printReport,
    addECGPoint,
    updateDashboard
};
