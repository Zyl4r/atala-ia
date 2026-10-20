const headerBtn = document.getElementById("header-btn");
const productBtn = document.getElementById("product-btn");

const homePage = document.getElementById("home-page");
const productPage = document.getElementById("product-page");

headerBtn.addEventListener('click', (e) => {
    homePage.classList.remove('hidden')
    productPage.classList.add('hidden')
})

productBtn.addEventListener('click', (e) => {
    homePage.classList.add('hidden')
    productPage.classList.remove('hidden')
})