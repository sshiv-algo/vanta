// ==========================================
// MISTO RANDOM - ROBUST MATCHMAKING LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"
let client = null

// Safe initialization
try {
    client = supabase.createClient(supabaseUrl, supabaseKey)
} catch (e) {
    console.error("Supabase Init Error:", e)
}

const username = localStorage.getItem("vanta_username")
const gender = localStorage.getItem("vanta_gender")

let matchSubscription = null;
let waitingSubscription = null;
let isMatching = false;
let matchmakingTimeout = null;

async function startMatching() {
    console.log("MATCHMAKING STARTED for:", username);
    
    if (!username) {
        if (window.showAlert) {
            showAlert("We couldn't find your username. Please go back to the home page.", "Missing Info")
        } else {
            alert("Please go back home to set your username.")
        }
        return
    }

    if (!client) {
        if (window.showError) {
            showError("Connection failed. Please refresh the page.", "Error")
        } else {
            alert("Connection error. Please refresh.")
        }
        return
    }

    isMatching = true;
    const overlay = document.getElementById("matchingOverlay")
    if (overlay) overlay.style.display = "flex"

    try {
        // 1. Initial Cleanup
        await client.from("waiting_users").delete().eq("username", username)

        // 2. Setup Listeners
        listenForSessions();
        listenForWaitingUsers();

        // 3. Search for existing
        console.log("Checking for existing users...");
        const { data: waitingUsers, error: fetchErr } = await client
            .from("waiting_users")
            .select("*")
            .neq("username", username)
            .order("created_at", { ascending: true })
            .limit(1)

        if (fetchErr) throw fetchErr;

        if (waitingUsers && waitingUsers.length > 0) {
            const partner = waitingUsers[0];
            console.log("Found existing user! Partner:", partner.username);
            await createSession(partner);
        } else {
            console.log("Joining the pool...");
            const { error: joinErr } = await client
                .from("waiting_users")
                .insert({ username, gender })

            if (joinErr) throw joinErr;
            console.log("Joined waiting list. Waiting...");
            
            // Safety Timeout
            clearTimeout(matchmakingTimeout);
            matchmakingTimeout = setTimeout(() => {
                if (isMatching) {
                    if (window.showError) {
                        showError("No partners available at the moment. Try again later!", "Timeout")
                    }
                    cancelMatching();
                }
            }, 30000);
        }
    } catch (err) {
        console.error("Matchmaking Logic Error:", err);
        if (window.showError) {
            showError("Could not connect to the matchmaking server. Please try again.", "Connection Error")
        }
        cancelMatching();
    }
}

async function createSession(partner) {
    if (!isMatching) return;

    // Alphabetical deterministic win
    if (username > partner.username) {
        console.log("Alphabetical win: Partner initiated.");
        return;
    }

    const sessionId = (typeof self.crypto.randomUUID === 'function')
        ? self.crypto.randomUUID()
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

    console.log("Creating session:", sessionId);

    try {
        const { error: sessionErr } = await client
            .from("random_sessions")
            .insert({
                id: sessionId,
                user1: username,
                user2: partner.username,
                active: true
            })

        if (sessionErr) throw sessionErr;

        // Cleanup waiting list for BOTH (User1 does this for both)
        console.log("Session inserted. Cleaning up waiting list...");
        await client.from("waiting_users").delete().in("username", [username, partner.username])
        
        // IMPORTANT: We do NOT call completeMatch here anymore.
        // Both the initiator and the partner will wait for the Realtime 'INSERT' 
        // event to navigate simultaneously.
    } catch (err) {
        console.error("Session Creation Error:", err);
        cancelMatching();
    }
}


function listenForWaitingUsers() {
    waitingSubscription = client
        .channel('public:waiting_users')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'waiting_users'
        }, (payload) => {
            if (payload.new.username !== username) {
                createSession(payload.new);
            }
        })
        .subscribe()
}

function listenForSessions() {
    console.log("Listening for matches (Synchronized)...");
    
    // We use a shared channel for all session events related to ME
    matchSubscription = client
        .channel('public:random_sessions_sync')
        // Case A: I am User 1 (Initiator)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'random_sessions',
            filter: `user1=eq.${username}`
        }, (payload) => {
            console.log("MATCH FOUND (Initiator Role): Synchronizing transition...");
            completeMatch(payload.new.id, payload.new.user2);
        })
        // Case B: I am User 2 (Partner)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'random_sessions',
            filter: `user2=eq.${username}`
        }, (payload) => {
            console.log("MATCH FOUND (Partner Role): Synchronizing transition...");
            completeMatch(payload.new.id, payload.new.user1);
        })
        .subscribe((status) => {
            console.log("Match subscription status:", status);
        })
}

function stopSubscriptions() {
    if (matchSubscription) client.removeChannel(matchSubscription)
    if (waitingSubscription) client.removeChannel(waitingSubscription)
    clearTimeout(matchmakingTimeout);
}

function completeMatch(sid, pname) {
    if (!isMatching) return;
    isMatching = false;
    localStorage.setItem("misto_random_session", sid)
    localStorage.setItem("misto_random_partner", pname)
    stopSubscriptions();
    window.location.href = "randomChat.html";
}

function cancelMatching() {
    console.log("Matching cancelled.");
    isMatching = false;
    const overlay = document.getElementById("matchingOverlay")
    if (overlay) overlay.style.display = "none"
    stopSubscriptions();
    if (username) {
        client.from("waiting_users").delete().eq("username", username).then(() => {});
    }
}

// Ensure cleanup on page leave
window.addEventListener("beforeunload", () => {
    if (isMatching && username) {
        client.from("waiting_users").delete().eq("username", username)
    }
})

// Shared UI Logic
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

// Init
async function init() {
    loadMenuUser()
    if (username && client) {
        await client.from("waiting_users").delete().eq("username", username)
    }
}

// Call init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}