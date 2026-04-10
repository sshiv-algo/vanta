// ==========================================
// MISTO RANDOM - FIXED MATCHMAKING LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"
let client = null

try {
    client = supabase.createClient(supabaseUrl, supabaseKey)
} catch (e) {
    console.error("Supabase Init Error:", e)
}

const username = localStorage.getItem("vanta_username")
const gender = localStorage.getItem("vanta_gender")

let lobbyChannel = null      // unified realtime + broadcast channel
let isMatching = false
let sessionCreated = false   // atomic lock to prevent double-session
let matchmakingTimeout = null

// ==========================================
// CORE: START MATCHING
// ==========================================
async function startMatching() {
    console.log("MATCHMAKING START:", username)

    if (!username) {
        showAlertSafe("We couldn't find your username. Please go back to the home page.", "Missing Info")
        return
    }
    if (!client) {
        showErrorSafe("Connection failed. Please refresh the page.")
        return
    }
    if (isMatching) return  // prevent double-click

    isMatching = true
    sessionCreated = false

    const overlay = document.getElementById("matchingOverlay")
    if (overlay) overlay.style.display = "flex"

    try {
        // Step 1: Remove any stale entries for this user
        await client.from("waiting_users").delete().eq("username", username)

        // Step 2: Subscribe to the unified lobby channel and WAIT until ready
        await subscribeToLobby()

        // Step 3: Check for an existing user in the queue
        const { data: waitingUsers, error: fetchErr } = await client
            .from("waiting_users")
            .select("*")
            .neq("username", username)
            .order("created_at", { ascending: true })
            .limit(1)

        if (fetchErr) throw fetchErr

        if (waitingUsers && waitingUsers.length > 0) {
            const partner = waitingUsers[0]
            console.log("Found partner in initial query:", partner.username)

            // TIEBREAKER: Lexicographically smaller username is the initiator.
            // If I'm smaller (initiator), I create the session now.
            // If I'm larger (waiter), I insert myself and let the initiator's
            // Realtime listener pick me up and create the session.
            if (username < partner.username) {
                await createSession(partner)
            } else {
                console.log("Tiebreaker: I'm the waiter. Joining queue...")
                await client.from("waiting_users").insert({ username, gender })
                startMatchmakingTimeout()
            }
        } else {
            // Queue is empty — insert self and wait
            console.log("No one waiting. Joining queue...")
            await client.from("waiting_users").insert({ username, gender })
            startMatchmakingTimeout()
        }

    } catch (err) {
        console.error("Matchmaking Error:", err)
        showErrorSafe("Could not connect to matchmaking. Please try again.")
        cancelMatching()
    }
}

// ==========================================
// SUBSCRIBE TO LOBBY (returns Promise)
// ==========================================
function subscribeToLobby() {
    return new Promise((resolve) => {
        lobbyChannel = client
            .channel('random:lobby', {
                config: { broadcast: { self: false } }
            })
            // Listen for new users joining the waiting list
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'waiting_users'
            }, (payload) => {
                if (
                    payload.new.username !== username &&
                    isMatching &&
                    !sessionCreated
                ) {
                    console.log("Realtime: new user in queue:", payload.new.username)
                    createSession(payload.new)
                }
            })
            // Listen for a match broadcast (sent to the partner)
            .on('broadcast', { event: 'match_found' }, (payload) => {
                const data = payload.payload
                if (
                    !sessionCreated &&
                    (data.user1 === username || data.user2 === username)
                ) {
                    console.log("Received match_found broadcast!")
                    sessionCreated = true
                    const partner = data.user1 === username ? data.user2 : data.user1
                    completeMatch(data.sessionId, partner)
                }
            })
            // FALLBACK: Listen for session creation in DB (in case broadcast missed)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'random_sessions'
            }, (payload) => {
                const data = payload.new
                if (
                    !sessionCreated &&
                    isMatching &&
                    (data.user1 === username || data.user2 === username)
                ) {
                    console.log("Received session INSERT fallback!")
                    sessionCreated = true
                    const partner = data.user1 === username ? data.user2 : data.user1
                    completeMatch(data.id, partner)
                }
            })
            .subscribe((status) => {
                console.log("Lobby channel status:", status)
                if (status === 'SUBSCRIBED') {
                    resolve()
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error("Lobby channel failed:", status)
                    resolve() // Resolve anyway, will rely on fallback
                }
            })
    })
}

// ==========================================
// CREATE SESSION (atomic, tiebreaker-safe)
// ==========================================
async function createSession(partner) {
    // TIEBREAKER: only the user with the smaller username creates the session.
    // This prevents BOTH users from creating duplicate sessions when they
    // discover each other simultaneously via Realtime.
    if (username > partner.username) {
        console.log("Tiebreaker: I'm not the initiator, ignoring createSession call.")
        return
    }

    // Lock check — prevent double execution
    if (sessionCreated || !isMatching) return
    sessionCreated = true

    const sessionId = (typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))

    console.log("Creating session:", sessionId, username, "<->", partner.username)

    try {
        const { error: sessionErr } = await client
            .from("random_sessions")
            .insert({
                id: sessionId,
                user1: username,
                user2: partner.username,
                active: true
            })

        if (sessionErr) {
            // Likely a unique constraint violation (race condition handled at DB level)
            console.warn("Session insert conflict (another session already exists):", sessionErr.message)
            sessionCreated = false
            return
        }

        // Remove both users from the waiting list atomically
        await client.from("waiting_users").delete().in("username", [username, partner.username])

        // Broadcast match to the partner (they are listening on 'match_found')
        // Note: broadcast self: false means this event goes to partner only
        await lobbyChannel.send({
            type: 'broadcast',
            event: 'match_found',
            payload: {
                sessionId,
                user1: username,
                user2: partner.username
            }
        })

        console.log("Session ready! Navigating to chat...")
        completeMatch(sessionId, partner.username)

    } catch (err) {
        console.error("Session Creation Error:", err)
        sessionCreated = false
        cancelMatching()
    }
}

