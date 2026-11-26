/* =========================================================
   Chroma Stock — interactions
   ========================================================= */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PRICE = 19;
  const STORE_KEY = "chroma-cart-v1";
  const IMG_BASE = "assets/img/";

  const cards = $$(".clip-card");
  const products = new Map(
    cards.map((card) => {
      const img = $(".clip-media img", card);
      return [
        card.dataset.id,
        {
          id: card.dataset.id,
          title: card.dataset.title,
          category: card.dataset.category,
          categoryLabel: card.dataset.categoryLabel,
          duration: card.dataset.duration,
          desc: card.dataset.desc,
          img: img ? img.getAttribute("src") : "",
          alt: img ? img.getAttribute("alt") : "",
        },
      ];
    })
  );

  const body = document.body;
  const header = $("#site-head");
  const mobileMenu = $("#mobile-menu");
  const menuOpen = $("[data-menu-open]");
  const menuClose = $("[data-menu-close]");
  const cartDialog = $("#cart-dialog");
  const quickDialog = $("#quick-modal");
  const licenseDialog = $("#license-modal");
  const checkoutDialog = $("#checkout-modal");
  const toast = $("#toast");
  const toastText = $("[data-toast-text]", toast);
  const cartList = $("[data-cart-list]");
  const cartEmpty = $("[data-cart-empty]");
  const cartFilled = $("[data-cart-filled]");
  const cartFoot = $("[data-cart-foot]");
  const checkoutForm = $("#checkout-form");
  const checkoutMain = $("[data-checkout-main]");
  const checkoutSummary = $(".checkout-summary");
  const checkoutSuccess = $("[data-checkout-success]");
  const checkoutItems = $("[data-checkout-items]");
  const quickAdd = $("#quick-add");
  const filterStatus = $("[data-filter-status]");

  let toastTimer = 0;
  let lastFocus = null;

  /* ---------- Cart state ---------- */

  function readCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      if (!Array.isArray(raw)) return new Set();
      return new Set(raw.filter((id) => products.has(id)));
    } catch {
      return new Set();
    }
  }

  const cart = readCart();

  function saveCart() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...cart]));
    } catch {
      /* storage can be unavailable in private or file contexts */
    }
  }

  const money = (value) => `$${value}`;

  function showToast(message) {
    toastText.textContent = message;
    toast.classList.add("is-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-show"), 2400);
  }

  function updateCartUI() {
    const count = cart.size;
    const total = count * PRICE;

    $$("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.setAttribute("aria-label", `${count} ${count === 1 ? "clip" : "clips"} in cart`);
    });

    $$("[data-cart-total], [data-checkout-total]").forEach((el) => {
      el.textContent = money(total);
    });

    if (cartList) {
      cartList.innerHTML = [...cart]
        .map((id) => {
          const product = products.get(id);
          if (!product) return "";
          return `
            <li class="cart-item">
              <img src="${product.img}" width="68" height="51" alt="" loading="lazy">
              <div>
                <p class="cart-item-title">${product.title}</p>
                <p class="cart-item-meta">4K · 24 FPS · ${product.duration}</p>
                <p class="cart-item-price">${money(PRICE)}</p>
              </div>
              <button class="cart-remove" type="button" data-cart-remove="${product.id}" aria-label="Remove ${product.title} from cart">
                <svg class="icon"><use href="#i-x"></use></svg>
              </button>
            </li>`;
        })
        .join("");
    }

    if (cartEmpty) cartEmpty.hidden = count > 0;
    if (cartFilled) cartFilled.hidden = count === 0;
    if (cartFoot) cartFoot.hidden = count === 0;

    const remaining = products.size - count;
    $$("[data-cart-remaining]").forEach((el) => {
      el.textContent = remaining > 0 ? `${remaining} left · ${money(remaining * PRICE)}` : "All 10 in cart";
    });

    $$(".cart-add-all").forEach((el) => {
      el.hidden = remaining === 0;
    });

    $$("[data-add]").forEach((button) => {
      const inCart = cart.has(button.dataset.add);
      button.classList.toggle("is-added", inCart);
      const label = $("span", button);
      if (label) label.textContent = inCart ? "Added" : "Add";
      const use = $("use", button);
      if (use) use.setAttribute("href", inCart ? "#i-check" : "#i-plus");
    });

    if (checkoutItems) {
      checkoutItems.innerHTML = [...cart]
        .map((id) => {
          const product = products.get(id);
          return product
            ? `<li class="checkout-item"><span>${product.title}</span><span>${money(PRICE)}</span></li>`
            : "";
        })
        .join("");
    }

    if (quickAdd && quickAdd.dataset.id) {
      updateQuickButton(quickAdd.dataset.id);
    }

    saveCart();
  }

  function addToCart(id, { silent = false } = {}) {
    if (!products.has(id)) return false;
    if (cart.has(id)) {
      if (!silent) showToast("Already in your cart");
      return false;
    }
    cart.add(id);
    updateCartUI();
    if (!silent) showToast(`${products.get(id).title} added to cart`);
    return true;
  }

  function removeFromCart(id) {
    if (!cart.has(id)) return;
    cart.delete(id);
    updateCartUI();
    showToast("Removed from cart");
  }

  function addAll() {
    let added = 0;
    products.forEach((_, id) => {
      if (!cart.has(id)) {
        cart.add(id);
        added += 1;
      }
    });
    updateCartUI();
    if (added > 0) {
      showToast(added === products.size ? "All 10 clips added to cart" : `${added} more ${added === 1 ? "clip" : "clips"} added`);
    } else {
      showToast("All ten clips are already in your cart");
    }
  }

  /* ---------- Dialogs ---------- */

  function syncBodyLock() {
    const dialogOpen = $$("dialog[open]").length > 0;
    const menuOpenState = mobileMenu && mobileMenu.classList.contains("is-open");
    body.classList.toggle("is-locked", dialogOpen || menuOpenState);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    $$("dialog[open]").forEach((open) => {
      if (open !== dialog) open.close();
    });
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    syncBodyLock();
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function openCart() {
    if (mobileMenu && mobileMenu.classList.contains("is-open")) closeMenu(false);
    updateCartUI();
    openDialog(cartDialog);
  }

  function openQuick(id) {
    const product = products.get(id);
    if (!product) return;
    const index = String(cards.findIndex((card) => card.dataset.id === id) + 1).padStart(2, "0");

    $("#quick-img").src = product.img;
    $("#quick-img").alt = product.alt;
    $("#quick-index").textContent = index;
    $("#quick-duration").textContent = product.duration;
    $("#quick-category").textContent = `${product.categoryLabel} · 4K UHD`;
    $("#quick-title").textContent = product.title;
    $("#quick-desc").textContent = product.desc;
    $("#quick-runtime").textContent = product.duration;
    quickAdd.dataset.id = id;
    updateQuickButton(id);

    lastFocus = document.activeElement;
    openDialog(quickDialog);
  }

  function updateQuickButton(id) {
    if (!quickAdd) return;
    const inCart = cart.has(id);
    quickAdd.innerHTML = inCart
      ? `In cart <svg class="icon"><use href="#i-check"></use></svg>`
      : `Add to cart <svg class="icon"><use href="#i-plus"></use></svg>`;
    quickAdd.classList.toggle("is-added", inCart);
  }

  /* ---------- Checkout ---------- */

  function resetCheckout() {
    if (!checkoutForm) return;
    checkoutForm.reset();
    checkoutForm.hidden = false;
    checkoutMain.hidden = false;
    checkoutSummary.hidden = false;
    checkoutSuccess.hidden = true;
  }

  function openCheckout() {
    if (cart.size === 0) {
      showToast("Add a clip before checking out");
      return;
    }
    closeDialog(cartDialog);
    resetCheckout();
    updateCartUI();
    openDialog(checkoutDialog);
  }

  /* ---------- Filters ---------- */

  function applyFilter(filter) {
    let visible = 0;
    cards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.hidden = !show;
      if (show) visible += 1;
    });

    $$(".filter").forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (filterStatus) {
      filterStatus.textContent =
        filter === "all"
          ? `Showing all ${visible} clips`
          : `Showing ${visible} ${visible === 1 ? "clip" : "clips"} in ${filter}`;
    }
  }

  /* ---------- Mobile menu ---------- */

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    menuOpen.setAttribute("aria-expanded", "true");
    body.classList.add("menu-open");
    syncBodyLock();
    const first = $("a, button", mobileMenu);
    if (first) window.setTimeout(() => first.focus(), 60);
  }

  function closeMenu(restoreFocus = true) {
    if (!mobileMenu) return;
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    menuOpen.setAttribute("aria-expanded", "false");
    body.classList.remove("menu-open");
    syncBodyLock();
    if (restoreFocus) menuOpen.focus();
  }

  /* ---------- Events ---------- */

  document.addEventListener("click", (event) => {
    const quickTrigger = event.target.closest("[data-quick]");
    if (quickTrigger) {
      event.preventDefault();
      openQuick(quickTrigger.dataset.quick);
      return;
    }

    const addTrigger = event.target.closest("[data-add]");
    if (addTrigger) {
      event.preventDefault();
      addToCart(addTrigger.dataset.add);
      return;
    }

    if (event.target.closest("[data-add-all]")) {
      event.preventDefault();
      addAll();
      openCart();
      return;
    }

    if (event.target.closest("[data-open-cart]")) {
      event.preventDefault();
      openCart();
      return;
    }

    const closeTrigger = event.target.closest("[data-close-dialog]");
    if (closeTrigger) {
      event.preventDefault();
      closeDialog(closeTrigger.closest("dialog"));
      return;
    }

    if (event.target.closest("[data-open-license]")) {
      openDialog(licenseDialog);
      return;
    }

    if (event.target.closest("[data-open-checkout]")) {
      openCheckout();
      return;
    }

    const filterTrigger = event.target.closest("[data-filter]");
    if (filterTrigger) {
      applyFilter(filterTrigger.dataset.filter);
    }
  });

  if (cartList) {
    cartList.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-cart-remove]");
      if (remove) removeFromCart(remove.dataset.cartRemove);
    });
  }

  if (quickAdd) {
    quickAdd.addEventListener("click", () => {
      const id = quickAdd.dataset.id;
      if (!id) return;
      if (cart.has(id)) {
        showToast("Already in your cart");
        return;
      }
      addToCart(id);
      updateQuickButton(id);
    });
  }

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", syncBodyLock);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (mobileMenu && mobileMenu.classList.contains("is-open")) closeMenu();
  });

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!checkoutForm.reportValidity()) return;
      checkoutMain.hidden = true;
      checkoutSummary.hidden = true;
      checkoutSuccess.hidden = false;
      cart.clear();
      updateCartUI();
      checkoutSuccess.querySelector(".btn")?.focus();
    });
  }

  const cardInput = checkoutForm ? $('input[name="card"]', checkoutForm) : null;
  if (cardInput) {
    cardInput.addEventListener("input", () => {
      const digits = cardInput.value.replace(/\D/g, "").slice(0, 16);
      cardInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    });
  }

  const expiryInput = checkoutForm ? $('input[name="expiry"]', checkoutForm) : null;
  if (expiryInput) {
    expiryInput.addEventListener("input", () => {
      const digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
      expiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
    });
  }

  const cvcInput = checkoutForm ? $('input[name="cvc"]', checkoutForm) : null;
  if (cvcInput) {
    cvcInput.addEventListener("input", () => {
      cvcInput.value = cvcInput.value.replace(/\D/g, "").slice(0, 4);
    });
  }

  if (menuOpen) menuOpen.addEventListener("click", openMenu);
  if (menuClose) menuClose.addEventListener("click", () => closeMenu());
  $$("[data-menu-link]").forEach((link) => {
    link.addEventListener("click", () => closeMenu(false));
  });

  $$(".faq-item").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      $$(".faq-item").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const newsletter = $("[data-newsletter]");
  if (newsletter) {
    newsletter.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", newsletter);
      const note = $("[data-newsletter-note]", newsletter);
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      note.textContent = "You're on the list. First pour incoming.";
      note.classList.add("is-success");
      newsletter.reset();
    });
  }

  const year = $("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  let scrolled = false;
  const onScroll = () => {
    const isScrolled = window.scrollY > 12;
    if (isScrolled !== scrolled) {
      scrolled = isScrolled;
      header.classList.toggle("is-scrolled", isScrolled);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal ---------- */

  const revealItems = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  /* ---------- Init ---------- */

  updateCartUI();
  applyFilter("all");
  window.__chromaReady = true;
})();
