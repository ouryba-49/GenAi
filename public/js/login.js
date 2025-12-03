// public/js/login.js
// Gestion de la connexion et de la déconnexion utilisateur

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const toggleSections = (showMain) => {
    const loginSection = document.getElementById("login-section");
    const mainSection = document.getElementById("main-section");
    const body = document.body;
    const glows = document.querySelectorAll(".auth-glow");

    if (loginSection) loginSection.style.display = showMain ? "none" : "";
    if (mainSection) mainSection.style.display = showMain ? "block" : "none";

    if (body) {
        body.classList.toggle("auth-page", !showMain);
        body.classList.toggle("login-view", !showMain);
    }

    glows.forEach((glow) => {
        glow.style.display = showMain ? "none" : "";
    });
};

const resetLoginForm = () => {
    const inputs = document.querySelectorAll("#login-section input");
    inputs.forEach((input) => {
        input.value = "";
    });
};

loginBtn?.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorDiv = document.getElementById("login-error");

    errorDiv.textContent = "";

    if (!email || !password) {
        errorDiv.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    loginBtn.disabled = true;
    const previousText = loginBtn.textContent;
    loginBtn.textContent = "Connexion...";

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            errorDiv.textContent = data.message || "Identifiants incorrects.";
            return;
        }

        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("userEmail", data.user.email);
        if (data.user.subscription) {
            localStorage.setItem("userSubscription", JSON.stringify(data.user.subscription));
        } else {
            localStorage.removeItem("userSubscription");
        }

        toggleSections(true);

        const video = document.getElementById("bg-video");
        if (video) video.style.display = "none";
    } catch (err) {
        errorDiv.textContent = "Erreur de connexion au serveur.";
        console.error("Erreur de connexion :", err);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = previousText;
    }
});

logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userSubscription");

    toggleSections(false);
    resetLoginForm();

    const errorDiv = document.getElementById("login-error");
    if (errorDiv) errorDiv.textContent = "";

    const historyPanel = document.getElementById("history-panel");
    const historyList = document.getElementById("history-list");
    const historyStatus = document.getElementById("history-status");
    if (historyPanel) historyPanel.style.display = "none";
    if (historyList) historyList.innerHTML = "";
    if (historyStatus) historyStatus.textContent = "Commencez par générer un showroom pour voir l'historique.";
});

document.addEventListener("DOMContentLoaded", () => {
    const hasUser = localStorage.getItem("userId");
    if (hasUser) {
        toggleSections(true);
        const video = document.getElementById("bg-video");
        if (video) video.style.display = "none";
    }
});
