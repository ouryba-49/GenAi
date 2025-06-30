// Connexion simulée
document.getElementById("login-btn").addEventListener("click", () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorDiv = document.getElementById("login-error");

    if (email === "admin@shop.ai" && password === "123456") {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("main-section").style.display = "block";

        // Cacher la vidéo à l’arrivée
        const video = document.getElementById("bg-video");
        if (video) video.style.display = "none";
    } else {
        errorDiv.innerText = "Identifiants incorrects. Réessaye.";
    }
});

// Génération du showroom
document.getElementById('generate').addEventListener('click', () => {
    const prompt = document.getElementById('prompt').value.trim();
    const viewer = document.getElementById('viewer');
    const video = document.getElementById("bg-video");
    const successBox = document.getElementById('success-message');
    const promptBar = document.getElementById('prompt-bar');
    const backBtn = document.getElementById('back-btn');

    if (!prompt) {
        alert("❗ Veuillez entrer une description pour générer le showroom.");
        return;
    }

    document.getElementById('generate').innerText = "⏳ En cours...";
    document.getElementById('generate').disabled = true;

    setTimeout(() => {
        // Masquer le fond image statique
        viewer.style.backgroundImage = "none";

        // Afficher la vidéo immersive
        if (video) {
            video.style.display = "block";
            video.play();
        }

        // Affichage UI
        promptBar.style.display = "none";
        successBox.style.display = "block";
        backBtn.style.display = "block";

        document.getElementById('generate').innerText = "GÉNÉRER";
        document.getElementById('generate').disabled = false;
    }, 1500);
});

// Bouton ← Retour
document.getElementById('back-btn').addEventListener('click', () => {
    const viewer = document.getElementById('viewer');
    const video = document.getElementById("bg-video");

    document.getElementById('prompt-bar').style.display = "flex";
    document.getElementById('success-message').style.display = "none";
    document.getElementById('back-btn').style.display = "none";

    // Cacher la vidéo et réinitialiser
    if (video) {
        video.pause();
        video.currentTime = 0;
        video.style.display = "none";
    }

    // Remettre l’image statique en fond
    viewer.style.backgroundImage = "url('images/image.jpg')";
});
