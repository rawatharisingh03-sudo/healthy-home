let port = null;
let reader = null;
let buffer = "";

let ecgData = [];
let recording = false;
let recordingStart = 0;
let recordingDuration = 10;
let recordingTimer = null;

let latest = {
    heartRate: null,
    spo2: null,
    temperature: null
};

const canvas = document.getElementById("ecgCanvas");
const ctx = canvas.getContext("2d");


function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    drawECG();
}

window.addEventListener("resize", resizeCanvas);
setTimeout(resizeCanvas, 100);


function setConnection(connected) {
    const dot = document.getElementById("statusDot");
    const status = document.getElementById("connectionStatus");
    const button = document.getElementById("connectBtn");

    if (connected) {
        dot.style.background = "#3c795f";
        status.textContent = "ESP32 CONNECTED";
        button.textContent = "DISCONNECT ESP32";
    } else {
        dot.style.background = "#89949a";
        status.textContent = "ESP32 DISCONNECTED";
        button.textContent = "CONNECT ESP32";
    }
}


document.getElementById("connectBtn").addEventListener("click", async () => {

    if (port) {
        await disconnectESP32();
        return;
    }

    if (!("serial" in navigator)) {
        alert("Web Serial requires Chrome or Edge.");
        return;
    }

    try {
        port = await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        setConnection(true);
        readSerial();

    } catch (error) {
        console.error(error);
        port = null;
        setConnection(false);
    }
});


async function disconnectESP32() {

    try {

        if (reader) {
            await reader.cancel();
            reader.releaseLock();
            reader = null;
        }

        if (port) {
            await port.close();
        }

    } catch (error) {
        console.error(error);
    }

    port = null;
    setConnection(false);
}


async function readSerial() {

    const decoder = new TextDecoder();

    while (port && port.readable) {

        reader = port.readable.getReader();

        try {

            while (true) {

                const result = await reader.read();

                if (result.done) break;

                if (result.value) {

                    buffer += decoder.decode(
                        result.value,
                        { stream: true }
                    );

                    const lines = buffer.split("\n");

                    buffer = lines.pop();

                    lines.forEach(line => {
                        processData(line.trim());
                    });
                }
            }

        } catch (error) {
            console.error(error);

        } finally {

            reader.releaseLock();
            reader = null;
        }
    }
}


function processData(line) {

    if (!line) return;

    try {

        const data = JSON.parse(line);

        if (data.heartRate !== undefined) {

            latest.heartRate = Number(data.heartRate);

            document.getElementById("heartRate").textContent =
                Number.isFinite(latest.heartRate)
                    ? Math.round(latest.heartRate)
                    : "--";
        }


        if (data.spo2 !== undefined) {

            latest.spo2 = Number(data.spo2);

            document.getElementById("spo2").textContent =
                Number.isFinite(latest.spo2)
                    ? Math.round(latest.spo2)
                    : "--";
        }


        if (data.temperature !== undefined) {

            latest.temperature = Number(data.temperature);

            document.getElementById("temperature").textContent =
                Number.isFinite(latest.temperature)
                    ? latest.temperature.toFixed(1)
                    : "--";
        }


        if (data.ecg !== undefined) {

            const value = Number(data.ecg);

            if (Number.isFinite(value)) {

                ecgData.push(value);

                if (ecgData.length > 5000) {
                    ecgData.shift();
                }

                document.getElementById("sampleCount").textContent =
                    ecgData.length;

                updateSignal();
                drawECG();
            }
        }

    } catch (error) {
        // Ignore non-JSON serial messages.
    }
}


function updateSignal() {

    const quality =
        document.getElementById("signalQuality");

    if (ecgData.length < 20) {
        quality.textContent = "--";
        return;
    }

    const data = ecgData.slice(-250);

    let min = Infinity;
    let max = -Infinity;

    data.forEach(value => {
        if (value < min) min = value;
        if (value > max) max = value;
    });

    const range = max - min;

    if (range < 5) {
        quality.textContent = "LOW";
    } else if (range < 30) {
        quality.textContent = "FAIR";
    } else {
        quality.textContent = "GOOD";
    }
}


