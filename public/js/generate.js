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
const generatedPromptChip = document.getElementById("generated-prompt-chip");
const resultCloseBtn = document.getElementById("result-close-btn");
const downloadGeneratedBtn = document.getElementById("download-generated-btn");
const video = document.getElementById("bg-video");
const successMessage = document.getElementById("success-message");
const backBtn = document.getElementById("back-btn");
const generationLoader = document.getElementById("generation-loader");
const generationLoaderText = document.getElementById("generation-loader-text");

const imageInput = document.getElementById("image-input");
const pickImageBtn = document.getElementById("pick-image");
const uploadFilename = document.getElementById("upload-filename");
const uploadPreview = document.getElementById("upload-preview");
const uploadPreviewImg = document.getElementById("upload-preview-img");
const uploadRemoveBtn = document.getElementById("upload-remove-btn");

let selectedImageDataUrl = null;
let selectedImageFile = null;
let selectedImageSize = 0;
let pendingReformulatedPrompt = null; // Stocker la version reformulee
let pendingHistoryId = null;

if (validationBox) validationBox.style.display = "none";
if (generationLoader) generationLoader.style.display = "none";

const showLoader = (label) => {
  if (generationLoaderText && label) generationLoaderText.textContent = label;
  if (generationLoader) generationLoader.style.display = "flex";
};

const hideLoader = () => {
  if (generationLoader) generationLoader.style.display = "none";
};

const shortenText = (text, maxLength = 220) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

const buildDownloadFilename = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `showroom-ai-${stamp}.png`;
};

const resetState = () => {
  if (successMessage) successMessage.style.display = "none";
  if (backBtn) backBtn.style.display = "none";
  if (promptBar) promptBar.style.display = "flex";
  if (generatedImageContainer) generatedImageContainer.style.display = "none";
  if (generatedImage) generatedImage.removeAttribute("src");
  if (generatedPromptChip) {
    generatedPromptChip.textContent = "";
    generatedPromptChip.style.display = "none";
  }
  if (downloadGeneratedBtn) {
    downloadGeneratedBtn.setAttribute("href", "#");
    downloadGeneratedBtn.setAttribute("download", "showroom-ai-resultat.png");
  }
  pendingHistoryId = null;
  selectedImageFile = null;
  hideLoader();
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
  if ((file.size || 0) > 8 * 1024 * 1024) {
    alert("Image trop lourde (max 8 Mo).");
    return;
  }
  selectedImageSize = file.size || 0;
  selectedImageFile = file;
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
    const res = await fetch("/reformulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, userId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Impossible de reformuler le prompt.");
    }

    return data; // { success, message, historyId }
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
    
    const res = await fetch("/generate-image", {
      method: "POST",
      body: (() => {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("userId", String(userId || ""));
        form.append("historyId", String(pendingHistoryId || ""));
        form.append("strength", "0.65");
        if (selectedImageFile) form.append("image", selectedImageFile);
        return form;
      })(),
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

    const finalUrl = data.image || data.imageUrl || null;
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
    validationText.textContent = "";

    const title = document.createElement("strong");
    title.textContent = "Prompt reformule :";

    const promptLine = document.createElement("em");
    promptLine.textContent = `"${reformulatedText}"`;

    const question = document.createElement("span");
    question.textContent = "Etes-vous satisfait de cette formulation ?";

    validationText.append(title, promptLine, question);
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
  selectedImageFile = null;
  selectedImageSize = 0;
  if (imageInput) imageInput.value = "";
  if (uploadPreview) uploadPreview.style.display = "none";
  if (uploadFilename) uploadFilename.textContent = "Aucune image";
});

resultCloseBtn?.addEventListener("click", resetState);

downloadGeneratedBtn?.addEventListener("click", async (event) => {
  const imageUrl = generatedImage?.src || "";
  if (!imageUrl) {
    event.preventDefault();
    return;
  }

  // Tente un vrai téléchargement local, puis fallback sur ouverture navigateur.
  if (!imageUrl.startsWith("data:")) {
    event.preventDefault();
    try {
      const res = await fetch(imageUrl, { mode: "cors" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = buildDownloadFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  }
});

generatedImageContainer?.addEventListener("click", (event) => {
  if (event.target === generatedImageContainer) {
    resetState();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && generatedImageContainer?.style.display === "flex") {
    resetState();
  }
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
  showLoader(
    selectedImageDataUrl
      ? "Generation de votre visuel a partir de votre image..."
      : "Generation de votre visuel en cours..."
  );

  try {
    const finalUrl = await generateImage(pendingReformulatedPrompt, localStorage.getItem("userId"));
    
    // Afficher l'image generee dans le conteneur
    if (generatedImage) {
      generatedImage.src = finalUrl;
      generatedImage.onload = () => {
        if (generatedImageContainer) generatedImageContainer.style.display = "flex";
        if (video) video.style.display = "none";
        if (promptBar) promptBar.style.display = "none";
        if (downloadGeneratedBtn) {
          downloadGeneratedBtn.setAttribute("href", finalUrl);
          downloadGeneratedBtn.setAttribute("download", buildDownloadFilename());
        }
        if (generatedPromptChip) {
          generatedPromptChip.textContent = `Prompt valide : ${shortenText(pendingReformulatedPrompt)}`;
          generatedPromptChip.style.display = "block";
        }
        if (successMessage) successMessage.style.display = "block";
        if (backBtn) backBtn.style.display = "block";
        hideLoader();
      };
      generatedImage.onerror = () => {
        hideLoader();
        alert("Erreur : impossible de charger l'image.");
        showReformulationBox(pendingReformulatedPrompt);
      };
    }
    
    pendingReformulatedPrompt = null; // Nettoyer
    pendingHistoryId = null;
    document.dispatchEvent(new CustomEvent("prompt-history:updated"));
  } catch (err) {
    hideLoader();
    alert(err.message || "Erreur lors de la generation.");
    console.error("Generation error:", err);
    showReformulationBox(pendingReformulatedPrompt); // Reafficher la box en cas d'erreur
  } finally {
    hideLoader();
    generateBtn.innerText = previousText;
    generateBtn.disabled = false;
  }
});

// ========== Evenement du bouton "NON" ==========
validationNoBtn?.addEventListener("click", () => {
  hideReformulationBox();
  pendingReformulatedPrompt = null; // Reinitialiser
  pendingHistoryId = null;
  
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
    const reformulation = await reformulatePrompt(prompt, userId);
    const reformulatedPrompt = reformulation?.message || "";
    pendingHistoryId = reformulation?.historyId || null;
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
