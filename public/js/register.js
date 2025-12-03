// public/js/register.js
// Gestion complète de l’inscription utilisateur (UX + validations + sécurité)

document.getElementById("register-btn").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    const errorDiv = document.getElementById("register-error");
    const successDiv = document.getElementById("register-success");
    const registerBtn = document.getElementById("register-btn");

    // Nettoie les anciens messages
    errorDiv.textContent = "";
    successDiv.textContent = "";

    // Vérifications des champs
    if (!username || !email || !password || !confirmPassword) {
        errorDiv.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    // Vérifie la validité du format de l’e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorDiv.textContent = "Adresse e-mail invalide.";
        return;
    }

    // Vérifie la longueur du mot de passe
    if (password.length < 6) {
        errorDiv.textContent = "Le mot de passe doit comporter au moins 6 caractères.";
        return;
    }

    // Vérifie la correspondance
    if (password !== confirmPassword) {
        errorDiv.textContent = "Les mots de passe ne correspondent pas.";
        return;
    }

    // Désactive le bouton temporairement
    registerBtn.disabled = true;
    const prevText = registerBtn.textContent;
    registerBtn.textContent = "⏳ En cours...";

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            errorDiv.textContent = data.message || "Erreur d’inscription.";
            return;
        }

        // ✅ Succès
        successDiv.textContent = "✅ Inscription réussie ! Redirection...";
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
    } catch (err) {
        errorDiv.textContent = "Erreur de communication avec le serveur.";
        console.error("Erreur d’inscription :", err);
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = prevText;
    }
});

// === BONUS UX : afficher / masquer mot de passe ===
document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirm-password");

    // Crée les boutons 👁️ dynamiquement
    [passwordInput, confirmInput].forEach((input) => {
        const wrapper = document.createElement("div");
        wrapper.className = "input-with-toggle";
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "toggle-pass";
        toggleBtn.textContent = "👁️";
        toggleBtn.setAttribute("aria-label", "Afficher ou masquer le mot de passe");
        wrapper.appendChild(toggleBtn);

        toggleBtn.addEventListener("click", () => {
            const isVisible = input.type === "text";
            input.type = isVisible ? "password" : "text";
            toggleBtn.textContent = isVisible ? "👁️" : "🙈";
        });
    });
});
