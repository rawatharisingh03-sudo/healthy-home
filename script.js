function scrollToHealth() {
  document.getElementById("health").scrollIntoView({
    behavior: "smooth"
  });
}

function showMessage() {
  alert("Welcome to Healthy Home! 🌿");
}


// Smooth navigation
document.querySelectorAll("nav a").forEach(function(link) {
  link.addEventListener("click", function(event) {
    const target = document.querySelector(this.getAttribute("href"));

    if (target) {
      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
});


// Small card animation when page loads
window.addEventListener("load", function() {
  const cards = document.querySelectorAll(".card");

  cards.forEach(function(card, index) {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";

    setTimeout(function() {
      card.style.transition = "0.5s";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, index * 120);
  });
});
