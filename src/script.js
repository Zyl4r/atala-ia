const hamburgerBtn = document.getElementById("open-side-bar");
const sideBar = document.getElementById("side-bar");

hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    sideBar.classList.toggle("left-87.5")
    sideBar.classList.toggle("left-50")
});

// sidebar nav buttons
const settingsButton = document.getElementById("settings-btn");
const helpButton = document.getElementById("help-btn");
const analysisHistory = document.getElementById("analysis-btn");

settingsButton.addEventListener('click', (e) => {
    window.location.href = "settings.html"
});

helpButton.addEventListener('click', (e) => {
    window.location.href = "help.html"
});

analysisHistory.addEventListener('click', (e) => {
    window.location.href = "analysis.html"
});

