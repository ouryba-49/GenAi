// public/js/history.js
// Affichage de l'historique des prompts par utilisateur

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
        historyStatus.textContent = "Aucune génération enregistrée pour le moment.";
        return;
    }

    historyStatus.textContent = "";

    items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const title = document.createElement("h4");
        title.textContent = item.prompt || "Prompt inconnu";

        const response = document.createElement("p");
        response.textContent = item.response || "Réponse indisponible.";

        const date = document.createElement("div");
        date.className = "history-date";
        const formattedDate = new Date(item.created_at || Date.now()).toLocaleString("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short"
        });
        date.textContent = formattedDate;

        li.appendChild(title);
        li.appendChild(response);
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
        const url = `http://localhost:3001/user/prompts?userId=${encodeURIComponent(
            userId
        )}&limit=50`;

        console.log("[HISTORY] Fetch =>", url);

        const res = await fetch(url);

        let data = null;

        try {
            data = await res.json();
        } catch {
            data = null;
        }

        if (!res.ok || !data?.success) {
            const statusHint = res.ok ? "" : ` (statut ${res.status})`;
            const serverMessage = data?.message;
            throw new Error(
                serverMessage ||
                `Impossible de récupérer l'historique${statusHint}. Vérifiez que le serveur a bien été redémarré.`
            );
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
    if (event.target === historyPanel) {
        hideHistoryPanel();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideHistoryPanel();
    }
});

document.addEventListener("prompt-history:updated", () => {
    if (historyPanel && historyPanel.style.display !== "none") {
        loadHistory();
    }
});