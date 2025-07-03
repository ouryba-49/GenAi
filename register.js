document.getElementById("register-btn").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    const errorDiv = document.getElementById("register-error");
    const successDiv = document.getElementById("register-success");
    const registerBtn = document.getElementById("register-btn");

    errorDiv.innerText = "";
    successDiv.innerText = "";

    // Simple validation
    if (!username || !email || !password || !confirmPassword) {
        errorDiv.innerText = "Veuillez remplir tous les champs.";
        return;
    }

    // Email format (simple check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorDiv.innerText = "Adresse e-mail invalide.";
        return;
    }

    if (password !== confirmPassword) {
        errorDiv.innerText = "Les mots de passe ne correspondent pas.";
        return;
    }

    // Désactiver le bouton pour éviter le spam
    registerBtn.disabled = true;
    registerBtn.innerText = "⏳ En cours...";

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (data.success) {
            successDiv.innerText = "✅ Inscription réussie ! Redirection...";
            setTimeout(() => {
                window.location.href = "index.html";
            }, 2000);
        } else {
            errorDiv.innerText = data.message;
        }
    } catch (err) {
        errorDiv.innerText = "Erreur de communication avec le serveur.";
    }

    registerBtn.disabled = false;
    registerBtn.innerText = "S'inscrire";
});
