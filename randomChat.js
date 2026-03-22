// ==========================================
// MISTO RANDOM - FULL FIXED CHAT LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co";
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr";
const client = supabase.createClient(supabaseUrl, supabaseKey);

const username = localStorage.getItem("vanta_username");
const sessionId = localStorage.getItem("misto_random_session");
const partnerName = localStorage.getItem("misto_random_partner");

let chatSubscription = null;
let sessionSubscription = null;

// ==========================================
// INIT CHAT
// ==========================================
async function initChat() {
    console.log("INIT CHAT:", sessionId, partnerName);

    if (!sessionId || !partnerName) {
        window.location.href = "random.html";
        return;
    }

    document.getElementById("partnerName").innerText = partnerName;
    document.getElementById("partnerAvatar").innerText = partnerName[0].toUpperCase();

    // Load old messages
    const { data, error } = await client
        .from("random_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    if (!error && data) {
        data.forEach(displayMessage);
        scrollToBottom();
    }

    // Subscribe new messages
    chatSubscription = client
        .channel(`chat:${sessionId}`)
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "random_messages",
            filter: `session_id=eq.${sessionId}`
        }, (payload) => {
            displayMessage(payload.new);
            scrollToBottom();
        })
        .subscribe();

    // Subscribe session delete
    sessionSubscription = client
        .channel(`session:${sessionId}`)
        .on("postgres_changes", {
            event: "DELETE",
            schema: "public",
            table: "random_sessions",
            filter: `id=eq.${sessionId}`
        }, () => handlePartnerSkip())
        .subscribe();
}

// ==========================================
// DISPLAY MESSAGE
// ==========================================
function displayMessage(msg) {
    const list = document.getElementById("messageList");
    if (!list) return;

    const div = document.createElement("div");
    div.className = `message ${msg.sender === username ? "sent" : "received"}`;
    div.innerText = msg.message;

    list.appendChild(div);
}

// ==========================================
// SEND MESSAGE
// ==========================================
async function sendMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();

    if (!text || !sessionId) return;

    input.value = "";

    const { error } = await client.from("random_messages").insert({
        session_id: sessionId,
        sender: username,
        message: text
    });

    if (error) {
        console.error(error);
        alert("Failed to send message");
    }
}

// ==========================================
// SCROLL HANDLING (FIXED)
// ==========================================
function scrollToBottom() {
    const list = document.getElementById("messageList");
    if (!list) return;

    setTimeout(() => {
        list.scrollTop = list.scrollHeight;
    }, 100);
}

// ==========================================
// PARTNER SKIP HANDLER
// ==========================================
function handlePartnerSkip() {
    const list = document.getElementById("messageList");
    const btn = document.getElementById("skipBtn");
    const status = document.getElementById("chatStatus");
    const input = document.getElementById("chatInput");

    if (list) {
        list.innerHTML = `
            <div style="text-align:center;color:#6366f1;margin-top:20px;">
                Stranger has skipped the chat.
            </div>`;
    }

    if (status) status.innerText = "Stranger left.";
    if (btn) {
        btn.innerText = "Start";
        btn.classList.remove("confirm");
        btn.classList.add("start");
        btn.disabled = false;
    }

    if (input) {
        input.disabled = true;
        input.placeholder = "Chat ended.";
    }

    localStorage.removeItem("misto_random_session");
    localStorage.removeItem("misto_random_partner");
}

// ==========================================
// SKIP BUTTON LOGIC
// ==========================================
async function handleSkipClick() {
    const btn = document.getElementById("skipBtn");

    if (btn.innerText === "Skip") {
        btn.innerText = "Sure?";
        btn.classList.add("confirm");
        return;
    }

    if (btn.innerText === "Sure?") {
        await confirmSkip();
        return;
    }

    if (btn.innerText === "Start") {
        window.location.href = "random.html?auto=true";
    }
}

async function confirmSkip() {
    const btn = document.getElementById("skipBtn");
    const status = document.getElementById("chatStatus");

    if (status) status.innerText = "Ending chat...";
    btn.disabled = true;

    cleanupSubscriptions();

    if (sessionId) {
        await client.from("random_sessions").delete().eq("id", sessionId);
    }

    localStorage.removeItem("misto_random_session");
    localStorage.removeItem("misto_random_partner");

    const list = document.getElementById("messageList");
    if (list) {
        list.innerHTML = `
            <div style="text-align:center;color:#6366f1;margin-top:20px;">
                You skipped the chat.
            </div>`;
    }

    btn.innerText = "Start";
    btn.classList.remove("confirm");
    btn.classList.add("start");
    btn.disabled = false;

    const input = document.getElementById("chatInput");
    if (input) {
        input.disabled = true;
        input.placeholder = "Chat ended.";
    }
}

// ==========================================
// CLEANUP
// ==========================================
function cleanupSubscriptions() {
    if (chatSubscription) client.removeChannel(chatSubscription);
    if (sessionSubscription) client.removeChannel(sessionSubscription);
}

// ==========================================
// EXIT CHAT
// ==========================================
async function exitChat() {
    cleanupSubscriptions();

    if (sessionId) {
        await client.from("random_sessions").delete().eq("id", sessionId);
    }

    localStorage.removeItem("misto_random_session");
    localStorage.removeItem("misto_random_partner");

    window.location.href = "app.html";
}

// ==========================================
// MENU
// ==========================================
window.toggleMenu = function () {
    document.getElementById("sideMenu")?.classList.toggle("active");
    document.getElementById("overlay")?.classList.toggle("active");
};

window.logout = function () {
    localStorage.clear();
    window.location.href = "index.html";
};

function loadMenuUser() {
    const u = localStorage.getItem("vanta_username");
    if (!u) return;

    document.getElementById("menuUsername").innerText = u;
    document.getElementById("menuAvatar").innerText = u[0].toUpperCase();
}

// ==========================================
// KEYBOARD FIX (FINAL)
// ==========================================
const input = document.getElementById("chatInput");

input?.addEventListener("focus", scrollToBottom);
input?.addEventListener("input", scrollToBottom);

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scrollToBottom);
}

// ENTER KEY SEND
input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// ==========================================
// INIT
// ==========================================
async function runInit() {
    loadMenuUser();
    await initChat();
}

runInit();

// CLEANUP ON CLOSE
window.addEventListener("beforeunload", () => {
    cleanupSubscriptions();
});