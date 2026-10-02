// ======================================================
// HEALTHY HOME - SMART HEALTH MONITORING SYSTEM
// ESP32 + MAX30102 + AD8232 + DHT22
// Humidity removed
// ======================================================

let port = null;
let reader = null;
let connected = false;

let ecgData = [];
let records = [];

let currentData = {
    heartRate: null,
    spo2: null,
    temperature: null,
    ecg: null
};

// ======================================================
// ELEMENTS
// ======================================================

const connectBtn = document.getElementById("connectBtn");
const statusDot = document.getElementById("statusDot");
const connectionText = document.getElementById("connectionText");

const heartRateEl = document.getElementById("heartRate");
const spo2El = document.getElementById("spo2");
const temperatureEl = document.getElementById("temperature");

const deviceState = document.getElementById("deviceState");
const dataLink = document.getElementById("dataLink");

const leadStatus = document.getElementById("leadStatus");
const signalOverlay = document.getElementById("signalOverlay");

const sampleCount = document.getElementById("sampleCount");
const ecgState = document.getElementById("ecgState");

const patientId = document.getElementById("patientId");
const patientName = document.getElementById("patientName");

const recordsBody = document.getElementById("recordsBody");
const recordCount = document.getElementById("recordCount");

const clock = document.getElementById("clock");

// ======================================================
// CLOCK
// ======================================================