// ==========================================
// HELPERS
// ==========================================
function startMatchmakingTimeout() {
    clearTimeout(matchmakingTimeout)
    matchmakingTimeout = setTimeout(() => {
        if (isMatching) {
            showErrorSafe("No partners available right now. Try again!")
            cancelMatching()
        }
    }, 30000)
}

function completeMatch(sid, pname) {
    if (!isMatching) return
    isMatching = false
    clearTimeout(matchmakingTimeout)
    if (lobbyChannel && client) client.removeChannel(lobbyChannel)
    lobbyChannel = null
    localStorage.setItem("misto_random_session", sid)
    localStorage.setItem("misto_random_partner", pname)
    window.location.href = "randomChat.html"
}

function cancelMatching() {
    console.log("Matching cancelled.")
    isMatching = false
    sessionCreated = false
    clearTimeout(matchmakingTimeout)

    const overlay = document.getElementById("matchingOverlay")
    if (overlay) overlay.style.display = "none"

    if (lobbyChannel && client) client.removeChannel(lobbyChannel)
    lobbyChannel = null

    if (username && client) {
        client.from("waiting_users").delete().eq("username", username).then(() => {})
    }
}

function showAlertSafe(msg, title) {
    if (window.showAlert) showAlert(msg, title)
    else alert(msg)
}

function showErrorSafe(msg) {
    if (window.showError) showError(msg)
    else alert(msg)
}

// Cleanup stale entry on tab close
window.addEventListener("beforeunload", () => {
    if (isMatching && username && client) {
        client.from("waiting_users").delete().eq("username", username)
    }
})

// ==========================================
// SHARED UI LOGIC
// ==========================================
window.toggleMenu = function () {
    document.getElementById("sideMenu")?.classList.toggle("active")
    document.getElementById("overlay")?.classList.toggle("active")
}

window.logout = function () {
    localStorage.clear()
    window.location.href = "index.html"
}

function loadMenuUser() {
    const u = localStorage.getItem("vanta_username")
    if (u) {
        const uEl = document.getElementById("menuUsername")
        const aEl = document.getElementById("menuAvatar")
        if (uEl) uEl.innerText = u
        if (aEl) aEl.innerText = u[0].toUpperCase()
    }
}

// ==========================================
// INIT
// ==========================================
async function init() {
    loadMenuUser()

    // Create Audio object for testing (if on random pages)
    window.messageSound = new Audio("assets/sounds/message.mp3");
    if (window.messageSound) window.messageSound.volume = 1.0;

    window.playTestSound = function() {
        console.log("Testing notification sound (random)...");
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

    // Theme initialization
    const savedTheme = localStorage.getItem("vanta_theme")
    if (savedTheme === "light") {
        document.body.classList.add("light-mode")
    }

    // Notifications toggle
    const notificationsToggle = document.getElementById("notificationsToggle")
    if (notificationsToggle) {
        // Default to true if not set
        if (localStorage.getItem("notifications") === null) {
            localStorage.setItem("notifications", "true");
        }
        notificationsToggle.checked = localStorage.getItem("notifications") === "true"
        notificationsToggle.addEventListener("change", (e) => {
            localStorage.setItem("notifications", e.target.checked)
        })
    }

    // Dark Mode toggle
    const darkModeToggle = document.getElementById("darkModeToggle")
    if (darkModeToggle) {
        darkModeToggle.checked = !document.body.classList.contains("light-mode")
        darkModeToggle.addEventListener("change", (e) => {
            if (e.target.checked) {
                document.body.classList.remove("light-mode")
                localStorage.setItem("vanta_theme", "dark")
            } else {
                document.body.classList.add("light-mode")
                localStorage.setItem("vanta_theme", "light")
            }
        })
    }

    // Share Button
    const shareBtn = document.getElementById("shareBtn")
    if (shareBtn) {
        shareBtn.onclick = () => {
            if (navigator.share) {
                navigator.share({
                    title: "Misto",
                    text: "Check out Misto — anonymous stories & chats",
                    url: window.location.origin
                }).catch(() => {})
            } else {
                navigator.clipboard.writeText(window.location.origin)
                    .then(() => { if (window.showToast) showToast("Link copied!") })
                    .catch(() => {})
            }
        }
    }

    // External link handlers
    const discordBtn = document.getElementById("discordBtn")
    if (discordBtn) discordBtn.onclick = () => window.open("https://discord.gg/PhA4fxKv", "_blank")
    const privacyBtn = document.getElementById("privacyBtn")
    if (privacyBtn) privacyBtn.onclick = () => window.open("/privacy.html", "_blank")
    const termsBtn = document.getElementById("termsBtn")
    if (termsBtn) termsBtn.onclick = () => window.open("/terms.html", "_blank")

    // Auto-start if redirected with ?auto=true
    const params = new URLSearchParams(window.location.search)
    if (params.get("auto") === "true") {
        startMatching()
    }

    // Clean up any stale waiting entry for this user on load
    if (username && client) {
        await client.from("waiting_users").delete().eq("username", username)
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
} else {
    init()
}