const hamburgerBtn = document.getElementById("open-side-bar");
const sideBar = document.getElementById("side-bar");

hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    sideBar.classList.toggle("-top-105")
    sideBar.classList.toggle("top-20")
});