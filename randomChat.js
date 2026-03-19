// ==========================================
// MISTO RANDOM - CHAT & CLEANUP LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"
const client = supabase.createClient(supabaseUrl, supabaseKey)

const username = localStorage.getItem("vanta_username")
const sessionId = localStorage.getItem("misto_random_session")
const partnerName = localStorage.getItem("misto_random_partner")

let chatSubscription = null;
let sessionSubscription = null;

async function initChat() {
    console.log("INITIALIZING RANDOM CHAT. Session:", sessionId, "Partner:", partnerName);
    if (!sessionId || !partnerName) {
        console.warn("Missing session/partner data. Redirecting to matchmaking...");
        window.location.href = "random.html"
        return
    }

    document.getElementById("partnerName").innerText = partnerName
    document.getElementById("partnerAvatar").innerText = partnerName[0].toUpperCase()

    console.log("Loading messages...");

    // 1. Load existing messages
    const { data: messages, error: fetchErr } = await client
        .from("random_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })

    if (fetchErr) {
        console.error("Fetch Messages Error:", fetchErr)
    } else {
        messages.forEach(msg => displayMessage(msg))
    }

    // 2. Subscribe to new messages
    chatSubscription = client
        .channel(`chat:${sessionId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'random_messages',
            filter: `session_id=eq.${sessionId}`
        }, (payload) => {
            displayMessage(payload.new)
        })
        .subscribe()

    // 3. Subscribe to session deletion (if partner skips)
    sessionSubscription = client
        .channel(`session:${sessionId}`)
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'random_sessions',
            filter: `id=eq.${sessionId}`
        }, (payload) => {
            handlePartnerSkip()
        })
        .subscribe()
}

function handlePartnerSkip() {
    console.log("Partner has skipped.");
    
    // Clear chat
    document.getElementById("messageList").innerHTML = `
        <div style="text-align:center; color:#6366f1; font-size:13px; margin-top:20px;">
            Stranger has skipped the chat.
        </div>
    `
    
    // Update status and button
    const btn = document.getElementById("skipBtn")
    const status = document.getElementById("chatStatus")
    const input = document.getElementById("chatInput")

    if (status) status.innerText = "Stranger has left."
    if (btn) {
        btn.innerText = "Start"
        btn.classList.remove("confirm")
        btn.classList.add("start")
        btn.disabled = false
    }
    
    if (input) {
        input.disabled = true
        input.placeholder = "Chat ended."
    }

    // Cleanup local state
    localStorage.removeItem("misto_random_session")
    localStorage.removeItem("misto_random_partner")
}

function displayMessage(msg) {
    const list = document.getElementById("messageList")
    const div = document.createElement("div")
    div.className = `message ${msg.sender === username ? 'sent' : 'received'}`
    div.innerText = msg.message
    list.appendChild(div)
    list.scrollTop = list.scrollHeight
}

async function sendMessage() {
    const input = document.getElementById("chatInput")
    const text = input.value.trim()
    if (!text || !localStorage.getItem("misto_random_session")) return

    input.value = ""

    const { error: sendErr } = await client
        .from("random_messages")
        .insert({
            session_id: sessionId,
            sender: username,
            message: text
        })

    if (sendErr) {
        console.error("Send Error:", sendErr)
        alert("Failed to send message")
    }
}

// UI HELPERS
window.toggleMenu = function() {
    document.getElementById("sideMenu").classList.toggle("active")
    document.getElementById("overlay").classList.toggle("active")
}

window.logout = function() {
    localStorage.clear()
    window.location.href = "index.html"
}

function loadMenuUser() {
    const u = localStorage.getItem("vanta_username")
    if (!u) return
    document.getElementById("menuUsername").innerText = u
    document.getElementById("menuAvatar").innerText = u[0].toUpperCase()
}

// SKIP LOGIC (3 Steps: Skip -> Sure? -> Start)
async function handleSkipClick() {
    const btn = document.getElementById("skipBtn")
    const status = document.getElementById("chatStatus")

    if (btn.innerText === "Skip") {
        btn.innerText = "Sure?"
        btn.classList.add("confirm")
        return
    }

    if (btn.innerText === "Sure?") {
        await performConfirmSkip()
        return
    }

    if (btn.innerText === "Start") {
        startNewMatchmaking()
        return
    }
}

async function performConfirmSkip() {
    const btn = document.getElementById("skipBtn")
    const status = document.getElementById("chatStatus")

    if (status) status.innerText = "Ending chat..."
    btn.disabled = true

    // Stop subscriptions
    if (chatSubscription) client.removeChannel(chatSubscription)
    if (sessionSubscription) client.removeChannel(sessionSubscription)

    // Delete session (cascade deletes messages)
    if (sessionId) {
        await client.from("random_sessions").delete().eq("id", sessionId)
    }

    // Cleanup local state
    localStorage.removeItem("misto_random_session")
    localStorage.removeItem("misto_random_partner")

    // Update UI
    document.getElementById("messageList").innerHTML = `
        <div style="text-align:center; color:#6366f1; font-size:13px; margin-top:20px;">
            You have skipped the chat.
        </div>
    `
    if (status) status.innerText = "You have skipped the chat!"
    btn.disabled = false
    btn.innerText = "Start"
    btn.classList.remove("confirm")
    btn.classList.add("start")
    
    // Disable input
    const input = document.getElementById("chatInput")
    if (input) {
        input.disabled = true
        input.placeholder = "Chat ended."
    }
}

function startNewMatchmaking() {
    const status = document.getElementById("chatStatus")
    if (status) status.innerText = "Connecting..."
    window.location.href = "random.html?auto=true"
}

async function exitChat() {
    await cleanupSession()
    window.location.href = "app.html"
}

async function cleanupSession() {
    if (chatSubscription) client.removeChannel(chatSubscription)
    if (sessionSubscription) client.removeChannel(sessionSubscription)

    if (sessionId) {
        await client.from("random_sessions").delete().eq("id", sessionId)
    }

    localStorage.removeItem("misto_random_session")
    localStorage.removeItem("misto_random_partner")
}

// VANISH MODE
window.addEventListener("beforeunload", (e) => {
    cleanupSession()
})

// Handle Enter Key
document.getElementById("chatInput")?.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') sendMessage()
})

async function runInit() {
    loadMenuUser()
    await initChat()
}
runInit()
