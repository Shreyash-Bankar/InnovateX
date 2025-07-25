<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
 
</head>
<body>

  <h1> InnovateX – Intelligent Alert Triage System</h1>

  <p><strong>Live Site:</strong> <a href="https://shreyash-bankar.github.io/InnovateX/" target="_blank">https://shreyash-bankar.github.io/InnovateX/</a></p>
  <p><strong>GitHub:</strong> <a href="https://github.com/Shreyash-Bankar/InnovateX" target="_blank">https://github.com/Shreyash-Bankar/InnovateX</a></p>

  <h2> Overview</h2>
  <p>InnovateX is a browser-based dashboard to triage and classify security alerts using machine learning. It reduces false positives in SOC environments and helps analysts focus on high-confidence threats by scoring alerts with a lightweight logistic regression model built in JavaScript.</p>

  <h2> Deployment Instructions</h2>

  <h3> Prerequisites</h3>
  <ul>
    <li>Git installed on your machine</li>
    <li>GitHub account</li>
  </ul>

  <h3> Clone & Run Locally</h3>
  <pre><code>git clone https://github.com/Shreyash-Bankar/InnovateX.git
cd InnovateX</code></pre>

  <h3> Deploy to GitHub Pages</h3>
  <ol>
    <li>Commit your changes (optional):
      <pre><code>git add .
git commit -m "Your changes"
git push origin main</code></pre>
    </li>
    <li>Go to GitHub → Settings → Pages → Select:
      <pre><code>Branch: main
Folder: /root</code></pre>
    </li>
    <li>Access your live site at:
      <code>https://&lt;your-username&gt;.github.io/InnovateX/</code>
    </li>
  </ol>

  <h2> CSV Format</h2>
  <p>The dashboard accepts a CSV with the following columns:</p>
  <pre><code>timestamp,device,alert_type,src_ip,dst_ip,signature_id,severity,context,disposition(optional)</code></pre>
  <p><strong>Example row:</strong></p>
  <pre><code>2025-07-24T09:15:00Z,firewall,BruteForce,10.12.5.14,192.0.2.25,3501,4,WORK_HOURS,true_positive</code></pre>

  <h2> Model Logic (Client-Side)</h2>
  <p>The project uses a logistic regression model implemented in JavaScript, operating on:</p>
  <ul>
    <li>Severity</li>
    <li>Device type</li>
    <li>Alert type</li>
    <li>Time context (Work vs After hours)</li>
    <li>IP origin (internal/external)</li>
  </ul>
  <p>The output includes a probability score and a predicted label (true_positive or false_positive).</p>

  <h2> ML Model Comparison</h2>
  <table class="table table-bordered">
    <thead>
      <tr>
        <th>Metric</th>
        <th>Gradient Boosting</th>
        <th>Isolation Forest</th>
        <th>Logistic Regression (JS)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Precision</td>
        <td>0.97</td>
        <td>0.95</td>
        <td>~0.90</td>
      </tr>
      <tr>
        <td>Recall</td>
        <td>0.95</td>
        <td>0.93</td>
        <td>~0.88</td>
      </tr>
      <tr>
        <td>F1 Score</td>
        <td>0.96</td>
        <td>0.94</td>
        <td>~0.89</td>
      </tr>
      <tr>
        <td>False Positive Rate</td>
        <td>0.03</td>
        <td>0.05</td>
        <td>~0.10</td>
      </tr>
    </tbody>
  </table>

  <h2> Dashboard Features</h2>
  <ul>
    <li> Upload sample or custom CSV</li>
    <li> Live KPI cards (total, true/false positives, average probability)</li>
    <li> Interactive alert table with sorting, details, and suppression</li>
    <li> Bar chart for alert class distribution</li>
    <li> Model metrics (Precision, Recall, F1) if ground truth exists</li>
    <li> Feedback loop: suppress alerts, retrain suggestions</li>
  </ul>

  <h2> User Flow</h2>
  <ol>
    <li>Load or upload alert CSV</li>
    <li>Run real-time ML scoring</li>
    <li>Review flagged and suppressed alerts</li>
    <li>Visualize KPIs and metrics</li>
    <li>(Optional) Mark false positives to improve learning</li>
  </ol>

  <p class="mt-5"><strong>Made with 💡 by <a href="https://github.com/Shreyash-Bankar" target="_blank">Shreyash Bankar</a></strong></p>
</body>
</html>
