// public/js/generate.js
// Gestion de la génération du showroom via GPT + historique

const generateBtn = document.getElementById("generate");

generateBtn.addEventListener("click", async () => {
    const prompt = document.getElementById("prompt").value.trim();
    const userId = localStorage.getItem("userId");
    const promptBar = document.getElementById("prompt-bar");
    const validationBox = document.getElementById("n8n-validation-box");
    const messageText = document.getElementById("n8n-message-text");

    if (!prompt) {
        alert("Veuillez entrer une description pour générer le showroom.");
        return;
    }
    if (!userId) {
        alert("Veuillez vous connecter pour générer un showroom.");
        return;
    }

    const previousText = generateBtn.innerText;
    generateBtn.innerText = "En Traitement...";
    generateBtn.disabled = true;

    try {
        const res = await fetch("/gpt-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, userId }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || "Réponse invalide");

        // Affiche la boite de validation
        promptBar.style.display = "none";
        validationBox.style.display = "block";
        messageText.innerText = data.message;

        document.dispatchEvent(new CustomEvent("prompt-history:updated"));
    } catch (e) {
        alert("Erreur de communication avec le moteur de validation.");
        console.error("Erreur GPT :", e);
    } finally {
        generateBtn.innerText = previousText;
        generateBtn.disabled = false;
    }
});

// Confirmation de la description
document.getElementById("n8n-yes-btn").addEventListener("click", () => {
    const viewer = document.getElementById("viewer");
    const video = document.getElementById("bg-video");

    document.getElementById("n8n-validation-box").style.display = "none";
    document.getElementById("success-message").style.display = "block";
    document.getElementById("back-btn").style.display = "block";

    viewer.style.backgroundImage = "none";
    if (video) {
        video.style.display = "block";
        video.play();
    }
});

// Rejet de la proposition
document.getElementById("n8n-no-btn").addEventListener("click", () => {
    document.getElementById("n8n-validation-box").style.display = "none";
    document.getElementById("prompt-bar").style.display = "flex";
    document.getElementById("prompt").value = "";
});

// Bouton Retour
document.getElementById("back-btn").addEventListener("click", () => {
    const viewer = document.getElementById("viewer");
    const video = document.getElementById("bg-video");

    document.getElementById("prompt-bar").style.display = "flex";
    document.getElementById("success-message").style.display = "none";
    document.getElementById("back-btn").style.display = "none";

    if (video) {
        video.pause();
        video.currentTime = 0;
        video.style.display = "none";
    }

    viewer.style.backgroundImage = "url('images/image.png')";
});
