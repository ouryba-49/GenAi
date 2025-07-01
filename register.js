document.getElementById("register-btn").addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    const errorDiv = document.getElementById("register-error");
    const successDiv = document.getElementById("register-success");

    errorDiv.innerText = "";
    successDiv.innerText = "";

    if (!username || !email || !password || !confirmPassword) {
        errorDiv.innerText = "Veuillez remplir tous les champs.";
        return;
    }

    if (password !== confirmPassword) {
        errorDiv.innerText = "Les mots de passe ne correspondent pas.";
        return;
    }

    // Ici tu pourrais envoyer les données vers un backend plus tard

    successDiv.innerText = "✅ Inscription réussie ! Vous pouvez maintenant vous connecter.";
});
