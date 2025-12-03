// public/js/subscription.js
// Gestion de l'abonnement depuis la page d'accueil

const SUBSCRIPTION_PLANS = {
  basic_monthly: {
    name: "Basic",
    priceLabel: "9,90 € / mois",
    description: "Pour bien démarrer avec Showroom AI",
  },
  pro_monthly: {
    name: "Pro",
    priceLabel: "19,90 € / mois",
    description: "Usage intensif et collaboratif",
  },
};

let selectedPlan = "basic_monthly";
let subscriptionInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("subscription-btn");
  const closeBtn = document.getElementById("subscription-close-btn");
  const panel = document.getElementById("subscription-panel");

  if (!openBtn || !closeBtn || !panel) return;

  openBtn.addEventListener("click", () => {
    toggleSubscriptionPanel(true);
    loadSubscriptionDetails();
  });

  closeBtn.addEventListener("click", () => toggleSubscriptionPanel(false));
  panel.addEventListener("click", (e) => {
    if (e.target === panel) toggleSubscriptionPanel(false);
  });

  setupPlanSelection();
  attachSubscriptionCta();
  handleStripeRedirect();
});

function toggleSubscriptionPanel(show) {
  const panel = document.getElementById("subscription-panel");
  if (!panel) return;
  panel.style.display = show ? "flex" : "none";
}

function cacheSubscriptionDom() {
  if (subscriptionInitialized) return;
  subscriptionInitialized = true;
  window.SubscriptionDOM = {
    badge: document.getElementById("subscription-status-badge"),
    description: document.getElementById("subscription-description"),
    planLabel: document.getElementById("subscription-plan-label"),
    renewLabel: document.getElementById("subscription-renews-label"),
    feedback: document.getElementById("subscription-feedback"),
    cta: document.getElementById("subscription-cta"),
    planCards: Array.from(document.querySelectorAll(".plan-card")),
  };
}

function setupPlanSelection() {
  cacheSubscriptionDom();
  const dom = window.SubscriptionDOM;
  if (!dom?.planCards) return;
  dom.planCards.forEach((card) => {
    card.addEventListener("click", () => {
      selectedPlan = card.dataset.plan || "basic_monthly";
      updatePlanSelectionUI();
    });
  });
  updatePlanSelectionUI();
}

function updatePlanSelectionUI() {
  const dom = window.SubscriptionDOM;
  if (!dom?.planCards) return;
  dom.planCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.plan === selectedPlan);
  });
}

function attachSubscriptionCta() {
  cacheSubscriptionDom();
  const dom = window.SubscriptionDOM;
  if (!dom?.cta) return;
  dom.cta.addEventListener("click", startCheckout);
}

