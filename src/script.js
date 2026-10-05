const hamburgerBtn = document.getElementById("open-side-bar");
const sideBar = document.getElementById("side-bar");

hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    sideBar.classList.toggle("h-0")
    sideBar.classList.toggle("h-105")
});