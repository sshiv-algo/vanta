// ================== VANTA UNIFIED POPUP API ==================

let popupOnClose = null;

// Initialize popups system
window.showAlert = function (message, title = "Notice") {
    showPopup({
        title: title,
        message: message,
        icon: "💡",
        type: "alert"
    });
};

window.showError = function (message, title = "Error") {
    showPopup({
        title: title,
        message: message,
        icon: "❌",
        type: "alert"
    });
};

window.showSuccess = function (message, title = "Success") {
    showPopup({
        title: title,
        message: message,
        icon: "✅",
        type: "alert"
    });
};

window.showConfirm = function (message, onYes, onNo, title = "Confirm") {
    showPopup({
        title: title,
        message: message,
        icon: "❓",
        type: "confirm",
        onYes: onYes,
        onNo: onNo
    });
};

window.showToast = function (message) {
    const toast = document.getElementById("vantaToast");
    if (!toast) {
        console.warn("Vanta Toast: Element not found.");
        return;
    }

    toast.innerText = message;
    toast.classList.add("active");

    setTimeout(() => {
        toast.classList.remove("active");
    }, 3000);
};

function showPopup(options) {
    const popup = document.getElementById("vantaPopup");
    const title = document.getElementById("popupTitle");
    const message = document.getElementById("popupMessage");
    const icon = document.getElementById("popupIcon");
    const actions = document.getElementById("popupActions");

    if (!popup || !title || !message || !icon || !actions) {
        console.error("Vanta Popups: HTML elements not found.");
        // Fallback to native alert for critical info
        if (options.type === "alert") alert(options.message);
        return;
    }

    title.innerText = options.title || "";
    message.innerText = options.message || "";
    icon.innerText = options.icon || "💡";
    actions.innerHTML = "";
    
    popupOnClose = options.onNo || options.onClose || null;

    if (options.type === "alert") {
        const btn = document.createElement("button");
        btn.className = "vanta-popup-btn vanta-popup-btn-primary";
        btn.innerText = "OK";
        btn.onclick = closePopup;
        actions.appendChild(btn);
    } else if (options.type === "confirm") {
        const yesBtn = document.createElement("button");
        yesBtn.className = "vanta-popup-btn vanta-popup-btn-primary";
        yesBtn.innerText = "Yes";
        yesBtn.onclick = () => {
            closePopup(true);
            if (options.onYes) options.onYes();
        };

        const noBtn = document.createElement("button");
        noBtn.className = "vanta-popup-btn vanta-popup-btn-secondary";
        noBtn.innerText = "Cancel";
        noBtn.onclick = () => {
            closePopup(true);
            if (options.onNo) options.onNo();
        };

        actions.appendChild(yesBtn);
        actions.appendChild(noBtn);
    }

    popup.classList.add("active");
    document.body.classList.add("popup-open");
}

window.closePopup = function (preventOnClose = false) {
    const popup = document.getElementById("vantaPopup");
    if (popup) popup.classList.remove("active");
    document.body.classList.remove("popup-open");
    
    if (!preventOnClose && popupOnClose) {
        popupOnClose();
    }
    popupOnClose = null;
};


