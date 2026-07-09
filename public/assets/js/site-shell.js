document.addEventListener("DOMContentLoaded", () => {
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const mobileNavDrawer = document.getElementById("mobileNavDrawer");
  const path = window.location.pathname;

  function getActiveSection() {
    if (path.startsWith("/shop") || path.endsWith("/product.html")) return "shop";
    if (path.startsWith("/collections")) return "collections";
    if (path.startsWith("/about")) return "about";
    return "";
  }

  function setActiveNavState() {
    const activeSection = getActiveSection();
    const navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link");

    navLinks.forEach(link => {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    });

    if (!activeSection) return;

    navLinks.forEach(link => {
      const href = link.getAttribute("href") || "";
      const isActive =
        (activeSection === "shop" && href.startsWith("/shop")) ||
        (activeSection === "collections" && href.startsWith("/collections")) ||
        (activeSection === "about" && href.startsWith("/about"));

      if (isActive) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  setActiveNavState();

  if (!hamburgerBtn || !mobileNavDrawer) return;

  function setMobileNavOpen(isOpen) {
    hamburgerBtn.classList.toggle("open", isOpen);
    mobileNavDrawer.classList.toggle("open", isOpen);
    hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
    mobileNavDrawer.setAttribute("aria-hidden", String(!isOpen));
  }

  hamburgerBtn.addEventListener("click", () => {
    setMobileNavOpen(!hamburgerBtn.classList.contains("open"));
  });

  mobileNavDrawer
    .querySelectorAll(".mobile-nav-link, .btn-secondary")
    .forEach(link => {
      link.addEventListener("click", () => setMobileNavOpen(false));
    });
});