function drawECG() {

    const rect = canvas.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    if (ecgData.length < 2) {

        ctx.fillStyle = "#69767d";
        ctx.font = "12px Arial";

        ctx.fillText(
            "WAITING FOR ECG SIGNAL...",
            22,
            height / 2
        );

        return;
    }

    const data = ecgData.slice(-1000);

    let min = Math.min(...data);
    let max = Math.max(...data);

    if (min === max) {
        min -= 1;
        max += 1;
    }

    const padding = 18;

    ctx.beginPath();

    data.forEach((value, index) => {

        const x =
            padding +
            (index / (data.length - 1)) *
            (width - padding * 2);

        const normalized =
            (value - min) / (max - min);

        const y =
            height -
            padding -
            normalized *
            (height - padding * 2);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.strokeStyle = "#1c536c";
    ctx.lineWidth = 1.4;
    ctx.stroke();
}


/* ============================
   AUTOMATIC RECORDING
   ============================ */

document.getElementById("startRecord")
    .addEventListener("click", startRecording);


document.getElementById("stopRecord")
    .addEventListener("click", () => {
        stopRecording(false);
    });


function startRecording() {

    if (recording) return;

    recordingDuration =
        Number(document.getElementById("duration").value);

    if (!Number.isFinite(recordingDuration) ||
        recordingDuration <= 0) {
        recordingDuration = 10;
    }

    /*
       Start a fresh ECG recording.
       The live ECG continues to display,
       but only data received after START
       is stored in this recording.
    */
    ecgData = [];

    document.getElementById("sampleCount").textContent = "0";

    recording = true;
    recordingStart = Date.now();

    document.getElementById("startRecord").disabled = true;
    document.getElementById("stopRecord").disabled = false;
    document.getElementById("duration").disabled = true;

    document.getElementById("recordingStatus").textContent =
        "Recording in progress...";

    document.getElementById("recordingProgress").style.width = "0%";

    updateRecordingTimer();

    clearInterval(recordingTimer);

    recordingTimer = setInterval(() => {

        const elapsed =
            (Date.now() - recordingStart) / 1000;

        const percentage =
            Math.min(
                100,
                (elapsed / recordingDuration) * 100
            );

        document.getElementById("recordingProgress")
            .style.width = percentage + "%";

        updateRecordingTimer();

        if (elapsed >= recordingDuration) {
            stopRecording(true);
        }

    }, 100);
}


function updateRecordingTimer() {

    if (!recording) return;

    const elapsed =
        Math.min(
            recordingDuration,
            (Date.now() - recordingStart) / 1000
        );

    const seconds = Math.floor(elapsed);

    const minutes =
        String(Math.floor(seconds / 60)).padStart(2, "0");

    const remainingSeconds =
        String(seconds % 60).padStart(2, "0");

    document.getElementById("recordingTimer").textContent =
        `${minutes}:${remainingSeconds}`;
}


function stopRecording(autoStopped = false) {

    if (!recording) return;

    recording = false;

    clearInterval(recordingTimer);
    recordingTimer = null;

    document.getElementById("startRecord").disabled = false;
    document.getElementById("stopRecord").disabled = true;
    document.getElementById("duration").disabled = false;

    document.getElementById("recordingProgress").style.width = "100%";

    document.getElementById("recordingTimer").textContent =
        formatDuration(recordingDuration);

    if (autoStopped) {
        document.getElementById("recordingStatus").textContent =
            "Recording complete — record saved";
    } else {
        document.getElementById("recordingStatus").textContent =
            "Recording stopped — record saved";
    }

    saveRecord();

    /*
       Automatically prepare the ECG report after
       the selected recording duration finishes.
    */
    if (autoStopped) {
        setTimeout(() => {
            generateReport();
        }, 300);
    }
}


function formatDuration(seconds) {

    const totalSeconds = Math.max(
        0,
        Math.round(seconds)
    );

    const minutes =
        String(Math.floor(totalSeconds / 60)).padStart(2, "0");

    const remainingSeconds =
        String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${remainingSeconds}`;
}


/* ============================
   SAVE RECORD
   ============================ */

function saveRecord() {

    const patientId =
        document.getElementById("patientId")
            .value.trim() || "UNKNOWN";

    const now = new Date();

    const record = {

        id:
            "REC-" +
            now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0") +
            "-" +
            Math.floor(1000 + Math.random() * 9000),

        date: now.toLocaleString(),

        patientId,

        heartRate: latest.heartRate,
        spo2: latest.spo2,
        temperature: latest.temperature,

        duration: recordingDuration,

        samples: ecgData.length,

        ecg: [...ecgData]
    };

    const records =
        JSON.parse(
            localStorage.getItem("healthyHomeRecords") || "[]"
        );

    records.unshift(record);

    /*
       Keep the latest 20 records.
    */
    const limitedRecords = records.slice(0, 20);

    localStorage.setItem(
        "healthyHomeRecords",
        JSON.stringify(limitedRecords)
    );

    loadRecords();
}


function loadRecords() {

    const body =
        document.getElementById("recordsBody");

    const records =
        JSON.parse(
            localStorage.getItem("healthyHomeRecords") || "[]"
        );

    body.innerHTML = "";

    records.forEach(record => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(record.id)}</td>
            <td>${escapeHTML(record.date)}</td>
            <td>${format(record.heartRate)}</td>
            <td>${format(record.spo2)}</td>
            <td>${formatTemperature(record.temperature)}</td>
            <td>${record.samples || 0}</td>
        `;

        body.appendChild(row);
    });

    document.getElementById("recordCount")
        .textContent = records.length + " RECORDS";
}


