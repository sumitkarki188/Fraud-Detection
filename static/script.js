// Tab functionality
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    
    // Hide all tab content
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }
    
    // Remove active class from all tab buttons
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    
    // Show the specific tab content and mark button as active
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Manual form submission
document.getElementById('manual-form').addEventListener('submit', function(e) {
    e.preventDefault();
    predictManual();
});

function predictManual() {
    showLoading();
    hideResults();
    
    // Collect form data
    const formData = new FormData(document.getElementById('manual-form'));
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Send request to backend
    fetch('/predict_manual', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            showError(data.error);
        } else {
            displayManualResult(data);
        }
    })
    .catch(error => {
        hideLoading();
        showError('An error occurred: ' + error.message);
    });
}

function displayManualResult(result) {
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    
    const predictionClass = result.prediction.toLowerCase();
    const cardClass = predictionClass === 'fraud' ? 'result-fraud' : 'result-normal';
    const confidenceClass = predictionClass === 'fraud' ? 'confidence-fraud' : 'confidence-normal';
    
    resultsContent.innerHTML = `
        <div class="result-card ${cardClass}">
            <div class="result-header">
                <span class="result-prediction ${predictionClass}">
                    ${result.prediction === 'Fraud' ? '⚠️ FRAUD DETECTED' : '✅ NORMAL TRANSACTION'}
                </span>
                <span class="confidence-percentage">${result.confidence.toFixed(1)}%</span>
            </div>
            
            <div class="result-details">
                <p><strong>Fraud Probability:</strong> ${result.fraud_probability.toFixed(2)}%</p>
                <div class="confidence-bar">
                    <div class="confidence-fill confidence-fraud" style="width: ${result.fraud_probability}%"></div>
                </div>
                
                <p><strong>Normal Probability:</strong> ${result.normal_probability.toFixed(2)}%</p>
                <div class="confidence-bar">
                    <div class="confidence-fill confidence-normal" style="width: ${result.normal_probability}%"></div>
                </div>
            </div>
            
            <div class="result-interpretation">
                <h4>Interpretation:</h4>
                <p>${getInterpretation(result)}</p>
            </div>
        </div>
    `;
    
    showResults();
}

function getInterpretation(result) {
    if (result.prediction === 'Fraud') {
        if (result.fraud_probability > 90) {
            return "🚨 High confidence fraud detection. Immediate action recommended.";
        } else if (result.fraud_probability > 70) {
            return "⚠️ Moderate confidence fraud detection. Manual review recommended.";
        } else {
            return "⚠️ Low confidence fraud detection. Consider additional verification.";
        }
    } else {
        if (result.normal_probability > 95) {
            return "✅ High confidence normal transaction. Safe to proceed.";
        } else if (result.normal_probability > 80) {
            return "✅ Moderate confidence normal transaction. Generally safe.";
        } else {
            return "✅ Low confidence normal transaction. Consider monitoring.";
        }
    }
}

// CSV file handling
document.getElementById('csv-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('file-name').textContent = `Selected: ${file.name}`;
        document.getElementById('file-info').style.display = 'block';
    }
});

// Drag and drop functionality
const uploadArea = document.getElementById('upload-area');

uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            document.getElementById('csv-file').files = files;
            document.getElementById('file-name').textContent = `Selected: ${file.name}`;
            document.getElementById('file-info').style.display = 'block';
        } else {
            showError('Please select a CSV file.');
        }
    }
});

function predictCSV() {
    const fileInput = document.getElementById('csv-file');
    if (!fileInput.files[0]) {
        showError('Please select a CSV file first.');
        return;
    }
    
    showLoading();
    hideResults();
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    fetch('/predict_csv', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            showError(data.error);
        } else {
            displayCSVResults(data);
        }
    })
    .catch(error => {
        hideLoading();
        showError('An error occurred: ' + error.message);
    });
}

function displayCSVResults(data) {
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    
    // Create summary statistics
    const summary = data.summary;
    const summaryHTML = `
        <div class="summary-stats">
            <div class="stat-card">
                <div class="stat-number">${summary.total_transactions}</div>
                <div class="stat-label">Total Transactions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.fraud_detected}</div>
                <div class="stat-label">Fraud Detected</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.normal_transactions}</div>
                <div class="stat-label">Normal Transactions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.fraud_percentage.toFixed(2)}%</div>
                <div class="stat-label">Fraud Rate</div>
            </div>
        </div>
    `;
    
    // Create results table
    let tableHTML = `
        <div class="csv-results-table">
            <table>
                <thead>
                    <tr>
                        <th>Row</th>
                        <th>Prediction</th>
                        <th>Fraud Probability</th>
                        <th>Normal Probability</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    data.results.forEach(result => {
        const rowClass = result.prediction === 'Fraud' ? 'fraud-row' : '';
        const predictionIcon = result.prediction === 'Fraud' ? '⚠️' : '✅';
        
        tableHTML += `
            <tr class="${rowClass}">
                <td>${result.row}</td>
                <td>${predictionIcon} ${result.prediction}</td>
                <td>${result.fraud_probability.toFixed(2)}%</td>
                <td>${result.normal_probability.toFixed(2)}%</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    resultsContent.innerHTML = summaryHTML + tableHTML;
    showResults();
}

// Utility functions
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showResults() {
    document.getElementById('results-section').style.display = 'block';
}

function hideResults() {
    document.getElementById('results-section').style.display = 'none';
}

function showError(message) {
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    
    resultsContent.innerHTML = `
        <div class="alert alert-error">
            <strong>Error:</strong> ${message}
        </div>
    `;
    
    showResults();
}

function clearForm() {
    document.getElementById('manual-form').reset();
    hideResults();
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Set default tab
    document.querySelector('.tab-button').click();
});
