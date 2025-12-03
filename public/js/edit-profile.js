// public/js/edit-profile.js
// Gestion de l'édition du profil utilisateur (form + photo upload)

const userId = localStorage.getItem("userId");
let profilePhotoBase64 = null; // Stocker la photo en base64

document.addEventListener("DOMContentLoaded", () => {
    if (!userId) {
        alert("❌ Veuillez d'abord vous connecter.");
        window.location.href = "index.html";
        return;
    }

    loadCurrentProfile();
    setupPhotoUpload();
    setupFormSubmit();
});

// Charger les informations actuelles du profil
async function loadCurrentProfile() {
    try {
        const res = await fetch(`/user/profile?userId=${userId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Impossible de charger le profil.");
        }

        const user = data.user;

        // Remplir les champs (sauf username et email qui sont désactivés)
        document.getElementById("username").value = user.username || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";
        document.getElementById("address").value = user.address || "";

        // Afficher la photo si elle existe
        if (user.profile_picture_url) {
            const previewImg = document.getElementById("preview-img");
            const placeholder = document.getElementById("preview-placeholder");
            previewImg.src = user.profile_picture_url;
            previewImg.style.display = "block";
            placeholder.style.display = "none";
        }
    } catch (err) {
        console.error("Erreur chargement profil :", err);
        document.getElementById("error").textContent = "❌ Erreur : " + err.message;
        document.getElementById("error").style.display = "block";
    }
}

// Gestion du upload de photo
function setupPhotoUpload() {
    const photoInput = document.getElementById("profile-photo");
    const previewImg = document.getElementById("preview-img");
    const placeholder = document.getElementById("preview-placeholder");
    const photoError = document.getElementById("photo-error");

    photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        photoError.style.display = "none";

        if (!file) {
            profilePhotoBase64 = null;
            return;
        }

        // Vérifier la taille (max 5 MB)
        if (file.size > 5 * 1024 * 1024) {
            photoError.textContent = "❌ Fichier trop volumineux (max. 5 MB)";
            photoError.style.display = "block";
            photoInput.value = "";
            profilePhotoBase64 = null;
            return;
        }

        // Vérifier le type
        if (!file.type.startsWith("image/")) {
            photoError.textContent = "❌ Veuillez sélectionner une image";
            photoError.style.display = "block";
            photoInput.value = "";
            profilePhotoBase64 = null;
            return;
        }

        // Lire le fichier en base64
        const reader = new FileReader();
        reader.onload = (e) => {
            profilePhotoBase64 = e.target.result; // Data URL (base64)
            previewImg.src = profilePhotoBase64;
            previewImg.style.display = "block";
            placeholder.style.display = "none";
        };
        reader.onerror = () => {
            photoError.textContent = "❌ Erreur lors de la lecture du fichier";
            photoError.style.display = "block";
        };
        reader.readAsDataURL(file);
    });
}

// Gestion de la soumission du formulaire
function setupFormSubmit() {
    const form = document.getElementById("edit-form");
    const errorDiv = document.getElementById("error");
    const successDiv = document.getElementById("success");
    const saveBtn = form.querySelector(".btn-save");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        errorDiv.style.display = "none";
        successDiv.style.display = "none";

        const phone = document.getElementById("phone").value.trim();
        const address = document.getElementById("address").value.trim();

        // Validation basique
        if (phone && phone.length > 20) {
            errorDiv.textContent = "❌ Le numéro de téléphone est trop long.";
            errorDiv.style.display = "block";
            return;
        }

        if (address && address.length > 500) {
            errorDiv.textContent = "❌ L'adresse est trop longue.";
            errorDiv.style.display = "block";
            return;
        }

        saveBtn.disabled = true;
        const previousText = saveBtn.textContent;
        saveBtn.textContent = "⏳ Mise à jour...";

        try {
            const payload = {
                userId,
                phone: phone || null,
                address: address || null,
                profile_picture_url: profilePhotoBase64 || null
            };

            const res = await fetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Erreur lors de la mise à jour.");
            }

            successDiv.style.display = "block";

            // Rediriger vers le profil après 1.5 secondes
            setTimeout(() => {
                window.location.href = "profile.html";
            }, 1500);
        } catch (err) {
            errorDiv.textContent = "❌ " + err.message;
            errorDiv.style.display = "block";
            console.error("Erreur mise à jour profil :", err);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = previousText;
        }
    });
}
