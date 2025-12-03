// public/js/profile.js
// Affichage des données de profil (sans gestion d'abonnement)

const userId = localStorage.getItem("userId");

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
    updateSubscriptionPill(user.subscription);
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