function updateClock() {

    const now = new Date();

    clock.textContent = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

setInterval(updateClock, 1000);
updateClock();

// ======================================================
// CONNECT ESP32
// ======================================================

if (connectBtn) {

    connectBtn.addEventListener("click", async () => {

        if (connected) {
            await disconnectDevice();
        } else {
            await connectDevice();
        }

    });

}

// ======================================================
// CONNECT
// ======================================================

async function connectDevice() {

    if (!("serial" in navigator)) {

        alert(
            "Web Serial is not supported. Please open Healthy Home in Google Chrome or Microsoft Edge."
        );

        return;
    }

    try {

        port = await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        connected = true;

        setConnection(true);

        readSerial();

    } catch (error) {

        console.error(error);

        setConnection(false);

    }
}

// ======================================================
// DISCONNECT
// ======================================================

async function disconnectDevice() {

    connected = false;

    try {

        if (reader) {
            await reader.cancel();
            reader = null;
        }

        if (port) {
            await port.close();
            port = null;
        }

    } catch (error) {

        console.error(error);

    }

    setConnection(false);
}

// ======================================================
// CONNECTION UI
// ======================================================

function setConnection(state) {

    connected = state;

    if (state) {

        connectionText.textContent = "DEVICE CONNECTED";

        deviceState.textContent = "ONLINE";

        dataLink.textContent = "ACTIVE";

        connectBtn.textContent = "DISCONNECT";

        statusDot.classList.add("connected");

        ecgState.textContent = "MONITORING";

    } else {

        connectionText.textContent = "DEVICE NOT CONNECTED";

        deviceState.textContent = "OFFLINE";

        dataLink.textContent = "WAITING";

        connectBtn.textContent = "CONNECT DEVICE";

        statusDot.classList.remove("connected");

        ecgState.textContent = "STANDBY";

    }
}

// ======================================================
// SERIAL READING
// ======================================================

async function readSerial() {

    if (!port || !port.readable) return;

    const decoder = new TextDecoder();

    let buffer = "";

    reader = port.readable.getReader();

    try {

        while (connected) {

            const { value, done } = await reader.read();

            if (done) break;

            if (!value) continue;

            buffer += decoder.decode(value, {
                stream: true
            });

            const lines = buffer.split(/\r?\n/);

            buffer = lines.pop() || "";

            for (const line of lines) {

                if (line.trim()) {
                    parseESP32Data(line.trim());
                }

            }
        }

    } catch (error) {

        console.error("Serial error:", error);

        setConnection(false);

    } finally {

        reader.releaseLock();
        reader = null;

    }
}

// ======================================================
// ESP32 DATA PARSER
// ======================================================

function parseESP32Data(line) {

    console.log("ESP32:", line);

    // --------------------------------------------------
    // JSON FORMAT
    // Example:
    // {"hr":78,"spo2":98,"temp":36.5,"ecg":512}
    // --------------------------------------------------

    if (
        line.startsWith("{") &&
        line.endsWith("}")
    ) {

        try {

            const data = JSON.parse(line);

            processData({
                heartRate:
                    data.hr ??
                    data.heartRate ??
                    data.bpm,

                spo2:
                    data.spo2 ??
                    data.SpO2,

                temperature:
                    data.temp ??
                    data.temperature,

                ecg:
                    data.ecg ??
                    data.ECG

            });

            return;

        } catch (error) {

            console.log("Invalid JSON:", line);

        }
    }

    // --------------------------------------------------
    // CSV FORMAT
    // Example:
    // 78,98,36.5,512
    // --------------------------------------------------

    const parts = line.split(",");

    if (parts.length >= 4) {

        const values = parts.map(v => Number(v.trim()));

        if (values.every(v => Number.isFinite(v))) {

            processData({

                heartRate: values[0],

                spo2: values[1],

                temperature: values[2],

                ecg: values[3]

            });

            return;
        }
    }

    // --------------------------------------------------
    // KEY VALUE FORMAT
    // Example:
    // HR:78,SpO2:98,TEMP:36.5,ECG:512
    // --------------------------------------------------

    const data = {};

    line.split(",").forEach(part => {

        const separator =
            part.includes(":")
                ? ":"
                : "=";

        const pieces = part.split(separator);

        if (pieces.length < 2) return;

        const key =
            pieces[0]
                .trim()
                .toLowerCase();

        const value =
            Number(pieces[1].trim());

        if (!Number.isFinite(value)) return;

        if (
            key === "hr" ||
            key === "bpm" ||
            key === "heartrate" ||
            key === "heart_rate"
        ) {
            data.heartRate = value;
        }

        else if (
            key === "spo2" ||
            key === "sp02" ||
            key === "oxygen"
        ) {
            data.spo2 = value;
        }

        else if (
            key === "temp" ||
            key === "temperature"
        ) {
            data.temperature = value;
        }

        else if (key === "ecg") {
            data.ecg = value;
        }

    });

    if (Object.keys(data).length > 0) {
        processData(data);
    }
}

// ======================================================
// PROCESS DATA
// ======================================================

function processData(data) {

    if (Number.isFinite(Number(data.heartRate))) {

        currentData.heartRate =
            Number(data.heartRate);

        heartRateEl.textContent =
            Math.round(currentData.heartRate);

    }

    if (Number.isFinite(Number(data.spo2))) {

        currentData.spo2 =
            Number(data.spo2);

        spo2El.textContent =
            Math.round(currentData.spo2);

        updateOxygenBar(currentData.spo2);

    }

    if (Number.isFinite(Number(data.temperature))) {

        currentData.temperature =
            Number(data.temperature);

        temperatureEl.textContent =
            currentData.temperature.toFixed(1);

    }

    if (Number.isFinite(Number(data.ecg))) {

        currentData.ecg =
            Number(data.ecg);

        addECGPoint(currentData.ecg);

    }

    updateSignalStatus();

}

// ======================================================
// OXYGEN BAR
// ======================================================

function updateOxygenBar(value) {

    const fill =
        document.getElementById("oxygenFill");

    if (!fill) return;

    let percent =
        Math.max(0, Math.min(100, value));

    fill.style.width =
        percent + "%";
}

// ======================================================
// ECG
// ======================================================

function addECGPoint(value) {

    ecgData.push(Number(value));

    if (ecgData.length > 500) {
        ecgData.shift();
    }

    sampleCount.textContent =
        ecgData.length;

    drawECG();

}

// ======================================================
// ECG CANVAS
// ======================================================

function drawECG() {

    const canvas =
        document.getElementById("ecgChart");

    if (!canvas) return;

    const parent =
        canvas.parentElement;

    canvas.width =
        parent.clientWidth;

    canvas.height =
        parent.clientHeight;

    const ctx =
        canvas.getContext("2d");

    const width =
        canvas.width;

    const height =
        canvas.height;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    if (ecgData.length < 2) return;

    let min =
        Math.min(...ecgData);

    let max =
        Math.max(...ecgData);

    if (max === min) {

        max += 1;
        min -= 1;

    }

    ctx.beginPath();

    ecgData.forEach((value, index) => {

        const x =
            index *
            (width / (ecgData.length - 1));

        const normalized =
            (value - min) /
            (max - min);

        const y =
            height -
            normalized *
            (height - 20) -
            10;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

    });

    ctx.strokeStyle =
        "#16d9ff";

    ctx.lineWidth = 2;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";

    ctx.stroke();

    signalOverlay.style.display =
        "none";

}

// ======================================================
// ECG STATUS
// ======================================================

function updateSignalStatus() {

    if (ecgData.length > 5) {

        leadStatus.textContent =
            "LEAD STATUS: SIGNAL DETECTED";

        leadStatus.classList.add("active");

        document.getElementById("ecgState")
            .textContent = "ACTIVE";

    }

}

// ======================================================
// CAPTURE 10 SEC
// ======================================================

const captureBtn =
    document.getElementById("captureBtn");

if (captureBtn) {

    captureBtn.addEventListener(
        "click",
        () => {

            ecgState.textContent =
                "CAPTURING";

            let seconds = 0;

            const timer =
                setInterval(() => {

                    seconds++;

                    document.getElementById(
                        "captureTime"
                    ).textContent =
                        "00:" +
                        String(seconds)
                            .padStart(2, "0");

                    if (seconds >= 10) {

                        clearInterval(timer);

                        ecgState.textContent =
                            "CAPTURED";

                    }

                }, 1000);

        }
    );

}

// ======================================================
// SAVE RECORD
// ======================================================

function saveRecord() {

    const record = {

        time:
            new Date().toLocaleString("en-IN"),

        patient:
            patientName.value || "---",

        patientId:
            patientId.value || "---",

        heartRate:
            currentData.heartRate ?? "--",

        spo2:
            currentData.spo2 ?? "--",

        temperature:
            currentData.temperature ?? "--"

    };

    records.unshift(record);

    if (records.length > 50) {
        records.pop();
    }

    renderRecords();

}

// ======================================================
// RECORDS
// ======================================================

function renderRecords() {

    if (!recordsBody) return;

    recordsBody.innerHTML = "";

    records.forEach(record => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>${escapeHTML(record.time)}</td>

            <td>
                ${escapeHTML(
                    record.patient
                )}
            </td>

            <td>
                ${escapeHTML(
                    record.heartRate
                )} BPM
            </td>

            <td>
                ${escapeHTML(
                    record.spo2
                )} %
            </td>

            <td>
                ${escapeHTML(
                    record.temperature
                )} °C
            </td>

            <td>
                RECORDED
            </td>

        `;

        recordsBody.appendChild(row);

    });

    recordCount.textContent =
        records.length + " RECORDS";

}

// ======================================================
// REPORT
// ======================================================

const reportBtn =
    document.getElementById("reportBtn");

if (reportBtn) {

    reportBtn.addEventListener(
        "click",
        generateReport
    );

}

function generateReport() {

    document.getElementById(
        "reportPatientName"
    ).textContent =
        patientName.value || "---";

    document.getElementById(
        "reportPatientId"
    ).textContent =
        patientId.value || "---";

    document.getElementById(
        "reportDate"
    ).textContent =
        new Date().toLocaleString("en-IN");

    document.getElementById(
        "reportHR"
    ).textContent =
        currentData.heartRate !== null
            ? Math.round(currentData.heartRate) + " BPM"
            : "-- BPM";

    document.getElementById(
        "reportSpO2"
    ).textContent =
        currentData.spo2 !== null
            ? Math.round(currentData.spo2) + " %"
            : "-- %";

    document.getElementById(
        "reportTemp"
    ).textContent =
        currentData.temperature !== null
            ? currentData.temperature.toFixed(1) + " °C"
            : "-- °C";

    document.getElementById(
        "reportId"
    ).textContent =
        "HH-RPT-" +
        Date.now().toString().slice(-6);

    document.getElementById(
        "reportLead"
    ).textContent =
        ecgData.length > 5
            ? "SIGNAL DETECTED"
            : "NO SIGNAL";

    document.getElementById(
        "reportQuality"
    ).textContent =
        ecgData.length > 5
            ? "GOOD"
            : "0%";

    document.getElementById(
        "reportModal"
    ).classList.remove("hidden");

    drawReportECG();

}

// ======================================================
// REPORT ECG
// ======================================================

function drawReportECG() {

    const canvas =
        document.getElementById(
            "reportEcgCanvas"
        );

    if (!canvas || ecgData.length < 2)
        return;

    const ctx =
        canvas.getContext("2d");

    const width =
        canvas.width =
            canvas.parentElement.clientWidth;

    const height =
        canvas.height = 300;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    let min =
        Math.min(...ecgData);

    let max =
        Math.max(...ecgData);

    if (max === min) {

        max += 1;
        min -= 1;

    }

    ctx.beginPath();

    ecgData.forEach((value, index) => {

        const x =
            index *
            (width / (ecgData.length - 1));

        const y =
            height -
            (
                (value - min) /
                (max - min)
            ) *
            (height - 20) -
            10;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

    });

    ctx.strokeStyle =
        "#16d9ff";

    ctx.lineWidth = 2;

    ctx.stroke();

}

// ======================================================
// CLOSE REPORT
// ======================================================

const closeReport =
    document.getElementById("closeReport");

if (closeReport) {

    closeReport.addEventListener(
        "click",
        () => {

            document
                .getElementById("reportModal")
                .classList.add("hidden");

        }
    );

}

// ======================================================
// DOWNLOAD PDF
// ======================================================

const downloadReport =
    document.getElementById(
        "downloadReport"
    );

if (downloadReport) {

    downloadReport.addEventListener(
        "click",
        async () => {

            const report =
                document.getElementById(
                    "reportContent"
                );

            if (
                typeof html2canvas ===
                "undefined" ||
                !window.jspdf
            ) {

                window.print();

                return;

            }

            const canvas =
                await html2canvas(report, {
                    scale: 2,
                    backgroundColor: "#ffffff"
                });

            const image =
                canvas.toDataURL(
                    "image/png"
                );

            const {
                jsPDF
            } = window.jspdf;

            const pdf =
                new jsPDF(
                    "p",
                    "mm",
                    "a4"
                );

            const pageWidth =
                pdf.internal.pageSize.getWidth();

            const pageHeight =
                pdf.internal.pageSize.getHeight();

            const ratio =
                Math.min(
                    pageWidth / canvas.width,
                    pageHeight / canvas.height
                );

            const imgWidth =
                canvas.width * ratio;

            const imgHeight =
                canvas.height * ratio;

            pdf.addImage(
                image,
                "PNG",
                (pageWidth - imgWidth) / 2,
                10,
                imgWidth,
                imgHeight
            );

            pdf.save(
                "Healthy-Home-Report.pdf"
            );

        }
    );

}

// ======================================================
// CSV EXPORT
// ======================================================

const csvBtn =
    document.getElementById("csvBtn");

if (csvBtn) {

    csvBtn.addEventListener(
        "click",
        exportCSV
    );

}

function exportCSV() {

    if (ecgData.length === 0) {

        alert("No ECG data available.");

        return;

    }

    let csv =
        "Sample,ECG\n";

    ecgData.forEach(
        (value, index) => {

            csv +=
                `${index + 1},${value}\n`;

        }
    );

    const blob =
        new Blob(
            [csv],
            {
                type: "text/csv"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "Healthy-Home-ECG.csv";

    a.click();

    URL.revokeObjectURL(url);

}

// ======================================================
// HTML SAFETY
// ======================================================

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

// ======================================================
// RESIZE ECG
// ======================================================

window.addEventListener(
    "resize",
    () => {

        drawECG();

    }
);

// ======================================================
// SERIAL DISCONNECT EVENT
// ======================================================

if ("serial" in navigator) {

    navigator.serial.addEventListener(
        "disconnect",
        () => {

            connected = false;

            setConnection(false);

        }
    );

}

// ======================================================
// INITIAL STATE
// ======================================================

setConnection(false);

console.log(
    "Healthy Home dashboard initialized."
);
