param(
    [int]$Port = 8501
)

Write-Host "Starting Streamlit on port $Port ..."
$streamlit = Start-Process -FilePath "python" -ArgumentList "-m streamlit run app.py --server.port $Port --server.headless true" -PassThru

Start-Sleep -Seconds 5

Write-Host "Starting temporary public tunnel..."
Write-Host "Share the https://*.trycloudflare.com URL printed below."
Write-Host "Press Ctrl+C to stop the tunnel. Streamlit will be stopped automatically."

try {
    & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url "http://localhost:$Port"
}
finally {
    if ($streamlit -and -not $streamlit.HasExited) {
        Stop-Process -Id $streamlit.Id -Force
    }
}

