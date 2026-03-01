// public/js/history.js
// Affichage de l'historique des prompts + image de resultat

const historyBtn = document.getElementById("history-btn");
const historyPanel = document.getElementById("history-panel");
const closeHistoryBtn = document.getElementById("close-history");
const historyList = document.getElementById("history-list");
const historyStatus = document.getElementById("history-status");

const showHistoryPanel = () => {
    if (historyPanel) historyPanel.style.display = "flex";
};

const hideHistoryPanel = () => {
    if (historyPanel) historyPanel.style.display = "none";
};

const renderHistory = (items = []) => {
    if (!historyList || !historyStatus) return;

    historyList.innerHTML = "";

    if (!items.length) {
        historyStatus.textContent = "Aucune generation enregistrée pour le moment.";
        return;
    }

    historyStatus.textContent = "";

    items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const title = document.createElement("h4");
        title.textContent = item.prompt || "Prompt inconnu";

        const response = document.createElement("p");
        response.textContent = item.response || "Reponse indisponible.";

        const imageBlock = document.createElement("div");
        imageBlock.className = "history-image-block";

        if (item.image_url) {
            const preview = document.createElement("img");
            preview.className = "history-image-preview";
            preview.alt = "Resultat genere";
            preview.loading = "lazy";
            preview.src = item.image_url;

            const imageLink = document.createElement("a");
            imageLink.href = item.image_url;
            imageLink.target = "_blank";
            imageLink.rel = "noopener noreferrer";
            imageLink.className = "history-image-link";
            imageLink.textContent = "Ouvrir l'image";

            imageBlock.appendChild(preview);
            imageBlock.appendChild(imageLink);
        } else {
            const noImage = document.createElement("p");
            noImage.className = "history-no-image";
            noImage.textContent = "Image non disponible pour cette entrée.";
            imageBlock.appendChild(noImage);
        }

        const date = document.createElement("div");
        date.className = "history-date";
        const formattedDate = new Date(item.created_at || Date.now()).toLocaleString("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short",
        });
        date.textContent = formattedDate;

        li.appendChild(title);
        li.appendChild(response);
        li.appendChild(imageBlock);
        li.appendChild(date);
        historyList.appendChild(li);
    });
};

const loadHistory = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        alert("Veuillez vous connecter pour consulter l'historique.");
        return;
    }

    showHistoryPanel();
    if (historyStatus) historyStatus.textContent = "Chargement en cours...";
    if (historyList) historyList.innerHTML = "";

    try {
        const url = `http://localhost:3001/user/prompts?userId=${encodeURIComponent(userId)}&limit=50`;
        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
            const statusHint = res.ok ? "" : ` (statut ${res.status})`;
            throw new Error(data?.message || `Impossible de recuperer l'historique${statusHint}.`);
        }

        renderHistory(data.history || []);
    } catch (err) {
        if (historyStatus) historyStatus.textContent = `Erreur : ${err.message}`;
        console.error("HISTORY GET ERROR:", err);
    }
};

historyBtn?.addEventListener("click", loadHistory);
closeHistoryBtn?.addEventListener("click", hideHistoryPanel);

historyPanel?.addEventListener("click", (event) => {
    if (event.target === historyPanel) hideHistoryPanel();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideHistoryPanel();
});

document.addEventListener("prompt-history:updated", () => {
    if (historyPanel && historyPanel.style.display !== "none") {
        loadHistory();
    }
});
