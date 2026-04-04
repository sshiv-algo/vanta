// ==========================================
// MISTO RANDOM - FULL FIXED CHAT LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co";
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr";
let client = null;

try {
    client = supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error("Supabase Init Error:", e);
}

const username = localStorage.getItem("vanta_username");
const sessionId = localStorage.getItem("misto_random_session");
const partnerName = localStorage.getItem("misto_random_partner");

let chatSubscription = null;
let sessionSubscription = null;
let typingTimeout = null;
let partnerTypingTimeout = null;

// ==========================================
// TYPING INDICATOR
// ==========================================
function sendTypingBroadcast() {
    if (!chatSubscription || !sessionId) return;
    chatSubscription.send({
        type: "broadcast",
        event: "typing",
        payload: { user: username }
    });
}

function showPartnerTyping() {
    const status = document.getElementById("chatStatus");
    if (status) status.innerText = "typing...";
    clearTimeout(partnerTypingTimeout);
    partnerTypingTimeout = setTimeout(() => {
        if (status) status.innerText = "";
    }, 2500);
}

// ==========================================
// INIT CHAT
// ==========================================
async function initChat() {
    console.log("INIT CHAT:", sessionId, partnerName);

    if (!sessionId || !partnerName) {
        window.location.href = "random.html";
        return;
    }

    if (!client) {
        if (window.showError) showError("Connection failed. Returning to lobby.");
        setTimeout(() => { window.location.href = "random.html"; }, 2000);
        return;
    }

    const pNameEl = document.getElementById("partnerName");
    const pAvatarEl = document.getElementById("partnerAvatar");
    if (pNameEl) pNameEl.innerText = partnerName;
    if (pAvatarEl) pAvatarEl.innerText = partnerName[0].toUpperCase();

    try {
        // Load old messages
        const { data, error } = await client
            .from("random_messages")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

        if (!error && data) {
            const list = document.getElementById("messageList");
            if (list) {
                list.innerHTML = "";
                data.forEach(displayMessage);
                scrollToBottom();
            }
        }

        // Subscribe new messages + typing + message broadcasts
        chatSubscription = client
            .channel(`chat:${sessionId}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "random_messages",
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                // FALLBACK: Only display if not already handled by broadcast
                // or for users who missed the live broadcast
                console.log("Postgres fallback message received.");
                // To keep it simple and avoid duplicates, we'll primarily rely on broadcast for live
                // but we could add a Map of message IDs here.
            })
            .on("broadcast", { event: "message" }, (payload) => {
                const data = payload.payload;
                if (data.sender !== username) {
                    console.log("Broadcast message received from partner!");
                    const status = document.getElementById("chatStatus");
                    if (status) status.innerText = "";
                    displayMessage(data);
                    scrollToBottom();
                }
            })
            .on("broadcast", { event: "typing" }, (payload) => {
                if (payload.payload?.user && payload.payload.user !== username) {
                    showPartnerTyping();
                }
            })
            .subscribe((status) => {

                console.log("Chat sub status:", status);
                if (status === "CHANNEL_ERROR") {
                    console.error("Chat REALTIME failed.");
                }
            });

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

    } catch (err) {
        console.error("Init Chat Failed:", err);
    }
}

function displayMessage(msg) {
    const list = document.getElementById("messageList");
    if (!list) return;

    const div = document.createElement("div");
    div.className = `message ${msg.sender === username ? "sent" : "received"}`;
    div.innerText = msg.message;
    list.appendChild(div);
}

async function sendMessage() {
    const input = document.getElementById("chatInput");
    const text = input?.value?.trim();

    if (!text || !sessionId || !client) return;

    input.value = "";
    const statusEl = document.getElementById("chatStatus");
    if (statusEl) statusEl.innerText = "";

    // OPTIMISTIC UI: Display my message immediately
    const myMsg = {
        sender: username,
        message: text,
        session_id: sessionId,
        created_at: new Date().toISOString()
    };
    displayMessage(myMsg);
    scrollToBottom();

    try {
        // 1. BROADCAST instantly to partner
        if (chatSubscription) {
            chatSubscription.send({
                type: 'broadcast',
                event: 'message',
                payload: myMsg
            });
        }

        // 2. INSERT into DB for persistence
        const { error } = await client.from("random_messages").insert({
            session_id: sessionId,
            sender: username,
            message: text
        });

        if (error) {
            console.error("DB Insert Error:", error);
            // Optionally show a "failed to save" icon
        }
    } catch (err) {
        console.error("SendMessage Error:", err);
    }
}


function scrollToBottom() {
    const list = document.getElementById("messageList");
    if (!list) return;
    setTimeout(() => {
        list.scrollTop = list.scrollHeight;
    }, 100);
}

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

async function handleSkipClick() {
    const btn = document.getElementById("skipBtn");
    if (!btn) return;

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
    if (btn) btn.disabled = true;

    cleanupSubscriptions();

    if (sessionId && client) {
        await client.from("random_sessions").delete().eq("id", sessionId);
    }

    localStorage.removeItem("misto_random_session");
    localStorage.removeItem("misto_random_partner");

    const list = document.getElementById("messageList");
    if (list) {
        list.innerHTML = `<div style="text-align:center;color:#6366f1;margin-top:20px;">You skipped the chat.</div>`;
    }

    if (btn) {
        btn.innerText = "Start";
        btn.classList.remove("confirm");
        btn.classList.add("start");
        btn.disabled = false;
    }

    const input = document.getElementById("chatInput");
    if (input) {
        input.disabled = true;
        input.placeholder = "Chat ended.";
    }
}

function cleanupSubscriptions() {
    if (client) {
        if (chatSubscription) client.removeChannel(chatSubscription);
        if (sessionSubscription) client.removeChannel(sessionSubscription);
    }
}

async function exitChat() {
    if (window.showConfirm) {
        showConfirm("Are you sure you want to exit? Your session will end.", async () => {
            cleanupSubscriptions();
            if (sessionId && client) {
                await client.from("random_sessions").delete().eq("id", sessionId);
            }
            localStorage.removeItem("misto_random_session");
            localStorage.removeItem("misto_random_partner");
            window.location.href = "app.html";
        });
    } else {
        if (confirm("Exit chat?")) {
            // ... same logic
            cleanupSubscriptions();
            if (sessionId && client) await client.from("random_sessions").delete().eq("id", sessionId);
            localStorage.removeItem("misto_random_session");
            localStorage.removeItem("misto_random_partner");
            window.location.href = "app.html";
        }
    }
}

window.toggleMenu = function () {
    document.getElementById("sideMenu")?.classList.toggle("active");
    document.getElementById("overlay")?.classList.toggle("active");
};

window.logout = function () {
    localStorage.clear();
    window.location.href = "index.html";
};

const inputEl = document.getElementById("chatInput");
inputEl?.addEventListener("focus", scrollToBottom);
inputEl?.addEventListener("input", () => {
    scrollToBottom();
    clearTimeout(typingTimeout);
    if (inputEl.value.trim()) {
        sendTypingBroadcast();
        typingTimeout = setTimeout(() => { sendTypingBroadcast(); }, 500);
    }
});
inputEl?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Initialization
async function runInit() {
    const u = localStorage.getItem("vanta_username");
    if (u) {
        const uEl = document.getElementById("menuUsername");
        const aEl = document.getElementById("menuAvatar");
        if (uEl) uEl.innerText = u;
        if (aEl) aEl.innerText = u[0].toUpperCase();
    }
    await initChat();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
} else {
    runInit();
}

window.addEventListener("beforeunload", cleanupSubscriptions);