function format(value) {

    if (value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))) {
        return "--";
    }

    return Math.round(Number(value));
}


function formatTemperature(value) {

    if (value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(1);
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================
   ECG REPORT
   ============================ */

document.getElementById("reportBtn")
    .addEventListener("click", generateReport);


function generateReport() {

    const patientId =
        document.getElementById("patientId")
            .value.trim();

    const patientName =
        document.getElementById("patientName")
            .value.trim();

    const age =
        document.getElementById("patientAge")
            .value.trim();

    if (!patientId || !patientName) {

        alert(
            "Enter Patient ID and Patient Name first."
        );

        return;
    }

    if (ecgData.length < 20) {

        alert(
            "Not enough ECG data received."
        );

        return;
    }

    const reportCanvas =
        document.createElement("canvas");

    reportCanvas.width = 1800;
    reportCanvas.height = 520;

    const reportCtx =
        reportCanvas.getContext("2d");

    drawReportGraph(
        reportCtx,
        1800,
        520
    );

    const image =
        reportCanvas.toDataURL("image/png");

    const now = new Date();

    const reportId =
        "HH-" +
        now.getFullYear() +
        "-" +
        Math.floor(10000 + Math.random() * 90000);

    const report =
        window.open("", "_blank");

    if (!report) {

        alert(
            "Allow pop-ups to generate the report."
        );

        return;
    }

    report.document.write(`

<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Healthy Home ECG Report</title>

<style>

body {
    margin: 0;
    background: #eeeae3;
    color: #202b31;
    font-family: Arial, Helvetica, sans-serif;
}

.page {
    width: 92%;
    margin: 25px auto;
    background: white;
    padding: 0 22px 30px;
}

.header {
    border-top: 6px solid #142b3a;
    padding: 16px 0;
}

.header h1 {
    margin: 0;
    font-family: Georgia, serif;
    font-size: 23px;
}

.header p {
    color: #68767e;
    font-size: 9px;
    margin-top: 5px;
}

.info {
    border: 1px solid #ccd4d7;
    background: #f5f7f7;
    display: grid;
    grid-template-columns: repeat(3,1fr);
}

.info div {
    padding: 11px;
    border-right: 1px solid #d5dcdf;
    border-bottom: 1px solid #d5dcdf;
    font-size: 10px;
}

.info b {
    color: #68767e;
    margin-right: 7px;
}

.title {
    margin-top: 22px;
    font-size: 11px;
    font-weight: bold;
    color: #142b3a;
}

.graph {
    border: 1px solid #cbd2d4;
    margin-top: 8px;
    padding: 8px;
}

.graph img {
    display: block;
    width: 100%;
}

.analysis {
    margin-top: 15px;
    border: 1px solid #cbd2d4;
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.analysis div {
    padding: 15px;
}

.analysis h2 {
    font-family: Georgia, serif;
    font-size: 14px;
    margin-top: 0;
}

.analysis p {
    font-size: 10px;
    margin: 7px 0;
}

.notice {
    margin-top: 45px;
    background: #f3f0e9;
    border-left: 5px solid #a14e45;
    padding: 12px;
    font-size: 9px;
    line-height: 1.6;
}

.notice b {
    color: #a14e45;
}

@media print {

    body {
        background: white;
    }

    .page {
        width: 100%;
        margin: 0;
    }

}

</style>

</head>

<body>

<div class="page">

<div class="header">

<h1>
HEALTHY HOME — ${recordingDuration}-SECOND ECG REPORT
</h1>

<p>
ESP32 BIOMEDICAL MONITORING SYSTEM • EXPERIMENTAL PROTOTYPE
</p>

</div>


<div class="info">

<div><b>RECORD ID</b>${reportId}</div>
<div><b>PATIENT ID</b>${escapeHTML(patientId)}</div>
<div><b>PATIENT NAME</b>${escapeHTML(patientName)}</div>

<div><b>AGE</b>${escapeHTML(age || "--")}</div>
<div><b>DATE / TIME</b>${now.toLocaleString()}</div>
<div><b>DEVICE</b>ESP32 + AD8232</div>

<div><b>HEART RATE</b>${format(latest.heartRate)} BPM</div>
<div><b>SpO₂</b>${format(latest.spo2)} %</div>
<div><b>TEMPERATURE</b>${formatTemperature(latest.temperature)} °C</div>

<div><b>SAMPLE RATE</b>250 Hz</div>
<div><b>DURATION</b>${recordingDuration} Seconds</div>
<div><b>SAMPLES</b>${ecgData.length}</div>

</div>


<div class="title">
ECG RHYTHM STRIP — AD8232
</div>

<div class="graph">
<img src="${image}">
</div>


<div class="analysis">

<div>

<h2>RECORDED PARAMETERS</h2>

<p>
Signal Quality:
<b>${escapeHTML(
    document.getElementById("signalQuality").textContent
)}</b>
</p>

<p>
Sampling Rate:
<b>250 Hz</b>
</p>

<p>
Recorded Duration:
<b>${recordingDuration} seconds</b>
</p>

<p>
Recorded Samples:
<b>${ecgData.length}</b>
</p>

</div>

<div>

<h2>SYSTEM OBSERVATION</h2>

<p>
ECG electrical waveform was captured by the prototype during the selected recording interval.
</p>

<p>
This software does not perform automated clinical diagnosis.
</p>

</div>

</div>


<div class="notice">

<b>EXPERIMENTAL PROTOTYPE:</b>

This report is generated by an educational electronics and software
prototype. The measurements and ECG visualization are for engineering
and demonstration purposes only and must not be treated as a medical diagnosis.

</div>

</div>

<script>
window.onload = function() {
    window.print();
};
<\/script>

</body>

</html>

    `);

    report.document.close();
}


function drawReportGraph(ctx, width, height) {

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#ddd7cd";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 25) {

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y < height; y += 25) {

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const data =
        ecgData.slice(-2500);

    if (data.length < 2) return;

    let min = Math.min(...data);
    let max = Math.max(...data);

    if (min === max) {
        min -= 1;
        max += 1;
    }

    ctx.beginPath();

    data.forEach((value, index) => {

        const x =
            12 +
            (index / (data.length - 1)) *
            (width - 24);

        const normalized =
            (value - min) / (max - min);

        const y =
            height -
            25 -
            normalized *
            (height - 50);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.strokeStyle = "#183f52";
    ctx.lineWidth = 2;

    ctx.stroke();
}


loadRecords();
