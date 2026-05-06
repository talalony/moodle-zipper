let csvData = null;
let pdfFiles = [];
let generatedZip = null;

// File upload handlers
document.getElementById("csvFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        Papa.parse(event.target.result, {
          header: true,
          skipEmptyLines: true,
          complete: function (results) {
            csvData = results.data;
            document.getElementById("csvInfo").textContent =
              `✓ ${csvData.length} students loaded`;
            document.getElementById("csvInfo").className = "file-info success";
            checkIfReadyToProcess();
          },
          error: function (error) {
            showError("CSV parsing error: " + error.message);
            document.getElementById("csvInfo").textContent =
              "✗ Error parsing CSV";
            document.getElementById("csvInfo").className = "file-info error";
          },
        });
      } catch (error) {
        showError("Error reading CSV file: " + error.message);
      }
    };
    reader.readAsText(file);
  }
});

document.getElementById("pdfFiles").addEventListener("change", function (e) {
  pdfFiles = Array.from(e.target.files);
  if (pdfFiles.length > 0) {
    document.getElementById("pdfInfo").textContent =
      `✓ ${pdfFiles.length} PDF file(s) selected`;
    document.getElementById("pdfInfo").className = "file-info success";
  } else {
    document.getElementById("pdfInfo").textContent = "";
    document.getElementById("pdfInfo").className = "file-info";
  }
  checkIfReadyToProcess();
});

function checkIfReadyToProcess() {
  const button = document.getElementById("processButton");
  button.disabled = !(csvData && pdfFiles.length > 0);
}

document
  .getElementById("processButton")
  .addEventListener("click", processFiles);

async function processFiles() {
  try {
    hideError();
    document.getElementById("output").style.display = "none";
    document.getElementById("progress").style.display = "block";

    const outputLog = document.getElementById("outputLog");
    outputLog.innerHTML = "";

    addLog("Initializing processing...", "info");

    // Create a zip file
    const zip = new JSZip();
    let processedCount = 0;
    let warningCount = 0;

    addLog(`Starting to process ${csvData.length} students...`, "info");

    // For each student in CSV
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      updateProgress((i / csvData.length) * 100);

      try {
        // Get student data from CSV
        const fullName = String(row["שם מלא"] || "").trim();
        const rawParticipantId = String(row["מזהה"] || "").trim();
        const participantId = rawParticipantId.replace("משתתף:", "").trim();
        const studentIdFromExam = String(row["מספר זיהוי"] || "").trim();

        if (!fullName || !participantId || !studentIdFromExam) {
          addLog(
            `⚠️ Skipping row ${i + 1}: missing required fields`,
            "warning",
          );
          warningCount++;
          continue;
        }

        // Find matching PDF
        let matchingPdf = null;
        let matchingPdfFile = null;

        for (const pdfFile of pdfFiles) {
          if (pdfFile.name.includes(studentIdFromExam)) {
            matchingPdf = pdfFile.name;
            matchingPdfFile = pdfFile;
            break;
          }
        }

        if (matchingPdf && matchingPdfFile) {
          // Create folder name
          const folderName = `${fullName}_${participantId}_assignsubmission_file_`;

          // Read PDF file and add to zip
          const fileBuffer = await matchingPdfFile.arrayBuffer();
          const folderPath = `${folderName}/${matchingPdf}`;
          zip.file(folderPath, fileBuffer);

          addLog(`✓ ${fullName}`, "success");
          processedCount++;
        } else {
          addLog(
            `⚠️ No PDF found for ${fullName} (ID: ${studentIdFromExam})`,
            "warning",
          );
          warningCount++;
        }
      } catch (error) {
        addLog(`✗ Error processing row ${i + 1}: ${error.message}`, "error");
      }
    }

    updateProgress(100);

    addLog(``, "info");
    addLog(`Processing completed!`, "info");
    addLog(`✓ Successfully processed: ${processedCount} students`, "success");
    if (warningCount > 0) {
      addLog(`⚠️ Warnings: ${warningCount}`, "warning");
    }

    // Generate zip file
    addLog("Generating ZIP file...", "info");
    generatedZip = await zip.generateAsync({ type: "blob" });

    addLog(
      `✓ ZIP file ready (${(generatedZip.size / 1024 / 1024).toFixed(2)} MB)`,
      "success",
    );

    // Show output section
    setTimeout(() => {
      document.getElementById("progress").style.display = "none";
      document.getElementById("output").style.display = "flex";
    }, 500);
  } catch (error) {
    showError("Processing error: " + error.message);
    addLog(`✗ Fatal error: ${error.message}`, "error");
    document.getElementById("progress").style.display = "none";
  }
}

document
  .getElementById("downloadButton")
  .addEventListener("click", function () {
    if (generatedZip) {
      const url = URL.createObjectURL(generatedZip);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Moodle_Upload_Folders.zip";
      link.click();
      URL.revokeObjectURL(url);
    }
  });

function updateProgress(percent) {
  document.getElementById("progressFill").style.width = percent + "%";
  const message =
    percent === 100 ? "Finalizing..." : `Processing: ${Math.round(percent)}%`;
  document.getElementById("progressText").textContent = message;
}

function addLog(message, type = "info") {
  const outputLog = document.getElementById("outputLog");
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  outputLog.appendChild(entry);
  outputLog.scrollTop = outputLog.scrollHeight;
}

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.style.display = "flex";
}

function hideError() {
  document.getElementById("errorMessage").style.display = "none";
}

// Help button
document.getElementById("help-btn").addEventListener("click", function () {
  alert(
    'Steps:\n1. Upload the Moodle CSV file, it can be downloaded from an assignment within Moodle\n2. Upload all PDF files\n3. Click "Process Files"\n4. Download the ZIP file\n\nThe tool will match PDFs to students by ID and create organized submission folders.\n\nThe output ZIP file can be uploaded directly to Moodle',
  );
});
