// ==========================================
// MISTO RANDOM CHAT - FIXED SYNC LOGIC
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
let typingTimeout = null;
let partnerTypingTimeout = null;
let chatEnded = false; // prevent double-cleanup

// ==========================================
// TYPING INDICATOR
// ==========================================
function sendTypingBroadcast() {
    if (!chatSubscription || !sessionId || chatEnded) return;
    chatSubscription.send({
        type: "broadcast",
        event: "typing",
        payload: { user: username }
    });
}

function showPartnerTyping() {
    const status = document.getElementById("chatStatus");
    if (status) {
        status.innerHTML = `
            <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
    }
    clearTimeout(partnerTypingTimeout);
    partnerTypingTimeout = setTimeout(() => {
        const status = document.getElementById("chatStatus");
        if (status) status.innerHTML = "";
    }, 3000);
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
        // Load message history
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

        // Subscribe to chat channel — messages, typing, and partner-left
        chatSubscription = client
            .channel(`chat:${sessionId}`, {
                config: { broadcast: { self: false } }
            })
            // Broadcast: live message delivery
            .on("broadcast", { event: "message" }, (payload) => {
                const data = payload.payload;
                if (data.sender !== username) {
                    const status = document.getElementById("chatStatus");
                    if (status) status.innerHTML = "";
                    displayMessage(data);
                    scrollToBottom();
                }
            })
            // Broadcast: partner typing
            .on("broadcast", { event: "typing" }, (payload) => {
                if (payload.payload?.user && payload.payload.user !== username) {
                    showPartnerTyping();
                }
            })
            // FIXED: Broadcast partner_left — reliable, instant notification
            .on("broadcast", { event: "partner_left" }, (payload) => {
                if (payload.payload?.leaver !== username) {
                    console.log("Partner left (broadcast).");
                    handlePartnerLeft();
                }
            })
            // Postgres fallback: session deleted (covers tab-closed/crash scenarios)
            .on("postgres_changes", {
                event: "DELETE",
                schema: "public",
                table: "random_sessions",
                filter: `id=eq.${sessionId}`
            }, () => {
                console.log("Session deleted (postgres fallback).");
                handlePartnerLeft();
            })
            .subscribe((status) => {
                console.log("Chat sub status:", status);
                if (status === "CHANNEL_ERROR") {
                    console.error("Chat REALTIME failed.");
                }
            });

        // Postgres fallback for messages (in case broadcast is missed)
        // Uses a separate channel to avoid conflicts
        client
            .channel(`chat_db:${sessionId}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "random_messages",
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                // Only show DB fallback message if it's from the partner
                // Our own messages are already shown optimistically
                if (payload.new.sender !== username) {
                    // Check if already displayed via broadcast
                    const list = document.getElementById("messageList");
                    if (!list) return;
                    const msgs = list.querySelectorAll(".message.received");
                    const last = msgs[msgs.length - 1];
                    // If the last received message content matches, skip (already showed)
                    if (!last || last.innerText !== payload.new.message) {
                        displayMessage(payload.new);
                        scrollToBottom();
                    }
                }
            })
            .subscribe();

    } catch (err) {
        console.error("Init Chat Failed:", err);
    }
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
    const text = input?.value?.trim();
    if (!text || !sessionId || !client || chatEnded) return;

    input.value = "";
    const statusEl = document.getElementById("chatStatus");
    if (statusEl) statusEl.innerHTML = "";

    const myMsg = {
        sender: username,
        message: text,
        session_id: sessionId,
        created_at: new Date().toISOString()
    };

    // Optimistic UI
    displayMessage(myMsg);
    scrollToBottom();

    try {
        // 1. Broadcast to partner instantly
        if (chatSubscription) {
            chatSubscription.send({
                type: 'broadcast',
                event: 'message',
                payload: myMsg
            });
        }

        // 2. Persist to DB
        const { error } = await client.from("random_messages").insert({
            session_id: sessionId,
            sender: username,
            message: text
        });

        if (error) console.error("DB Insert Error:", error);

    } catch (err) {
        console.error("SendMessage Error:", err);
    }
}

// ==========================================
// SCROLL
// ==========================================
function scrollToBottom() {
    const list = document.getElementById("messageList");
    if (!list) return;
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
}