async function loadSubscriptionDetails() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showFeedback("error", "Veuillez vous connecter pour gérer votre abonnement.");
    return;
  }

  try {
    showFeedback(null, "Chargement de l'abonnement...");
    const res = await fetch(`/user/profile?userId=${encodeURIComponent(userId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Impossible de récupérer les données.");
    }
    renderSubscription(data.user?.subscription || {});
    showFeedback(null, "");
  } catch (err) {
    console.error("SUBSCRIPTION LOAD ERROR:", err);
    showFeedback("error", err.message || "Erreur lors du chargement.");
  }
}

function renderSubscription(subscription = {}) {
  cacheSubscriptionDom();
  const { badge, description, planLabel, renewLabel, cta } = window.SubscriptionDOM;
  const status = (subscription.status || "inactive").toLowerCase();

  updateBadge(badge, status);
  if (description) description.textContent = describeStatus(status, subscription);
  if (planLabel) planLabel.textContent = formatPlanLabel(subscription.plan);
  if (renewLabel) renewLabel.textContent = formatRenewLabel(status, subscription);
  if (cta) {
    const isActive = status === "active" || status === "trialing";
    cta.disabled = isActive;
    cta.textContent = isActive ? "Abonnement actif" : "Souscrire maintenant";
  }
}

function updateBadge(badgeEl, status) {
  if (!badgeEl) return;
  badgeEl.classList.remove("status-active", "status-pending", "status-inactive");
  let label = "Inactif";
  let badgeClass = "status-inactive";
  if (status === "active" || status === "trialing") {
    label = "Actif";
    badgeClass = "status-active";
  } else if (status === "pending" || status === "incomplete") {
    label = "En attente";
    badgeClass = "status-pending";
  } else if (status === "past_due") {
    label = "Paiement en retard";
    badgeClass = "status-pending";
  } else if (status === "canceled") {
    label = "Résilié";
    badgeClass = "status-inactive";
  }
  badgeEl.textContent = label;
  badgeEl.classList.add(badgeClass);
}

function formatPlanLabel(planKey) {
  if (!planKey) return "Aucun plan actif";
  const plan = SUBSCRIPTION_PLANS[planKey];
  return plan ? `${plan.name} (${plan.priceLabel})` : planKey;
}

function formatRenewLabel(status, subscription) {
  if (status !== "active" && status !== "trialing") {
    if (status === "canceled" && subscription.canceled_at) {
      return `Résilié le ${formatDate(subscription.canceled_at)}`;
    }
    return "--";
  }
  if (!subscription.renews_at) return "--";
  return `Renouvellement le ${formatDate(subscription.renews_at)}`;
}

function describeStatus(status, subscription) {
  switch (status) {
    case "active":
    case "trialing":
      return "Votre abonnement est actif. Merci pour votre confiance !";
    case "pending":
    case "incomplete":
      return "Validation de paiement en cours. Cela peut prendre quelques minutes.";
    case "past_due":
      return "Nous n'avons pas pu renouveler votre abonnement. Veuillez vérifier votre paiement.";
    case "canceled":
      return "Abonnement résilié. Vous pouvez vous réabonner à tout moment.";
    default:
      return "Souscrivez pour débloquer l'intégralité des fonctionnalités Showroom AI.";
  }
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

async function startCheckout() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    showFeedback("error", "Veuillez vous connecter pour souscrire un abonnement.");
    return;
  }
  const cta = window.SubscriptionDOM?.cta;
  if (cta) {
    cta.disabled = true;
    cta.textContent = "Redirection en cours...";
  }
  showFeedback(null, "");
  try {
    const origin = window.location.origin;
    const payload = {
      userId,
      plan: selectedPlan,
      successUrl: `${origin}/index.html?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/index.html?subscription=cancelled`,
    };
    const res = await fetch("/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.message || "Impossible de créer la session Stripe.");
    }
    window.location.href = data.url;
  } catch (err) {
    console.error("STRIPE CHECKOUT ERROR:", err);
    showFeedback("error", err.message || "Erreur lors de la redirection vers Stripe.");
    if (window.SubscriptionDOM?.cta) {
      window.SubscriptionDOM.cta.disabled = false;
      window.SubscriptionDOM.cta.textContent = "Souscrire maintenant";
    }
  }
}

async function handleStripeRedirect() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const cancelled = params.get("subscription");
  if (!sessionId && !cancelled) return;

  toggleSubscriptionPanel(true);
  cacheSubscriptionDom();
  try {
    if (cancelled === "cancelled") {
      showFeedback("error", "Paiement annulé. Vous pouvez réessayer plus tard.");
    }
    if (sessionId) {
      showFeedback(null, "Validation du paiement en cours...");
      const res = await fetch("/subscriptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Impossible de confirmer l'abonnement.");
      }
      showFeedback("success", "Paiement confirmé ! Votre abonnement est actif.");
      renderSubscription({
        status: data.subscription?.status || "active",
        plan: data.subscription?.plan,
        renews_at: data.subscription?.renews_at,
      });
    }
  } catch (err) {
    console.error("STRIPE CONFIRM ERROR:", err);
    showFeedback("error", err.message || "Erreur lors de la confirmation.");
  } finally {
    params.delete("session_id");
    params.delete("subscription");
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }
}

function showFeedback(type, message) {
  const el = window.SubscriptionDOM?.feedback;
  if (!el) return;
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    el.className = "auth-alert info";
    return;
  }
  el.style.display = "block";
  el.textContent = message;
  el.className = "auth-alert info";
  if (type === "error") {
    el.classList.add("error");
    el.classList.remove("success");
  } else if (type === "success") {
    el.classList.add("success");
    el.classList.remove("error");
  } else {
    el.classList.remove("error", "success");
  }
}
