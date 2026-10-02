```javascript
// ==========================================
// HEALTHY HOME
// ESP32-S3 HEALTH MONITORING DASHBOARD
// ==========================================

let patient = {
  id: "",
  name: ""
};

let currentMood = "Neutral";

let healthRecords = [];

let heartRateData = [];


// ==========================================
// START
// ==========================================

window.addEventListener("load", function () {

  loadPatient();

  setupECG();

  setupHealthGraph();

  updateClock();

  setInterval(updateClock, 1000);

});


// ==========================================
// PATIENT
// ==========================================

function savePatient() {

  patient.id =
    document.getElementById("patientId").value.trim();

  patient.name =
    document.getElementById("patientName").value.trim();

  localStorage.setItem(
    "healthyHomePatient",
    JSON.stringify(patient)
  );

  const button =
    document.getElementById("savePatientButton");

  button.textContent = "Saved";

  setTimeout(function () {
    button.textContent = "Save";
  }, 1500);

}


function loadPatient() {

  const saved =
    localStorage.getItem("healthyHomePatient");

  if (!saved) return;

  try {

    patient = JSON.parse(saved);

    document.getElementById("patientId").value =
      patient.id || "";

    document.getElementById("patientName").value =
      patient.name || "";

  } catch (error) {

    console.log("Patient data unavailable.");

  }

}


// ==========================================
// MOOD
// ==========================================

function setMood(mood) {

  const moods = {

    happy: {
      emoji: "😊",
      name: "Happy",
      description: "Patient is feeling positive."
    },

    neutral: {
      emoji: "🙂",
      name: "Neutral",
      description: "Patient is feeling normal."
    },

    sad: {
      emoji: "😔",
      name: "Sad",
      description: "Patient may need support."
    },

    angry: {
      emoji: "😠",
      name: "Angry",
      description: "Patient may need a calm environment."
    }

  };

  const selected =
    moods[mood] || moods.neutral;

  currentMood = selected.name;

  document.getElementById("moodEmoji").textContent =
    selected.emoji;

  document.getElementById("moodText").textContent =
    selected.name;

  document.getElementById("moodDescription").textContent =
    selected.description;

}


// ==========================================
// RECORD
// ==========================================

function addHealthRecord() {

  const pulse =
    document.getElementById("pulse").textContent;

  const spo2 =
    document.getElementById("spo2").textContent;

  const temperature =
    document.getElementById("temperature").textContent;

  const humidity =
    document.getElementById("humidity").textContent;


  if (
    pulse === "--" &&
    spo2 === "--" &&
    temperature === "--" &&
    humidity === "--"
  ) {

    alert("No sensor data available.");

    return;

  }


  const now =
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });


  healthRecords.push({

    time: now,
    pulse: pulse,
    spo2: spo2,
    temperature: temperature,
    humidity: humidity,
    mood: currentMood

  });


  displayRecords();

}


function displayRecords() {

  const body =
    document.getElementById("recordsBody");

  body.innerHTML = "";


  healthRecords
    .slice()
    .reverse()
    .forEach(function (record) {

      const row =
        document.createElement("tr");

      row.innerHTML = `
        <td>${record.time}</td>
        <td>${record.pulse} BPM</td>
        <td>${record.spo2} %</td>
        <td>${record.temperature} °C</td>
        <td>${record.humidity} %</td>
        <td>${record.mood}</td>
      `;

      body.appendChild(row);

    });


  document.getElementById("recordCount").textContent =
    healthRecords.length;

}


// ==========================================
// REPORT
// ==========================================

function printReport() {

  const report =
    window.open("", "_blank");

  if (!report) {

    alert("Please allow pop-ups for the report.");

    return;

  }


  report.document.write(`

    <!DOCTYPE html>

    <html>

    <head>

      <title>Healthy Home Report</title>

      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 35px;
          color: #18323d;
        }

        h1 {
          color: #087ea4;
        }

        table {
          border-collapse: collapse;
          width: 100%;
          margin-top: 25px;
        }

        th, td {
          border: 1px solid #ccdce1;
          padding: 10px;
          text-align: left;
        }

        th {
          background: #eef6f8;
        }

      </style>

    </head>

    <body>

      <h1>Healthy Home Health Report</h1>

      <p>
        <strong>Patient ID:</strong>
        ${patient.id || "Not provided"}
      </p>

      <p>
        <strong>Patient Name:</strong>
        ${patient.name || "Not provided"}
      </p>

      <table>

        <tr>
          <th>Parameter</th>
          <th>Reading</th>
        </tr>

        <tr>
          <td>Heart Rate</td>
          <td>${document.getElementById("pulse").textContent} BPM</td>
        </tr>

        <tr>
          <td>SpO₂</td>
          <td>${document.getElementById("spo2").textContent} %</td>
        </tr>

        <tr>
          <td>Temperature</td>
          <td>${document.getElementById("temperature").textContent} °C</td>
        </tr>

        <tr>
          <td>Humidity</td>
          <td>${document.getElementById("humidity").textContent} %</td>
        </tr>

        <tr>
          <td>Mood</td>
          <td>${currentMood}</td>
        </tr>

      </table>

      <p style="margin-top:25px;">
        Healthy Home - Health Monitoring System
      </p>

    </body>

    </html>

  `);

  report.document.close();

  report.focus();

  report.print();

}


// ==========================================
// ECG DISPLAY
// ==========================================

function setupECG() {

  const canvas =
    document.getElementById("ecgCanvas");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");


  function resize() {

    canvas.width =
      canvas.clientWidth;

    canvas.height =
      canvas.clientHeight;

  }


  resize();

  window.addEventListener("resize", resize);


  let ecgData = [];

  let x = 0;


  function draw() {

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);


    // Grid

    ctx.strokeStyle =
      "#dcebed";

    ctx.lineWidth = 1;


    for (
      let gridX = 0;
      gridX < width;
      gridX += 25
    ) {

      ctx.beginPath();

      ctx.moveTo(gridX, 0);
      ctx.lineTo(gridX, height);

      ctx.stroke();

    }


    for (
      let gridY = 0;
      gridY < height;
      gridY += 25
    ) {

      ctx.beginPath();

      ctx.moveTo(0, gridY);
      ctx.lineTo(width, gridY);

      ctx.stroke();

    }


    // No real ECG data yet

    ctx.beginPath();

    ctx.strokeStyle =
      "#087ea4";

    ctx.lineWidth = 2;


    for (
      let i = 0;
      i < width;
      i += 3
    ) {

      const y =
        height / 2 +
        Math.sin((i + x) * 0.035) * 2;

      if (i === 0) {

        ctx.moveTo(i, y);

      } else {

        ctx.lineTo(i, y);

      }

    }


    ctx.stroke();


    x += 1;


    requestAnimationFrame(draw);

  }


  draw();

}


// ==========================================
// HEART RATE GRAPH
// ==========================================

function setupHealthGraph() {

  const canvas =
    document.getElementById("healthChart");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");


  function resize() {

    canvas.width =
      canvas.clientWidth;

    canvas.height =
      canvas.clientHeight;

  }


  resize();

  window.addEventListener("resize", resize);


  function draw() {

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);


    ctx.strokeStyle =
      "#dcebed";

    ctx.lineWidth = 1;


    for (
      let y = 0;
      y <= height;
      y += 30
    ) {

      ctx.beginPath();

      ctx.moveTo(0, y);
      ctx.lineTo(width, y);

      ctx.stroke();

    }


    if (heartRateData.length > 1) {

      ctx.beginPath();

      ctx.strokeStyle =
        "#087ea4";

      ctx.lineWidth = 2;


      heartRateData.forEach(function(value, index) {

        const px =
          (index /
            (heartRateData.length - 1)) *
          width;

        const py =
          height -
          ((value - 40) / 120) *
          height;


        if (index === 0) {

          ctx.moveTo(px, py);

        } else {

          ctx.lineTo(px, py);

        }

      });


      ctx.stroke();

      document.getElementById("graphMessage")
        .style.display = "none";

    }

    requestAnimationFrame(draw);

  }


  draw();

}


// ==========================================
// ADD REAL HEART RATE TO GRAPH
// ==========================================

function updateHeartRate(value) {

  if (
    typeof value !== "number" ||
    isNaN(value)
  ) {
    return;
  }


  document.getElementById("pulse").textContent =
    Math.round(value);

  document.getElementById("pulseStatus").textContent =
    "Sensor connected";


  heartRateData.push(value);


  if (heartRateData.length > 60) {
    heartRateData.shift();
  }

}


// ==========================================
// REAL SENSOR DATA FUNCTIONS
// ==========================================

function updateSensorData(data) {

  if (!data) return;


  if (data.pulse !== undefined) {

    updateHeartRate(
      Number(data.pulse)
    );

  }


  if (data.spo2 !== undefined) {

    document.getElementById("spo2").textContent =
      Number(data.spo2).toFixed(0);

    document.getElementById("spo2Status").textContent =
      "Sensor connected";

  }


  if (data.temperature !== undefined) {

    document.getElementById("temperature").textContent =
      Number(data.temperature).toFixed(1);

    document.getElementById("temperatureStatus").textContent =
      "Sensor connected";

  }


  if (data.humidity !== undefined) {

    document.getElementById("humidity").textContent =
      Number(data.humidity).toFixed(0);

    document.getElementById("humidityStatus").textContent =
      "Sensor connected";

  }

}


// ==========================================
// ESP32 CONNECTION
// ==========================================

function setESP32Connected(connected) {

  const dot =
    document.getElementById("connectionDot");

  const text =
    document.getElementById("connectionText");


  if (connected) {

    dot.classList.add("online");

    text.textContent =
      "ESP32-S3 Connected";

    setStatus("espStatus", "Connected");

  } else {

    dot.classList.remove("online");

    text.textContent =
      "ESP32-S3 Not Connected";

    setStatus("espStatus", "Not Connected");

  }

}


function setStatus(id, text) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = text;
  }

}


// ==========================================
// ECG SENSOR STATUS
// ==========================================

function setECGConnected(connected) {

  const dot =
    document.getElementById("ecgDot");

  const text =
    document.getElementById("ecgStatus");


  if (connected) {

    dot.classList.add("active");

    text.textContent =
      "Connected";

    setStatus(
      "ad8232Status",
      "Connected"
    );

  } else {

    dot.classList.remove("active");

    text.textContent =
      "Not connected";

    setStatus(
      "ad8232Status",
      "Not Connected"
    );

  }

}


// ==========================================
// CLOCK
// ==========================================

function updateClock() {

  const time =
    new Date().toLocaleTimeString();

  const element =
    document.getElementById("graphTime");

  if (element) {
    element.textContent = time;
  }

}
```
