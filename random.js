// ==========================================
// MISTO RANDOM - ROBUST MATCHMAKING LOGIC
// ==========================================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"
const client = supabase.createClient(supabaseUrl, supabaseKey)

const username = localStorage.getItem("vanta_username")
const gender = localStorage.getItem("vanta_gender")

let matchSubscription = null;
let waitingSubscription = null;
let isMatching = false;
let myId = null;

async function startMatching() {
    console.log("MATCHMAKING STARTED for:", username);
    if (!username) {
        alert("Username not found. Please go back to the home page.")
        return
    }

    isMatching = true;
    document.getElementById("matchingOverlay").style.display = "flex"

    // 1. Initial Cleanup (remove any old stale entries for me)
    await client.from("waiting_users").delete().eq("username", username)

    // 2. Listen for sessions being created for ME (User2 case)
    listenForSessions();

    // 3. Listen for other users JOINING the waiting list (User1 case)
    listenForWaitingUsers();

    // 4. Try to find someone ALREADY waiting
    console.log("Checking for existing users...");
    const { data: waitingUsers, error: fetchErr } = await client
        .from("waiting_users")
        .select("*")
        .neq("username", username)
        .order("created_at", { ascending: true })
        .limit(1)

    if (fetchErr) {
        console.error("Fetch Error:", fetchErr);
        return;
    }

    if (waitingUsers && waitingUsers.length > 0) {
        const partner = waitingUsers[0];
        console.log("Found existing user! Partner:", partner.username);
        // I found them, so I am User1, they are User2
        await createSession(partner);
    } else {
        console.log("No one waiting. Joining the pool...");
        // Join the pool
        const { error: joinErr } = await client
            .from("waiting_users")
            .insert({ username, gender })

        if (joinErr) {
            console.error("Join Pool Error:", joinErr);
            return;
        }
        console.log("Successfully joined waiting list. Waiting for a partner...");
    }
}

async function createSession(partner) {
    if (!isMatching) {
        console.log("Match already found or cancelled. Skipping createSession.");
        return;
    }

    // RACE CONDITION PREVENTION: Alphabetical win
    // If two users join at the same time, we agree on one session
    if (username > partner.username) {
        console.log("Alphabetical win: Partner initiated. Waiting for session instead.");
        return;
    }

    const sessionId = (typeof self.crypto.randomUUID === 'function')
        ? self.crypto.randomUUID()
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

    console.log("Creating session:", sessionId, "with partner:", partner.username);

    // 1. Create session record
    const { error: sessionErr } = await client
        .from("random_sessions")
        .insert({
            id: sessionId,
            user1: username,
            user2: partner.username,
            active: true
        })

    if (sessionErr) {
        console.error("Session Insert Error:", sessionErr);
        return;
    }

    // 2. Cleanup waiting list
    console.log("Session created. Cleaning up waiting list...");
    await client.from("waiting_users").delete().in("username", [username, partner.username])

    // 3. Redirect
    completeMatch(sessionId, partner.username);
}

function listenForWaitingUsers() {
    console.log("Listening for new waiting users...");
    waitingSubscription = client
        .channel('public:waiting_users')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'waiting_users'
        }, (payload) => {
            console.log("REALTIME: A new user joined:", payload.new.username);
            if (payload.new.username !== username) {
                createSession(payload.new);
            }
        })
        .subscribe((status) => {
            console.log("Waiting list subscription status:", status);
        })
}

function listenForSessions() {
    console.log("Listening for matches created for me...");
    matchSubscription = client
        .channel('public:random_sessions')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'random_sessions',
            filter: `user2=eq.${username}`
        }, (payload) => {
            console.log("REALTIME: Match found! Session ID:", payload.new.id);
            completeMatch(payload.new.id, payload.new.user1);
        })
        .subscribe((status) => {
            console.log("Session subscription status:", status);
        })
}

function completeMatch(sid, pname) {
    if (!isMatching) return;
    isMatching = false;

    console.log("Match Complete. Redirecting to chat...");
    localStorage.setItem("misto_random_session", sid)
    localStorage.setItem("misto_random_partner", pname)

    // Stop all subs
    stopSubscriptions();

    window.location.href = "randomChat.html";
}

function stopSubscriptions() {
    if (matchSubscription) client.removeChannel(matchSubscription)
    if (waitingSubscription) client.removeChannel(waitingSubscription)
}

async function cancelMatching() {
    console.log("Matching cancelled by user.");
    isMatching = false;
    document.getElementById("matchingOverlay").style.display = "none"
    stopSubscriptions();
    await client.from("waiting_users").delete().eq("username", username)
}

// Ensure cleanup on page leave
window.addEventListener("beforeunload", () => {
    if (isMatching) {
        client.from("waiting_users").delete().eq("username", username)
    }
})

// Initialize: Clear any old state
async function init() {
    if (username) {
        console.log("Initial cleanup for user:", username);
        await client.from("waiting_users").delete().eq("username", username)
    }
}
init();