// ==========================================
// PARTNER LEFT (received from partner)
// ==========================================
function handlePartnerLeft() {
    if (chatEnded) return;
    chatEnded = true;

    cleanupSubscriptions();

    const list = document.getElementById("messageList");
    const btn = document.getElementById("skipBtn");
    const status = document.getElementById("chatStatus");
    const input = document.getElementById("chatInput");

    if (list) {
        list.innerHTML += `
            <div style="text-align:center;color:#6366f1;padding:20px;font-size:14px;">
                Stranger has left the chat.
            </div>`;
    }
    if (status) status.innerHTML = "";
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
// SKIP / LEAVE (initiated by self)
// ==========================================
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

    if (chatEnded) return;
    chatEnded = true;

    if (status) status.innerHTML = "Ending chat...";
    if (btn) btn.disabled = true;

    // FIXED: Notify partner via broadcast FIRST (reliable)
    if (chatSubscription) {
        chatSubscription.send({
            type: 'broadcast',
            event: 'partner_left',
            payload: { leaver: username }
        });
    }

    // Small delay to ensure broadcast goes through
    await new Promise(r => setTimeout(r, 300));

    cleanupSubscriptions();

    // Delete session from DB (triggers Postgres fallback for partner if they missed broadcast)
    if (sessionId && client) {
        await client.from("random_sessions").delete().eq("id", sessionId);
    }

    localStorage.removeItem("misto_random_session");
    localStorage.removeItem("misto_random_partner");

    const list = document.getElementById("messageList");
    if (list) {
        list.innerHTML = `<div style="text-align:center;color:#6366f1;padding:20px;font-size:14px;">You skipped the chat.</div>`;
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

// ==========================================
// EXIT CHAT (back to main app)
// ==========================================
async function exitChat() {
    const doExit = async () => {
        if (chatEnded) {
            window.location.href = "app.html";
            return;
        }
        chatEnded = true;

        // Notify partner first
        if (chatSubscription) {
            chatSubscription.send({
                type: 'broadcast',
                event: 'partner_left',
                payload: { leaver: username }
            });
        }

        await new Promise(r => setTimeout(r, 300));
        cleanupSubscriptions();

        if (sessionId && client) {
            await client.from("random_sessions").delete().eq("id", sessionId);
        }

        localStorage.removeItem("misto_random_session");
        localStorage.removeItem("misto_random_partner");
        window.location.href = "app.html";
    };

    if (window.showConfirm) {
        showConfirm("Are you sure you want to exit? Your session will end.", doExit);
    } else {
        if (confirm("Exit chat?")) await doExit();
    }
}

// ==========================================
// SUBSCRIPTIONS CLEANUP
// ==========================================
function cleanupSubscriptions() {
    if (client && chatSubscription) {
        client.removeChannel(chatSubscription);
        chatSubscription = null;
    }
}

// ==========================================
// MENU / AUTH
// ==========================================
window.toggleMenu = function () {
    document.getElementById("sideMenu")?.classList.toggle("active");
    document.getElementById("overlay")?.classList.toggle("active");
};

window.logout = function () {
    localStorage.clear();
    window.location.href = "index.html";
};

// ==========================================
// MOBILE KEYBOARD HELPER
// ==========================================
function initMobileKeyboard() {
    if (!window.visualViewport) return;
    const updateViewport = () => {
        const height = window.innerHeight - window.visualViewport.height;
        document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, height)}px`);
        if (height > 50) setTimeout(scrollToBottom, 100);
    };
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
}

// ==========================================
// INPUT EVENTS
// ==========================================
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

// ==========================================
// INIT
// ==========================================
async function runInit() {
    const u = localStorage.getItem("vanta_username");
    if (u) {
        const uEl = document.getElementById("menuUsername");
        const aEl = document.getElementById("menuAvatar");
        if (uEl) uEl.innerText = u;
        if (aEl) aEl.innerText = u[0].toUpperCase();
    }

    // Initialize Audio for testing
    window.messageSound = new Audio("assets/sounds/message.mp3");
    if (window.messageSound) window.messageSound.volume = 1.0;

    window.playTestSound = function() {
        console.log("Testing notification sound (chat)...");
        if (window.messageSound) {
            window.messageSound.currentTime = 0;
            window.messageSound.play()
                .then(() => { if (window.showToast) showToast("Sound playing!") })
                .catch((err) => { 
                    console.error("Test sound failed:", err);
                    if (window.showToast) showToast("Click anywhere first!");
                });
        }
    }

    // Theme
    const savedTheme = localStorage.getItem("vanta_theme");
    if (savedTheme === "light") document.body.classList.add("light-mode");

    // Notifications toggle
    const notificationsToggle = document.getElementById("notificationsToggle");
    if (notificationsToggle) {
        // Default to true if not set
        if (localStorage.getItem("notifications") === null) {
            localStorage.setItem("notifications", "true");
        }
        notificationsToggle.checked = localStorage.getItem("notifications") === "true";
        notificationsToggle.addEventListener("change", (e) => {
            localStorage.setItem("notifications", e.target.checked);
        });
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById("darkModeToggle");
    if (darkModeToggle) {
        darkModeToggle.checked = !document.body.classList.contains("light-mode");
        darkModeToggle.addEventListener("change", (e) => {
            if (e.target.checked) {
                document.body.classList.remove("light-mode");
                localStorage.setItem("vanta_theme", "dark");
            } else {
                document.body.classList.add("light-mode");
                localStorage.setItem("vanta_theme", "light");
            }
        });
    }

    // Share button
    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) {
        shareBtn.onclick = () => {
            if (navigator.share) {
                navigator.share({ title: "Misto", text: "Check out Misto — anonymous stories & chats", url: window.location.origin }).catch(() => {});
            } else {
                navigator.clipboard.writeText(window.location.origin)
                    .then(() => { if (window.showToast) showToast("Link copied!"); })
                    .catch(() => {});
            }
        };
    }

    // External links
    const discordBtn = document.getElementById("discordBtn");
    if (discordBtn) discordBtn.onclick = () => window.open("https://discord.gg/PhA4fxKv", "_blank");
    const privacyBtn = document.getElementById("privacyBtn");
    if (privacyBtn) privacyBtn.onclick = () => window.open("/privacy.html", "_blank");
    const termsBtn = document.getElementById("termsBtn");
    if (termsBtn) termsBtn.onclick = () => window.open("/terms.html", "_blank");

    initMobileKeyboard();
    await initChat();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
} else {
    runInit();
}

// Notify partner if tab is closed mid-chat
window.addEventListener("beforeunload", () => {
    if (!chatEnded && chatSubscription) {
        chatSubscription.send({
            type: 'broadcast',
            event: 'partner_left',
            payload: { leaver: username }
        });
    }
});