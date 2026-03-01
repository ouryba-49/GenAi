// public/js/profile.js
// Affichage des données de profil (sans gestion d'abonnement)

const userId = localStorage.getItem("userId");
let currentSubscription = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!userId) {
    alert("⚠️ Veuillez d'abord vous connecter.");
    window.location.href = "index.html";
    return;
  }
  loadProfile();
});

async function loadProfile() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const content = document.getElementById("profile-content");

  loading.style.display = "block";
  error.style.display = "none";
  content.style.display = "none";

  try {
    const res = await fetch(`/user/profile?userId=${encodeURIComponent(userId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Impossible de charger le profil.");
    }
    const user = data.user;
    currentSubscription = user.subscription || null;
    updateSubscriptionPill(currentSubscription);
    updateCancelSubscriptionUI(currentSubscription);
    document.getElementById("profile-username").textContent = user.username || "--";
    document.getElementById("profile-email").textContent = user.email || "--";
    document.getElementById("profile-phone").textContent = user.phone || "Non renseigné";
    document.getElementById("profile-address").textContent = user.address || "Non renseignée";

    const created = user.created_at ? new Date(user.created_at) : null;
    document.getElementById("profile-created").textContent =
      created && !Number.isNaN(created.getTime())
        ? created.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
        : "--";

    const img = document.getElementById("profile-img");
    const placeholder = document.getElementById("profile-placeholder");
    if (user.profile_picture_url) {
      img.src = user.profile_picture_url;
      img.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    } else {
      img.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
    }

    loading.style.display = "none";
    content.style.display = "block";
  } catch (err) {
    error.textContent = `⚠️ ${err.message}`;
    loading.style.display = "none";
    error.style.display = "block";
  }
}

function goBack() {
  window.location.href = "index.html";
}

function updateSubscriptionPill(subscription) {
  const pill = document.getElementById("subscription-pill");
  if (!pill) return;
  const tier = resolveSubscriptionTier(subscription);
  pill.textContent = `Plan : ${tier}`;
  pill.dataset.tier = tier.toLowerCase();
}

function resolveSubscriptionTier(subscription) {
  if (!subscription) return "Free";
  const status = (subscription.status || "inactive").toLowerCase();
  if (status !== "active" && status !== "trialing") {
    return "Free";
  }
  const plan = (subscription.plan || "").toLowerCase();
  if (plan.includes("pro")) return "Premium";
  if (plan.includes("basic")) return "Basic";
  return "Premium";
}

function canCancelSubscription(subscription) {
  if (!subscription) return false;
  const status = String(subscription.status || "inactive").toLowerCase();
  const provider = String(subscription.provider || "").toLowerCase();
  return (status === "active" || status === "trialing" || status === "past_due" || status === "pending")
    && provider === "stripe"
    && Boolean(subscription.provider_id);
}

function updateCancelSubscriptionUI(subscription) {
  const wrap = document.getElementById("cancel-subscription-wrap");
  const feedback = document.getElementById("cancel-subscription-feedback");
  if (!wrap) return;

  const show = canCancelSubscription(subscription);
  wrap.style.display = show ? "block" : "none";
  if (feedback) {
    feedback.style.display = "none";
    feedback.textContent = "";
    feedback.classList.remove("success", "error");
  }
}

async function cancelSubscription() {
  const button = document.getElementById("cancel-subscription-btn");
  const feedback = document.getElementById("cancel-subscription-feedback");

  if (!canCancelSubscription(currentSubscription)) {
    if (feedback) {
      feedback.textContent = "Aucun abonnement actif a resilier.";
      feedback.classList.add("error");
      feedback.style.display = "block";
    }
    return;
  }

  const confirmed = window.confirm("Confirmer la résiliation de votre abonnement ?");
  if (!confirmed) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Résiliation...";
  }
  if (feedback) {
    feedback.style.display = "none";
    feedback.textContent = "";
    feedback.classList.remove("success", "error");
  }

  try {
    const res = await fetch("/subscriptions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Impossible de resilier l'abonnement.");
    }

    if (feedback) {
      feedback.textContent = "Abonnement resilie avec succes.";
      feedback.classList.add("success");
      feedback.style.display = "block";
    }
    await loadProfile();
  } catch (err) {
    if (feedback) {
      feedback.textContent = err.message || "Erreur lors de la resiliation.";
      feedback.classList.add("error");
      feedback.style.display = "block";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Resilier mon abonnement";
    }
  }
}

document.getElementById("cancel-subscription-btn")?.addEventListener("click", cancelSubscription);
