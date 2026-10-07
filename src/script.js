const hamburgerBtn = document.getElementById("open-side-bar");
const sideBar = document.getElementById("side-bar");

hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    sideBar.classList.toggle("left-87.5")
    sideBar.classList.toggle("left-50")
});