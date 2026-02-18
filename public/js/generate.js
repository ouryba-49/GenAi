// public/js/generate.js
// Nouvelle generation : upload image + prompt -> reformulation GPT -> validation -> API OpenAI

const generateBtn = document.getElementById("generate");
const promptInput = document.getElementById("prompt");
const promptBar = document.getElementById("prompt-bar");
const validationBox = document.getElementById("n8n-validation-box");
const validationText = document.getElementById("n8n-message-text");
const validationYesBtn = document.getElementById("n8n-yes-btn");
const validationNoBtn = document.getElementById("n8n-no-btn");
const viewer = document.getElementById("viewer");
const generatedImageContainer = document.getElementById("generated-image-container");
const generatedImage = document.getElementById("generated-image");
const video = document.getElementById("bg-video");
const successMessage = document.getElementById("success-message");
const backBtn = document.getElementById("back-btn");

const imageInput = document.getElementById("image-input");
const pickImageBtn = document.getElementById("pick-image");
const uploadFilename = document.getElementById("upload-filename");
const uploadPreview = document.getElementById("upload-preview");
const uploadPreviewImg = document.getElementById("upload-preview-img");
const uploadRemoveBtn = document.getElementById("upload-remove-btn");

let selectedImageDataUrl = null;
let selectedImageSize = 0;
let pendingReformulatedPrompt = null; // Stocker la version reformulee

if (validationBox) validationBox.style.display = "none";

const resetState = () => {
  if (successMessage) successMessage.style.display = "none";
  if (backBtn) backBtn.style.display = "none";
  if (promptBar) promptBar.style.display = "flex";
  if (generatedImageContainer) generatedImageContainer.style.display = "none";
  if (video) {
    video.pause();
    video.currentTime = 0;
    video.style.display = "block";
  }
};

const handleFile = (file) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Merci de selectionner un fichier image.");
    return;
  }
  selectedImageSize = file.size || 0;
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImageDataUrl = e.target.result;
    if (uploadPreviewImg) {
      uploadPreviewImg.src = selectedImageDataUrl;
      uploadPreviewImg.style.display = "block";
    }
    if (uploadPreview) uploadPreview.style.display = "flex";
    if (uploadFilename) uploadFilename.textContent = file.name || "image";
  };
  reader.readAsDataURL(file);
};

// ========== ETAPE 1 : Reformuler le prompt via GPT ==========
async function reformulatePrompt(prompt, userId) {
  try {
    const res = await fetch("/gpt-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, userId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Impossible de reformuler le prompt.");
    }

    return data.message; // La version reformulee
  } catch (err) {
    console.error("Reformulation error:", err);
    throw err;
  }
}

// ========== ETAPE 2 : Generer l'image a partir du prompt ==========
async function generateImage(prompt, userId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 secondes
    
    console.log(">>> generateImage appelé avec prompt:", prompt.substring(0, 50));
    
    const res = await fetch("/image-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        userId,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log(">>> Réponse /image-edit status:", res.status);
    const data = await res.json().catch(() => ({}));
    console.log(">>> Réponse /image-edit data:", data);
    
    if (!res.ok || !data.success) {
      const detail = data.detail ? ` (${data.detail})` : "";
      throw new Error((data.message || "Erreur de generation.") + detail);
    }

    const finalUrl = data.imageUrl || null;
    if (!finalUrl) {
      console.error(">>> Erreur: data.imageUrl manquante dans:", data);
      throw new Error("Image generee introuvable.");
    }

    console.log(">>> Image URL reçue:", finalUrl.substring(0, 100));
    return finalUrl;
  } catch (err) {
    console.error(">>> Image generation error:", err);
    throw err;
  }
}

// ========== Afficher la boite de validation ==========
function showReformulationBox(reformulatedText) {
  if (validationBox && validationText) {
    validationText.innerHTML = `<strong>Prompt reformule :</strong><br><em>"${reformulatedText}"</em><br><br>Etes-vous satisfait de cette formulation ?`;
    validationBox.style.display = "flex";
  }
}

// ========== Masquer la boite de validation ==========
function hideReformulationBox() {
  if (validationBox) {
    validationBox.style.display = "none";
  }
}

// ========== Evenements fichier image ==========
pickImageBtn?.addEventListener("click", () => imageInput?.click());
imageInput?.addEventListener("change", (e) => handleFile(e.target.files?.[0]));
uploadRemoveBtn?.addEventListener("click", () => {
  selectedImageDataUrl = null;
  selectedImageSize = 0;
  if (imageInput) imageInput.value = "";
  if (uploadPreview) uploadPreview.style.display = "none";
  if (uploadFilename) uploadFilename.textContent = "Aucune image";
});

// ========== Evenement du bouton "OUI" ==========
validationYesBtn?.addEventListener("click", async () => {
  hideReformulationBox();
  
  if (!pendingReformulatedPrompt) {
    alert("Erreur : donnees manquantes.");
    return;
  }

  const previousText = generateBtn.innerText;
  generateBtn.innerText = "Generation en cours...";
  generateBtn.disabled = true;

  try {
    const finalUrl = await generateImage(pendingReformulatedPrompt, localStorage.getItem("userId"));
    
    // Afficher l'image generee dans le conteneur
    if (generatedImage) {
      generatedImage.src = finalUrl;
      generatedImage.onload = () => {
        if (generatedImageContainer) generatedImageContainer.style.display = "flex";
        if (video) video.style.display = "none";
        if (promptBar) promptBar.style.display = "none";
        if (successMessage) successMessage.style.display = "block";
        if (backBtn) backBtn.style.display = "block";
      };
      generatedImage.onerror = () => {
        alert("Erreur : impossible de charger l'image.");
        showReformulationBox(pendingReformulatedPrompt);
      };
    }
    
    pendingReformulatedPrompt = null; // Nettoyer
  } catch (err) {
    alert(err.message || "Erreur lors de la generation.");
    console.error("Generation error:", err);
    showReformulationBox(pendingReformulatedPrompt); // Reafficher la box en cas d'erreur
  } finally {
    generateBtn.innerText = previousText;
    generateBtn.disabled = false;
  }
});

// ========== Evenement du bouton "NON" ==========
validationNoBtn?.addEventListener("click", () => {
  hideReformulationBox();
  pendingReformulatedPrompt = null; // Reinitialiser
  
  // Retour a la barre de prompt pour modifier
  if (promptInput) {
    promptInput.focus();
  }
});

// ========== Evenement principal du bouton "GENERER" ==========
generateBtn?.addEventListener("click", async () => {
  const prompt = promptInput?.value.trim() || "";
  const userId = localStorage.getItem("userId");

  if (!prompt) {
    alert("Veuillez entrer une description.");
    return;
  }
  if (!userId) {
    alert("Veuillez vous connecter pour generer une image.");
    return;
  }

  const previousText = generateBtn.innerText;
  generateBtn.innerText = "Reformulation...";
  generateBtn.disabled = true;

  try {
    // Etape 1 : Reformuler le prompt
    const reformulatedPrompt = await reformulatePrompt(prompt, userId);
    pendingReformulatedPrompt = reformulatedPrompt;
    
    // Etape 2 : Afficher la boite de validation
    showReformulationBox(reformulatedPrompt);
  } catch (err) {
    alert(err.message || "Erreur lors de la reformulation.");
    console.error("Reformulation error:", err);
  } finally {
    generateBtn.innerText = previousText;
    generateBtn.disabled = false;
  }
});

backBtn?.addEventListener("click", resetState);
