(function () {
  var navItems = [
    { label: "Dashboard", route: "/dashboard", icon: "grid_view" },
    { label: "Market Analysis", route: "/insights", icon: "insights" },
    { label: "Model Comparison", route: "/model-comparison", icon: "query_stats" },
    { label: "Predict", route: "/predict-ipo", icon: "bolt" },
    { label: "Portfolio/History", route: "/history", icon: "account_balance_wallet" },
    { label: "About", route: "/about", icon: "info" }
  ];

  var routeMap = {
    dashboard: "/dashboard",
    "market analysis": "/insights",
    "model comparison": "/model-comparison",
    analysis: "/model-comparison",
    insights: "/insights",
    predictor: "/predict-ipo",
    portfolio: "/history",
    "portfolio/history": "/history",
    "portfolio history": "/history",
    history: "/history",
    watchlist: "/about",
    "about us": "/about",
    about: "/about",
    predict: "/predict-ipo",
    "predict now": "/predict-ipo",
    "predict ipo": "/predict-ipo",
    home: "/dashboard"
  };

  var allowedRoutes = {
    "/dashboard": true,
    "/insights": true,
    "/model-comparison": true,
    "/history": true,
    "/about": true,
    "/predict-ipo": true
  };

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findTarget(text) {
    if (!text) {
      return null;
    }

    if (routeMap[text]) {
      return routeMap[text];
    }

    var keys = Object.keys(routeMap);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (text.indexOf(key) !== -1) {
        return routeMap[key];
      }
    }

    return null;
  }

  function navigateTo(target) {
    if (!target || !allowedRoutes[target]) {
      return;
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "stitch:navigate", href: target }, "*");
      return;
    }

    window.location.href = target;
  }

  function getCurrentRoute() {
    var path = window.location.pathname;

    if (path.indexOf("/stitch/dashboard.html") !== -1 || path === "/dashboard") {
      return "/dashboard";
    }
    if (path.indexOf("/stitch/insights.html") !== -1 || path === "/insights") {
      return "/insights";
    }
    if (path.indexOf("/stitch/model-comparison.html") !== -1 || path === "/model-comparison") {
      return "/model-comparison";
    }
    if (path.indexOf("/stitch/predict-ipo.html") !== -1 || path === "/predict-ipo") {
      return "/predict-ipo";
    }
    if (path.indexOf("/stitch/history.html") !== -1 || path === "/history") {
      return "/history";
    }
    if (path.indexOf("/stitch/about.html") !== -1 || path === "/about") {
      return "/about";
    }

    return "/dashboard";
  }

  function findDirectAnchorContainer(root) {
    if (!root) {
      return null;
    }

    var directAnchors = root.querySelectorAll(":scope > a");
    if (directAnchors.length >= 2) {
      return root;
    }

    var descendants = root.querySelectorAll("div, nav");
    for (var i = 0; i < descendants.length; i += 1) {
      var candidate = descendants[i];
      if (candidate.querySelectorAll(":scope > a").length >= 2) {
        return candidate;
      }
    }

    var fallback = root.querySelector("a");
    if (fallback && fallback.parentElement) {
      return fallback.parentElement;
    }

    return null;
  }

  function pickNavClasses(links, isSidebar) {
    var activeLink = null;
    var inactiveLink = null;

    links.forEach(function (link) {
      var cls = link.className || "";
      var isActive = isSidebar
        ? cls.indexOf("inset") !== -1 || cls.indexOf("bg-[#F0F4F8]") !== -1
        : cls.indexOf("border-b-2") !== -1 || cls.indexOf("font-bold") !== -1;

      if (isActive && !activeLink) {
        activeLink = link;
      }
      if (!isActive && !inactiveLink) {
        inactiveLink = link;
      }
    });

    if (!inactiveLink && links[0]) {
      inactiveLink = links[0];
    }
    if (!activeLink) {
      activeLink = inactiveLink;
    }

    return {
      activeClass: activeLink ? activeLink.className : "",
      inactiveClass: inactiveLink ? inactiveLink.className : ""
    };
  }

  function createNavAnchor(item, className, isSidebar) {
    var anchor = document.createElement("a");
    anchor.className = className;
    anchor.href = item.route;

    if (isSidebar) {
      anchor.innerHTML =
        '<span class="material-symbols-outlined" data-icon="' +
        item.icon +
        '">' +
        item.icon +
        '</span><span>' +
        item.label +
        "</span>";
    } else {
      anchor.textContent = item.label;
    }

    anchor.addEventListener("click", function (event) {
      event.preventDefault();
      navigateTo(item.route);
    });

    return anchor;
  }

  function getTopBar() {
    return document.querySelector("body > nav:first-of-type, body > header:first-of-type");
  }

  function syncTopNav() {
    var topBar = getTopBar();
    if (!topBar) {
      return;
    }

    var standardizedTopBarClass =
      "fixed top-0 w-full z-50 flex justify-between items-center bg-[#F6F9FF] px-6 py-4 shadow-[-6px_-6px_12px_rgba(255,255,255,0.8),6px_6px_12px_rgba(35,52,66,0.08)]";
    var topNavInactiveClass =
      "text-[#233442] opacity-70 hover:opacity-100 transition-all font-['Plus_Jakarta_Sans'] text-sm tracking-wide";
    var topNavActiveClass = "text-[#4D44E3] font-bold border-b-2 border-[#4D44E3]";

    topBar.className = standardizedTopBarClass;

    var left = document.createElement("div");
    left.className = "flex items-center gap-8";

    var brand = document.createElement("span");
    brand.className = "text-xl font-extrabold tracking-tighter text-[#233442]";
    brand.textContent = "IPO Insight";

    var navContainer = document.createElement("div");
    navContainer.className = "hidden md:flex gap-6 font-['Plus_Jakarta_Sans'] text-sm tracking-wide";

    var currentRoute = getCurrentRoute();

    navItems.forEach(function (item) {
      var className = item.route === currentRoute ? topNavActiveClass : topNavInactiveClass;
      navContainer.appendChild(createNavAnchor(item, className, false));
    });

    left.appendChild(brand);
    left.appendChild(navContainer);

    var right = document.createElement("div");
    right.className = "flex items-center gap-4";

    var searchShell = document.createElement("div");
    searchShell.className = "neumorphic-inset flex items-center px-4 py-2 rounded-full w-64";
    searchShell.innerHTML =
      '<span class="material-symbols-outlined text-outline text-sm mr-2">search</span>' +
      '<input class="bg-transparent border-none focus:ring-0 text-sm w-full" placeholder="Search IPOs..." type="text" />';

    var iconButtons = document.createElement("div");
    iconButtons.className = "flex gap-2";

    var notif = document.createElement("button");
    notif.className =
      "neumorphic-extruded p-2 rounded-full hover:shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(35,52,66,0.12)] transition-all";
    notif.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">notifications</span>';

    var account = document.createElement("button");
    account.className =
      "neumorphic-extruded p-2 rounded-full hover:shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(35,52,66,0.12)] transition-all";
    account.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">account_circle</span>';

    iconButtons.appendChild(notif);
    iconButtons.appendChild(account);
    right.appendChild(searchShell);
    right.appendChild(iconButtons);

    topBar.replaceChildren(left, right);
  }

  function syncSidebar() {
    var aside = document.querySelector("body > aside:first-of-type");
    if (!aside) {
      return;
    }

    var standardizedAsideClass =
      "fixed left-0 top-0 h-full w-64 z-40 bg-[#F6F9FF] p-6 pt-24 hidden lg:flex flex-col shadow-[6px_0px_12px_rgba(35,52,66,0.05)]";
    var sidebarInactiveClass =
      "flex items-center gap-3 text-[#233442] py-3 px-4 hover:translate-x-1 transition-transform font-['Plus_Jakarta_Sans'] text-sm font-medium uppercase tracking-widest hover:text-[#4D44E3]";
    var sidebarActiveClass =
      "flex items-center gap-3 shadow-[inset_-3px_-3px_7px_rgba(255,255,255,0.7),inset_3px_3px_7px_rgba(35,52,66,0.1)] rounded-xl bg-[#F0F4F8] text-[#4D44E3] py-3 px-4 font-['Plus_Jakarta_Sans'] text-sm font-medium uppercase tracking-widest";

    aside.className = standardizedAsideClass;

    var nav = document.createElement("nav");
    nav.className = "space-y-4";

    var currentRoute = getCurrentRoute();
    var fragment = document.createDocumentFragment();

    navItems.forEach(function (item) {
      var className = item.route === currentRoute ? sidebarActiveClass : sidebarInactiveClass;
      fragment.appendChild(createNavAnchor(item, className, true));
    });

    nav.replaceChildren(fragment);

    var content = document.createElement("div");
    content.className = "space-y-6";
    content.appendChild(nav);

    aside.replaceChildren(content);
  }

  function patchAnchors() {
    var anchors = document.querySelectorAll("a");
    anchors.forEach(function (anchor) {
      var text = normalize(anchor.textContent);
      var target = findTarget(text);
      if (!target) {
        return;
      }

      anchor.setAttribute("href", target);
      anchor.addEventListener("click", function (event) {
        event.preventDefault();
        navigateTo(target);
      });
    });
  }

  function patchButtons() {
    var buttons = document.querySelectorAll("button");
    buttons.forEach(function (button) {
      var buttonType = (button.getAttribute("type") || "").toLowerCase();
      if (buttonType === "submit" || buttonType === "reset" || button.closest("form")) {
        return;
      }

      var explicitTarget = button.getAttribute("data-route");
      var target = null;

      if (explicitTarget && allowedRoutes[explicitTarget]) {
        target = explicitTarget;
      } else {
        var text = normalize(button.textContent);
        target = findTarget(text);
      }

      if (!target) {
        return;
      }

      button.style.cursor = "pointer";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        navigateTo(target);
      });
    });
  }

  function normalizeLayout() {
    var style = document.createElement("style");
    style.id = "stitch-layout-normalizer";
    style.textContent = [
      "body > nav:first-of-type,",
      "body > header:first-of-type {",
      "  position: fixed !important;",
      "  top: 0 !important;",
      "  left: 0 !important;",
      "  right: 0 !important;",
      "  width: 100% !important;",
      "  max-width: none !important;",
      "  z-index: 50 !important;",
      "}",
      "body > main:first-of-type {",
      "  padding-top: 6.5rem !important;",
      "}",
      "body.has-stitch-sidebar > aside:first-of-type {",
      "  position: fixed !important;",
      "  top: 0 !important;",
      "  left: 0 !important;",
      "  height: 100dvh !important;",
      "  width: 16rem !important;",
      "  padding-top: 6rem !important;",
      "  z-index: 40 !important;",
      "}",
      "@media (min-width: 1024px) {",
      "  body.has-stitch-sidebar > main:first-of-type {",
      "    margin-left: 16rem !important;",
      "  }",
      "}",
      "@media (max-width: 1023px) {",
      "  body.has-stitch-sidebar > main:first-of-type {",
      "    margin-left: 0 !important;",
      "  }",
      "}"
    ].join("\n");

    document.head.appendChild(style);

    if (document.querySelector("body > aside")) {
      document.body.classList.add("has-stitch-sidebar");
    }
  }

  function init() {
    normalizeLayout();
    syncTopNav();
    syncSidebar();
    patchAnchors();
    patchButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
