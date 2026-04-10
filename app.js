// ================== GLOBAL ==================
let currentViewers = []
let isViewerOpen = false
let currentStories = []
let currentIndex = 0
let storyTimer = null
let isLongPress = false
let touchTimer = null
let selectedDuration = null

// --- Notifications & Sound ---
let currentChatId = null;
const messageSound = new Audio("assets/sounds/message.mp3");
messageSound.volume = 1.0;
let lastSoundTime = 0;


// Swipe tracking
let startY = 0
let endY = 0


// ================== VIEWED STORIES ==================

function getViewedStories() {
    return JSON.parse(localStorage.getItem("viewedStories")) || {}
}

function markStoryViewed(user) {
    const viewed = getViewedStories()
    viewed[user] = true
    localStorage.setItem("viewedStories", JSON.stringify(viewed))
}


// ================== SUPABASE ==================

const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"

const client = supabase.createClient(supabaseUrl, supabaseKey)


// ================== USERNAME ==================

let username = localStorage.getItem("vanta_username")

if (!username || username === "null" || username === "undefined") {
    username = generateUsername()
    localStorage.setItem("vanta_username", username)
}


// ================== GENDER ==================

document.addEventListener("DOMContentLoaded", () => {
    // Theme initialization
    const savedTheme = localStorage.getItem("vanta_theme")
    if (savedTheme === "light") {
        document.body.classList.add("light-mode")
    }

    // Notifications initialization
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

    // Dark Mode Toggle
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
                }).catch(() => { })
            } else {
                navigator.clipboard.writeText(window.location.origin)
                    .then(() => showToast("Link copied!"))
                    .catch(() => { })
            }
        }
    }

    // External Link Handlers
    const discordBtn = document.getElementById("discordBtn")
    if (discordBtn) {
        discordBtn.onclick = () => window.open("https://discord.gg/PhA4fxKv", "_blank")
    }
    const privacyBtn = document.getElementById("privacyBtn")
    if (privacyBtn) {
        privacyBtn.onclick = () => window.open("privacy.html", "_blank")
    }
    const termsBtn = document.getElementById("termsBtn")
    if (termsBtn) {
        termsBtn.onclick = () => window.open("terms.html", "_blank")
    }

    const onboarding = document.getElementById("onboardingScreen")
    const isVerified = localStorage.getItem("is18Verified")

    if (isVerified) {
        onboarding.classList.add("hidden")
    } else {
        onboarding.classList.remove("hidden")
    }

    setupViewerControls()
    loadMenuUser()
})

let selectedOnboardingGender = null

window.selectOnboardingGender = function (g) {
    selectedOnboardingGender = g

    // UI Update
    document.querySelectorAll(".gender-card").forEach(c => c.classList.remove("active"))
    document.getElementById(`gender-${g}`).classList.add("active")

    toggleOnboardingCTA()
}

window.toggleOnboardingCTA = function () {
    const is18 = document.getElementById("ageCheck").checked
    const btn = document.getElementById("onboardingContinue")

    if (selectedOnboardingGender && is18) {
        btn.disabled = false
    } else {
        btn.disabled = true
    }
}

window.submitOnboarding = function () {
    const is18 = document.getElementById("ageCheck").checked

    if (!selectedOnboardingGender || !is18) {
        showToast("Please complete all fields")
        return
    }

    // Save
    localStorage.setItem("vanta_gender", selectedOnboardingGender)
    localStorage.setItem("is18Verified", "true")

    // Animate out
    const screen = document.getElementById("onboardingScreen")
    screen.classList.add("fade-out")

    setTimeout(() => {
        screen.classList.add("hidden")
        loadStories()
    }, 600)
}


// ================== POST STORY ==================

async function postStory() {

    const text = document.getElementById("storyText").value
    const imageFile = document.getElementById("storyImage").files[0]

    if (!text && !imageFile) {
        showAlert("Please add some text or an image to post a story.")
        return
    }


    if (!selectedDuration) {
        showAlert("Please select a story duration before posting.")
        return
    }


    let mediaUrl = null

    if (imageFile) {
        const fileName = Date.now() + "_" + imageFile.name

        const { error } = await client.storage
            .from("stories")
            .upload(fileName, imageFile)

        if (error) {
            console.error(error)
            showError("We couldn't upload your image. Please try again.")
            return
        }


        mediaUrl = `${supabaseUrl}/storage/v1/object/public/stories/${fileName}`
    }

    let expires = new Date()
    expires.setHours(expires.getHours() + selectedDuration)

    const { error } = await client.from("stories").insert({
        username,
        gender: localStorage.getItem("vanta_gender"),
        text_content: text,
        media_url: mediaUrl,
        created_at: new Date(),
        expires_at: expires
        // REMOVED 'duration' key temporarily to avoid Supabase errors if the column is missing
    })


    if (error) {
        console.error(error)
        showError("Something went wrong while posting your story.")
        return
    }


    document.getElementById("storyText").value = ""
    document.getElementById("storyImage").value = ""

    // Reset duration selection
    selectedDuration = null
    document.querySelectorAll(".duration-btn").forEach(b => b.classList.remove("active-dur"))

    // Hide upload box
    openUpload()

    loadStories()
}

window.selectDuration = function (d) {
    selectedDuration = d
    document.querySelectorAll(".duration-btn").forEach(b => b.classList.remove("active-dur"))
    document.getElementById("dur" + d).classList.add("active-dur")
}



// ================== LOAD STORIES ==================

async function loadStories() {

    const now = new Date().toISOString()

    const { data, error } = await client
        .from("stories")
        .select("*")
        .gt("expires_at", now)
        .order("created_at", { ascending: true })

    if (error) return console.error(error)

    const container = document.getElementById("stories")
    container.innerHTML = ""

    const viewed = getViewedStories()

    // YOUR STORY
    const yourStories = data.filter(s => s.username === username)
    const yourDiv = document.querySelector(".your-story")

    if (yourStories.length > 0) {
        const latestYourStory = yourStories[yourStories.length - 1]
        const yourTime = formatTime(latestYourStory.created_at)

        yourDiv.innerHTML = `
        <div style="position:relative;">
            <div class="status-circle">${username[0]}</div>

            <!-- ➕ BUTTON -->
            <div class="add-btn">+</div>
        </div>

        <div class="status-text">
            <b>Your Story</b>
            <p>${yourStories.length} update(s) • ${yourTime}</p>
        </div>
    `

        // VIEW STORY (click anywhere)
        yourDiv.onclick = () => openStorySequence(yourStories, 0)

        // ➕ CLICK (STOP PROPAGATION)
        yourDiv.querySelector(".add-btn").onclick = (e) => {
            e.stopPropagation()
            openUpload()
        }

    } else {

        yourDiv.innerHTML = `
        <div class="status-circle plus">+</div>
        <div class="status-text">
            <b>Your Story</b>
            <p>Tap to add</p>
        </div>
    `

        yourDiv.onclick = openUpload
    }

    // OTHER USERS
    const users = {}

    data.forEach(s => {
        if (s.username === username) return
        if (!users[s.username]) users[s.username] = []
        users[s.username].push(s)
    })

    // Inject Misto Official Updates Story
    users["Misto Official"] = [{
        id: "misto-official",
        username: "Misto Official",
        text_content: "🚀 Misto Official v2.5:\n\n✨ 30s Vanish Mode: Privacy for your regular chats\n✨ 24h Story Replies: Never miss a reaction to your updates\n✨ Real-Time Sync: Instant disappears with smooth animations\n✨ Story Timestamps: See 'just now' or '5 min ago' on all stories\n\nEnjoy the most private Misto yet! 🥷",
        media_url: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        viewers: []
    }]

    const localSeen = JSON.parse(localStorage.getItem("seenStoryIds")) || [];

    const unseen = Object.keys(users).filter(u => {
        if (u === "Misto Official") return !viewed[u];

        const stories = users[u];
        return stories.some(s => {
            if (localSeen.includes(s.id)) return false;
            const viewers = s.viewers || [];
            const inDb = viewers.some(v => (typeof v === "string" ? v : v.username) === username);
            if (inDb) {
                if (!localSeen.includes(s.id)) {
                    localSeen.push(s.id);
                    localStorage.setItem("seenStoryIds", JSON.stringify(localSeen));
                }
                return false;
            }
            return true;
        });
    });

    const seen = Object.keys(users).filter(u => !unseen.includes(u));

    // Sorting: 1. Official first, 2. Exclusive (1h) stories, 3. Normal
    const sortPriority = (arr) => arr.sort((a, b) => {
        if (a === "Misto Official") return -1
        if (b === "Misto Official") return 1

        const aStories = users[a]
        const bStories = users[b]

        const checkExclusive = (stories) => stories.some(s => {
            const diff = new Date(s.expires_at).getTime() - new Date(s.created_at).getTime()
            return diff < 7200000 // Less than 2 hours
        })

        const aHasExclusive = checkExclusive(aStories)
        const bHasExclusive = checkExclusive(bStories)

        if (aHasExclusive && !bHasExclusive) return -1
        if (!aHasExclusive && bHasExclusive) return 1
        return 0
    })


    const sorted = [
        ...sortPriority(unseen),
        ...sortPriority(seen)
    ]

    sorted.forEach(user => {

        const isUnseen = unseen.includes(user);
        const ring = isUnseen ? "unseen" : "seen";
        const stories = users[user]

        const hasExclusive = stories.some(s => {
            const diff = new Date(s.expires_at).getTime() - new Date(s.created_at).getTime()
            return diff < 7200000 // Less than 2 hours
        })

        const officialBadge = user === "Misto Official"

            ? `<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align: -2px; margin-left: 4px;"><path fill="#6366f1" d="M22.5 12.5l-2.1 2.3.5 3.1-3 .9-1.6 2.6-2.9-1.2L11 22.5l-2.4-2.3-2.9 1.2-1.6-2.6-3-.9.5-3.1L-.5 12.5l2.1-2.3-.5-3.1 3-.9 1.6-2.6 2.9 1.2L11 2.5l2.4 2.3 2.9-1.2 1.6 2.6 3 .9-.5 3.1z"/><path fill="#fff" d="M9.8 16.8l-4.2-4.2 1.4-1.4 2.8 2.8 7.1-7.1 1.4 1.4z"/></svg>`
            : ""

        const exclusiveBadge = hasExclusive ? `<span class="exclusive-badge">⚡ Exclusive</span>` : ""

        const latestStory = stories[stories.length - 1]
        const timeStr = formatTime(latestStory.created_at)

        const div = document.createElement("div")
        div.className = "status-item" + (hasExclusive ? " exclusive-story" : "")

        div.innerHTML = `
            <div class="status-circle ${ring}">${user[0]}</div>
            <div class="status-text">
                <b>${user}${officialBadge}${exclusiveBadge}</b>
                <p>View story • ${timeStr}</p>
            </div>
        `

        const startIndex = stories.findIndex(s => {
            if (s.id === "misto-official") return false;
            if (localSeen.includes(s.id)) return false;
            const viewers = s.viewers || [];
            return !viewers.some(v => (typeof v === "string" ? v : v.username) === username);
        });
        const startIdx = startIndex !== -1 ? startIndex : 0;

        div.onclick = () => openStorySequence(stories, startIdx)

        container.appendChild(div)
    })
}



// ================== STORY VIEW ==================

function openStory(story) {
    console.log("Story object:", story)
    const viewer = document.getElementById("viewer")

    const isOwner = story.username === username

    const timeText = formatTime(story.created_at)

    const officialBadge = story.username === "Misto Official"
        ? `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: -3px; margin-left: 4px; margin-right: 2px;"><path fill="#6366f1" d="M22.5 12.5l-2.1 2.3.5 3.1-3 .9-1.6 2.6-2.9-1.2L11 22.5l-2.4-2.3-2.9 1.2-1.6-2.6-3-.9.5-3.1L-.5 12.5l2.1-2.3-.5-3.1 3-.9 1.6-2.6 2.9 1.2L11 2.5l2.4 2.3 2.9-1.2 1.6 2.6 3 .9-.5 3.1z"/><path fill="#fff" d="M9.8 16.8l-4.2-4.2 1.4-1.4 2.8 2.8 7.1-7.1 1.4 1.4z"/></svg>`
        : ""

    const durationMs = new Date(story.expires_at).getTime() - new Date(story.created_at).getTime()
    const isExclusive = durationMs < 7200000 // Less than 2 hours
    const exclusiveBadge = isExclusive ? `<span class="exclusive-badge">⚡ Exclusive</span>` : ""

    document.getElementById("viewerUser").innerHTML =

        `${story.username}${officialBadge}${exclusiveBadge} • ${timeText}`


    let content = ""
    if (story.media_url) {
        content += `<img src="${story.media_url}" class="story-media">`
    }
    if (story.text_content) {
        // If there's an image, style it as a caption overlay. If text only, style as full centered text.
        const textClass = story.media_url ? "story-caption" : "story-text"
        content += `<div class="${textClass}">${story.text_content}</div>`
    }

    document.getElementById("viewerText").innerHTML = content

    // REPLY BOX
    const replyBox = document.getElementById("replyBox")
    const replyInput = document.getElementById("replyInput")
    if (replyBox) {
        if (isOwner) {
            replyBox.classList.add("hidden")
        } else {
            replyBox.classList.remove("hidden")
            if (replyInput) replyInput.value = ""
        }
    }

    closeReactionPanel(); // Ensure panel closes across jumps

    // REMOVE OLD EYE
    const oldEye = document.querySelector(".view-count")
    if (oldEye) oldEye.remove()

    // ADD ONLY FOR OWNER
    if (isOwner) {

        currentViewers = (story.viewers || []).map(v =>
            typeof v === "string" ? { username: v, time: new Date().toISOString() } : v
        )

        // Migrate old string-format viewers to objects in DB
        if ((story.viewers || []).some(v => typeof v === "string")) {
            client.from("stories").update({ viewers: currentViewers }).eq("id", story.id)
        }

        const eye = document.createElement("div")
        eye.className = "view-count"

        const count = currentViewers
            .map(v => typeof v === "string" ? { username: v } : v)
            .filter(v => v.username !== username)
            .length
        eye.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${count}`

        eye.onclick = (e) => {
            e.stopPropagation()
            openViewerList()
        }

        viewer.appendChild(eye)
    }
    // REMOVE OLD DELETE BTN
    const old = document.querySelector(".delete-btn")
    if (old) old.remove()

    // ADD DELETE IF OWNER
    if (isOwner) {
        const btn = document.createElement("div")
        btn.className = "delete-btn"
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
        btn.onclick = (e) => {
            e.stopPropagation()
            pauseStory()
            showConfirm("Are you sure you want to delete this story?", () => {
                deleteStory(story.id)
            }, () => {
                resumeStory()
            })
        }


        btn.onmousedown = (e) => e.stopPropagation()
        btn.onmouseup = (e) => e.stopPropagation()
        btn.ontouchstart = (e) => e.stopPropagation()
        btn.ontouchend = (e) => e.stopPropagation()
        viewer.appendChild(btn)
    }

    viewer.classList.remove("hidden")
}


// ================== DELETE STORY ==================

async function deleteStory(id) {

    console.log("DELETE CLICKED:", id, typeof id)

    const { data, error } = await client
        .from("stories")
        .delete()
        .match({ id: id })
        .select()

    console.log("RESULT:", data)
    console.log("ERROR:", error)

    if (error) {
        showError("Failed to delete the story. Please try again.")
        return
    }

    if (!data || data.length === 0) {
        showError("We couldn't find the story to delete.")
        return
    }

    showToast("Story deleted successfully")


    closeViewer()
    loadStories()
}


async function addViewer(story) {

    // Prevent counting viewers for the local fake story
    if (story.id === "misto-official") return

    const { data } = await client
        .from("stories")
        .select("viewers")
        .eq("id", story.id)
        .single()

    let viewers = (data?.viewers || []).map(v =>
        typeof v === "string" ? { username: v, time: null } : v
    )

    const already = viewers.find(v => v.username === username)

    if (!already) {

        viewers.push({
            username: username,
            time: new Date().toISOString()
        })

        await client
            .from("stories")
            .update({ viewers })
            .eq("id", story.id)
    }

    currentViewers = viewers
    updateViewerCount()
}
// ================== STORY SEQUENCE ==================

function openStorySequence(stories, index) {

    currentStories = stories
    currentIndex = index

    if (!getViewedStories()[stories[0].username]) {
        markStoryViewed(stories[0].username)
        loadStories()
    }

    showStory()
}

function showStory() {

    const story = currentStories[currentIndex]

    const localSeen = JSON.parse(localStorage.getItem("seenStoryIds")) || [];
    if (!localSeen.includes(story.id) && story.username !== username) {
        localSeen.push(story.id);
        localStorage.setItem("seenStoryIds", JSON.stringify(localSeen));

        const unseenRemaining = currentStories.some(s => !localSeen.includes(s.id));
        if (!unseenRemaining) {
            document.querySelectorAll(".status-item").forEach(item => {
                const b = item.querySelector("b");
                if (b && b.innerText.includes(story.username)) {
                    const circle = item.querySelector(".status-circle");
                    if (circle) {
                        circle.classList.remove("unseen");
                        circle.classList.add("seen");
                    }
                }
            });
        }
    }

    openStory(story)

    if (story.username !== username) {
        addViewer(story)
    }

    const container = document.getElementById("storyProgress")
    container.innerHTML = ""

    currentStories.forEach((_, i) => {

        const bar = document.createElement("div")
        bar.className = "progress-bar"

        const fill = document.createElement("div")
        fill.className = "progress-fill"

        if (i < currentIndex) fill.style.width = "100%"

        bar.appendChild(fill)
        container.appendChild(bar)
    })

    const fill = container.children[currentIndex].firstChild

    setTimeout(() => fill.style.width = "100%", 50)

    clearTimeout(storyTimer)

    storyTimer = setTimeout(nextStory, 4000)
}


// ================== NAV ==================

function nextStory() {
    if (isLongPress) return

    if (currentIndex + 1 < currentStories.length) {
        currentIndex++
        showStory()
    } else {
        closeViewer()
    }
}

function prevStory() {
    if (isLongPress) return
    if (currentIndex > 0) {
        currentIndex--
        showStory()
    }
}


// ================== HOLD ==================

let pressStartTime = 0;

function pauseStory() {
    isLongPress = true
    pressStartTime = Date.now()
    clearTimeout(storyTimer)

    // Pause the progress bar animation visually
    const container = document.getElementById("storyProgress")
    if (container && container.children[currentIndex]) {
        const fill = container.children[currentIndex].firstChild
        if (fill) {
            fill.style.width = window.getComputedStyle(fill).width
            fill.style.transition = "none"
        }
    }
}

function resumeStory() {
    // If user is still typing, don't resume
    if (document.activeElement === document.getElementById("replyInput")) {
        return
    }

    const pressDuration = Date.now() - (pressStartTime || Date.now())

    // Only block the next expected 'click' event if this was actually a long hold
    if (pressDuration > 200) {
        setTimeout(() => isLongPress = false, 100) // Keep true so any queued click event is ignored
    } else {
        isLongPress = false
    }

    storyTimer = setTimeout(nextStory, 2000)

    // Resume the progress bar animation visually
    const container = document.getElementById("storyProgress")
    if (container && container.children[currentIndex]) {
        const fill = container.children[currentIndex].firstChild
        if (fill) {
            void fill.offsetWidth // Force browser reflow to apply transition immediately
            fill.style.transition = "width 2s linear"
            fill.style.width = "100%"
        }
    }
}

function updateViewerCount() {

    const eye = document.querySelector(".view-count")

    if (eye) {

        const count = currentViewers
            .map(v => typeof v === "string" ? { username: v } : v)
            .filter(v => v.username !== username)
            .length

        eye.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${count}`
    }
}

// ================== VIEWER CONTROLS ==================

function setupViewerControls() {

    const viewer = document.getElementById("viewer")

    // Disable default touch behavior to prevent pull-to-refresh when swiping
    viewer.addEventListener("touchmove", (e) => {
        if (e.cancelable) e.preventDefault()
    }, { passive: false })

    viewer.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY
        pauseStory()
    })

    viewer.addEventListener("touchend", (e) => {
        endY = e.changedTouches[0].clientY
        const deltaY = startY - endY

        // Swipe up
        if (deltaY > 50) {
            const story = currentStories[currentIndex]
            if (story && story.username === username) {
                openViewerList()
                return // Don't resume story, wait for list to close
            } else if (story && story.username !== username && story.id !== "misto-official") {
                openReactionPanel()
                return // Wait for panel to close
            }
        }

        resumeStory()
    })

    viewer.addEventListener("mousedown", pauseStory)
    viewer.addEventListener("mouseup", resumeStory)

    // Swipe down to close viewer list
    const viewerSheet = document.getElementById("viewerList")

    viewerSheet.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY
    }, { passive: true })

    viewerSheet.addEventListener("touchend", (e) => {
        endY = e.changedTouches[0].clientY
        const deltaY = endY - startY
        if (deltaY > 80) { // More robust swipe down threshold
            closeViewerList()
        }
    })

    // Swipe down to close reaction panel
    const reactPanel = document.getElementById("reactionPanel")
    if (reactPanel) {
        reactPanel.addEventListener("touchstart", (e) => {
            startY = e.touches[0].clientY
        }, { passive: true })

        reactPanel.addEventListener("touchend", (e) => {
            endY = e.changedTouches[0].clientY
            const deltaY = endY - startY
            if (deltaY > 50) {
                closeReactionPanel()
            }
        })
    }
}

function openReactionPanel() {
    isViewerOpen = true;
    pauseStory();
    const panel = document.getElementById("reactionPanel");
    if (panel) panel.classList.add("active");
}

function closeReactionPanel() {
    isViewerOpen = false;
    const panel = document.getElementById("reactionPanel");
    if (panel) panel.classList.remove("active");
    if (document.getElementById("viewer") && !document.getElementById("viewer").classList.contains("hidden")) {
        resumeStory();
    }
}


function openViewerList() {
    isViewerOpen = true
    pauseStory()

    const sheet = document.getElementById("viewerList")
    const list = document.getElementById("viewerListContent")
    if (!sheet || !list) return

    list.innerHTML = `<div class="loading-viewers">Loading viewers...</div>`

    const filtered = (currentViewers || [])
        .map(v => typeof v === "string"
            ? { username: v, time: new Date().toISOString() }
            : v
        )
        .filter(v => v.username !== username)

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: #666;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px; opacity:0.5;">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <p style="font-size:15px;">No viewers yet</p>
            </div>`
    } else {
        list.innerHTML = ""
        filtered.forEach(v => {
            const reactionBadge = v.reaction ? `<div class="viewer-reaction-badge">${v.reaction}</div>` : "";
            const div = document.createElement("div")
            div.className = "viewer-item"
            div.innerHTML = `
                <div class="viewer-avatar">${v.username[0].toUpperCase()}</div>
                <div class="viewer-info">
                    <span class="viewer-name">${v.username}</span>
                    <span class="viewer-time">${formatTime(v.time)}</span>
                </div>
                ${reactionBadge}
            `
            list.appendChild(div)
        })
    }

    sheet.classList.add("active")
}

function closeViewerList() {
    isViewerOpen = false
    const sheet = document.getElementById("viewerList")
    if (sheet) sheet.classList.remove("active")
    resumeStory()
}



function formatTime(time) {
    if (!time) return "Just now"
    const diff = Date.now() - new Date(time).getTime()

    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (mins < 1) return "Just now"
    if (mins === 1) return "1 minute ago"
    if (mins < 60) return `${mins}m ago`
    return `${hours}h ago`
}


// ================== CLOSE ==================


function closeViewer() {
    clearTimeout(storyTimer)
    document.getElementById("viewer").classList.add("hidden")
}


// ================== AUTO ==================

setInterval(loadStories, 60000)


// ================== LOGOUT ==================

window.logout = function () {
    console.log("Logout clicked") // debug
    localStorage.clear()
    window.location.href = "index.html"
}


// ================== UI ==================

function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active")
    document.getElementById("overlay").classList.toggle("active")
}

function openUpload() {
    document.getElementById("uploadBox").classList.toggle("hidden")
}

function loadMenuUser() {
    const u = localStorage.getItem("vanta_username")
    if (!u) return
    document.getElementById("menuUsername").innerText = u
    document.getElementById("menuAvatar").innerText = u[0].toUpperCase()
}


// ================== CHAT SYSTEM ==================

async function sendReply() {
    const replyInput = document.getElementById("replyInput")
    if (!replyInput) return

    const message = replyInput.value.trim()
    if (!message) return

    if (!currentStories || currentStories.length === 0) {
        showToast("Error: No story found.")
        return
    }

    const story = currentStories[currentIndex]
    if (!story) {
        showToast("Error: Story expired or missing.")
        return
    }

    const receiver = story.username

    if (receiver === username) {
        showToast("You cannot reply to your own story.")
        return
    }

    // 1. Find or create conversation
    let { data: convo, error: convoErr } = await client
        .from("conversations")
        .select("id")
        .or(`and(user1.eq.${username},user2.eq.${receiver}),and(user1.eq.${receiver},user2.eq.${username})`)
        .single()

    let convoId;

    if (convoErr || !convo) {
        const { data: newConvo, error: insErr } = await client
            .from("conversations")
            .insert({ user1: username, user2: receiver })
            .select()
            .single()

        if (insErr) {
            showToast("Failed to start conversation.")
            return
        }
        convoId = newConvo.id
    } else {
        convoId = convo.id
    }

    // 2. Insert message
    const { error: msgErr } = await client.from("messages").insert({
        conversation_id: convoId,
        sender: username,
        message: message,
        is_story_reply: true,
        seen_at: null
    })

    if (msgErr) {
        console.error("Story Reply Error:", msgErr)
        showToast("Failed to send message. (Check console for error)")
        return
    }

    // 3. Clear and Notify
    replyInput.value = ""
    replyInput.blur() // This will trigger resumeStory()
    showToast("Message sent!")
}

function showToast(text) {
    const container = document.getElementById("toastContainer")
    if (!container) return

    const toast = document.createElement("div")
    toast.className = "toast"
    toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${text}`

    container.appendChild(toast)
    setTimeout(() => {
        toast.style.opacity = "0"
        toast.style.transform = "translateY(-20px)"
        setTimeout(() => toast.remove(), 400)
    }, 3000)
}

async function checkUnreadGlobal() {
    const dot = document.getElementById("unreadDot")
    if (!dot) return

    const lastCheck = localStorage.getItem("last_inbox_check") || new Date(0).toISOString()

    const { data, error } = await client
        .from("messages")
        .select("id")
        .neq("sender", username)
        .gt("created_at", lastCheck)
        .limit(1)

    if (data && data.length > 0) {
        dot.classList.remove("hidden")
    } else {
        dot.classList.add("hidden")
    }
}

async function clearChatMessages(convoId) {
    if (!convoId) return

    // Check if this is a random chat session
    const isRandom = localStorage.getItem("misto_random") === "true"

    if (isRandom) {
        console.log("Vanish Mode (Random): Global Purge...")
        await client.from("messages").delete().eq("conversation_id", convoId)
        return
    }

    console.log("Vanish Mode Cleanup: Processing exit purge...")

    // PER-USER VANISH LOGIC: Add username to cleared_by array
    const { data: msgsToClear } = await client
        .from("messages")
        .select("id, cleared_by")
        .eq("conversation_id", convoId)
        .eq("is_story_reply", false)
        .not('cleared_by', 'cs', '{"' + username + '"}')

    if (msgsToClear && msgsToClear.length > 0) {
        for (const m of msgsToClear) {
            let arr = m.cleared_by || []
            if (!arr.includes(username)) {
                arr.push(username)

                // If both users have cleared it (or it's the only 2 users), delete it completely to save space
                if (arr.length >= 2) {
                    client.from("messages").delete().eq("id", m.id).then()
                } else {
                    client.from("messages").update({ cleared_by: arr }).eq("id", m.id).then()
                }
            }
        }
    }

    // Background Cleanup: Delete story replies older than 24h
    const dayAgo = new Date(Date.now() - 86400000).toISOString()
    await client.from("messages").delete().eq("is_story_reply", true).lt("created_at", dayAgo)
}

async function skipChat() {
    const btn = document.getElementById("skipBtn")
    if (!btn) return

    if (!btn.classList.contains("confirm")) {
        btn.innerText = "SURE?"
        btn.classList.add("confirm")
        setTimeout(() => {
            if (btn) {
                btn.innerText = "SKIP"
                btn.classList.remove("confirm")
            }
        }, 3000)
        return
    }

    const convoId = localStorage.getItem("chat_id")
    if (convoId) {
        // Global delete: Messages and Conversation
        await client.from("messages").delete().eq("conversation_id", convoId)
        await client.from("conversations").delete().eq("id", convoId)
    }

    localStorage.setItem("auto_match", "true")
    window.location.href = "random.html"
}

async function exitChat() {
    const convoId = localStorage.getItem("chat_id")
    await clearChatMessages(convoId)
    localStorage.removeItem("misto_random")
    window.location.href = "inbox.html"
}

// ================== STORY REACTIONS ==================

async function sendReaction(emoji) {
    if (!currentStories || currentStories.length === 0) return;
    const story = currentStories[currentIndex];
    if (!story || story.username === username || story.id === "misto-official") return;

    // 1. Play haptic float visual
    playReactionAnim(emoji);
    closeReactionPanel();

    // 2. Update DB viewers array
    const { data } = await client
        .from("stories")
        .select("viewers")
        .eq("id", story.id)
        .single();

    let viewers = (data?.viewers || []).map(v =>
        typeof v === "string" ? { username: v, time: new Date().toISOString(), reaction: null } : v
    );

    let myView = viewers.find(v => v.username === username);
    if (!myView) {
        myView = { username: username, time: new Date().toISOString(), reaction: emoji };
        viewers.push(myView);
    } else {
        myView.reaction = emoji;
    }

    await client.from("stories").update({ viewers }).eq("id", story.id);

    // Update local state so it renders correctly if viewer list is opened
    currentViewers = viewers;

    // 3. Send chat message if conversation exists
    checkAndSendReactionMessage(story.username, emoji);
}

function playReactionAnim(emoji) {
    const container = document.getElementById("reactionAnimationContainer");
    if (!container) return;

    const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 emojis

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const el = document.createElement("div");
            el.className = "floating-reaction";
            el.innerText = emoji;
            // Random horizontal drift between -30px and 30px
            const dx = (Math.random() - 0.5) * 60;
            el.style.setProperty("--dx", `${dx}px`);

            // Randomly scale starting size a bit
            const scale = 0.8 + Math.random() * 0.4;
            el.style.transform = `translateX(-50%) translateY(0) scale(${scale})`;

            container.appendChild(el);

            setTimeout(() => {
                if (el.parentNode) el.remove();
            }, 1200);
        }, i * 150); // Stagger animations
    }
}

async function checkAndSendReactionMessage(receiver, emoji) {
    // Check if conversation exists
    const { data: convo, error } = await client
        .from("conversations")
        .select("id")
        .or(`and(user1.eq.${username},user2.eq.${receiver}),and(user1.eq.${receiver},user2.eq.${username})`)
        .single();

    if (convo && convo.id) {
        // Conversation exists! Send reaction message
        await client.from("messages").insert({
            conversation_id: convo.id,
            sender: username,
            message: `${emoji} reacted to your story`,
            is_story_reply: true,
            seen_at: null
        });
    }
}

async function loadChats() {
    const list = document.getElementById("chatList")
    if (!list) return

    localStorage.setItem("last_inbox_check", new Date().toISOString())
    if (document.getElementById("unreadDot")) {
        document.getElementById("unreadDot").classList.add("hidden")
    }

    const { data, error } = await client
        .from("conversations")
        .select("*")
        .or(`user1.eq.${username},user2.eq.${username}`)
        .eq("is_random", false)
        .order("created_at", { ascending: false })

    if (error) {
        list.innerHTML = `<p style="text-align:center; padding: 20px; color: #ef4444;">Error loading chats.</p>`
        return
    }

    if (!data || data.length === 0) {
        list.innerHTML = `<p style="text-align:center; padding: 30px; color: #666; font-size: 14px;">No messages yet.</p>`
        return
    }

    list.innerHTML = ""
    for (const convo of data) {
        const otherUser = convo.user1 === username ? convo.user2 : convo.user1

        // Check for unread messages (seen: false, sender != current user, not cleared by me)
        const { count, error: countErr } = await client
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .eq("conversation_id", convo.id)
            .neq("sender", username)
            .is("seen_at", null)
            .not('cleared_by', 'cs', '{"' + username + '"}')

        const isUnread = !countErr && count > 0
        const previewText = isUnread ? "unread message" : "Tap to open chat"
        const previewClass = isUnread ? "unread-text" : ""

        const item = document.createElement("div")
        item.className = "chat-item"
        item.onclick = () => openChat(convo.id, otherUser)

        item.innerHTML = `
            <div class="chat-avatar">${otherUser[0].toUpperCase()}</div>
            <div class="chat-info">
                <div class="chat-name">${otherUser}</div>
                <div class="chat-preview ${previewClass}">${previewText}</div>
            </div>
        `
        list.appendChild(item)
    }
}

function openChat(convoId, otherUser) {
    localStorage.setItem("chat_id", convoId)
    localStorage.setItem("chat_user", otherUser)
    window.location.href = "chat.html"
}

async function loadMessages() {
    const convoId = localStorage.getItem("chat_id")
    const otherUser = localStorage.getItem("chat_user")
    const isRandom = localStorage.getItem("misto_random") === "true"
    const list = document.getElementById("messagesList")
    const headerTitle = document.getElementById("chatActiveUser")
    const headerAvatar = document.getElementById("headerAvatar")
    const headerStatus = document.getElementById("headerStatus")

    if (!convoId || !list) return

    if (headerTitle) {
        headerTitle.innerText = isRandom ? "Stranger" : otherUser
    }
    if (headerAvatar) {
        const displayUser = isRandom ? "Stranger" : otherUser
        headerAvatar.innerText = displayUser[0].toUpperCase()
        if (isRandom) headerAvatar.classList.add("random")
    }
    if (headerStatus && isRandom) {
        headerStatus.innerText = "Connected"
    }

    // Mark as read
    localStorage.setItem(`last_read_${convoId}`, new Date().toISOString())

    const { data, error } = await client
        .from("messages")
        .select("*")
        .eq("conversation_id", convoId)
        .not('cleared_by', 'cs', '{"' + username + '"}')
        .order("created_at", { ascending: true })

    if (error) return

    list.innerHTML = ""

    // 1. Mark unread messages as seen_at = now()
    const unreadIds = data.filter(m => m.sender !== username && !m.seen_at).map(m => m.id)
    if (unreadIds.length > 0) {
        client.from("messages")
            .update({ seen_at: new Date().toISOString() })
            .in("id", unreadIds)
            .then(() => console.log("Vanish Mode: Marked", unreadIds.length, "as seen"))
    }

    data.forEach(msg => {
        const isMe = msg.sender === username
        const wrapper = document.createElement("div")
        wrapper.id = `msg-${msg.id}`
        wrapper.className = `message-wrapper ${isMe ? "me" : "other"}`

        const replyLabelText = isMe ? "you replied to their story" : "replied to your story"
        const replyLabel = msg.is_story_reply ? `<div class="story-reply-label">${replyLabelText}</div>` : ''
        const seenIndicator = (msg.seen_at && !msg.is_story_reply) ? '<span class="seen-label">Seen</span>' : ''

        wrapper.innerHTML = `
            ${replyLabel}
            <div class="message-bubble">${msg.message}</div>
            ${isMe ? seenIndicator : ''}
        `
        list.appendChild(wrapper)
    })

    list.scrollTop = list.scrollHeight
}

async function exitChat() {
    const convoId = localStorage.getItem("chat_id");

    // UI Fade Out
    document.querySelectorAll(".message-wrapper").forEach(msg => {
        msg.style.transition = "opacity 0.25s ease-out";
        msg.style.opacity = "0";
    });

    // Wait for animation, then navigate
    setTimeout(async () => {
        if (convoId) {
            await clearChatMessages(convoId);
        }
        window.location.href = "inbox.html";
    }, 280);
}

async function sendChat() {
    const input = document.getElementById("chatInput")
    const message = input.value.trim()
    const convoId = localStorage.getItem("chat_id")
    if (!message || !convoId) return

    input.value = ""

    const { error } = await client
        .from("messages")
        .insert({
            conversation_id: convoId,
            sender: username,
            message: message,
            seen_at: null
        })

    if (error) {
        console.error("Error sending message:", error)
        return
    }

    loadMessages()
}

// Initialize based on page
document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("inbox.html")) {
        loadChats()
    } else if (window.location.pathname.includes("chat.html")) {
        const cid = localStorage.getItem("chat_id")
        currentChatId = cid;

        // Vanishing Mode: Cleanup on enter and exit
        clearChatMessages(cid)

        // ONLY clear when explicitly leaving the page
        window.addEventListener("beforeunload", () => clearChatMessages(cid))
        window.addEventListener("pagehide", () => clearChatMessages(cid))
        // REMOVED visibilitychange as it's too aggressive and causes "vanishing while in chat"

        // Typing Timeout global variables
        let sendTypingTimeout = null;
        let receiveTypingTimeout = null;
        const msgChannel = client.channel(`public:messages:convo:${cid}`);

        const inputEl = document.getElementById("chatInput");
        if (inputEl) {
            inputEl.addEventListener("input", () => {
                if (inputEl.value.trim().length > 0) {
                    msgChannel.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { user: username }
                    });

                    clearTimeout(sendTypingTimeout);
                    sendTypingTimeout = setTimeout(() => {
                        msgChannel.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { user: username }
                        });
                    }, 500);
                }
            });
        }

        // Real-time: Handle typing, deletes, and updates
        msgChannel
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload?.user && payload.payload.user !== username) {
                    const status = document.getElementById("chatTypingStatus");
                    if (status) {
                        status.innerText = "typing...";
                        clearTimeout(receiveTypingTimeout);
                        receiveTypingTimeout = setTimeout(() => {
                            status.innerText = "";
                        }, 2500);
                    }
                }
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${cid}`
            }, (payload) => {
                console.log("Realtime: Message deleted", payload.old.id)
                const el = document.getElementById(`msg-${payload.old.id}`)
                if (el) el.classList.add("fade-out-instant")
                setTimeout(() => { if (el) el.remove() }, 400)
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${cid}`
            }, (payload) => {
                // Refresh list if a message is marked seen_at
                if (payload.new.seen_at && !payload.old.seen_at) {
                    loadMessages()
                }
            })
            .subscribe()

        // Listen for conversation deletion (Partner Skip/Exit)
        client
            .channel(`public:conversations:id:${cid}`)
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'conversations',
                filter: `id=eq.${cid}`
            }, (payload) => {
                if (localStorage.getItem("misto_random") === "true") {
                    showToast("Partner left. Finding someone else...")
                    setTimeout(() => {
                        localStorage.setItem("auto_match", "true")
                        window.location.href = "random.html"
                    }, 1500)
                }
            })
            .subscribe()

        loadMessages()
        setInterval(loadMessages, 3000)
    } else {
        // Main page unread polling
        checkUnreadGlobal()
        setInterval(checkUnreadGlobal, 5000)
    }

    // Global Notification Listener
    initGlobalNotificationListener();

    // Enable Audio on First Interaction (Standard mobile requirement)
    document.body.addEventListener("click", () => {
        messageSound.play().then(() => {
            messageSound.pause();
            messageSound.currentTime = 0;
            console.log("Audio unlocked");
        }).catch(err => console.log("Audio unlock failed:", err));
    }, { once: true });
})

// ================== NOTIFICATIONS ==================

function playMessageSound() {
    const isNotificationsOn = localStorage.getItem("notifications") === "true";
    if (!isNotificationsOn) return;

    const now = Date.now();
    if (now - lastSoundTime > 1000) { // 1s debounce
        messageSound.currentTime = 0;
        messageSound.play()
            .then(() => console.log("Notification sound played successfully"))
            .catch(err => console.error("Notification sound play failed:", err));
        lastSoundTime = now;
    }
}

function playTestSound() {
    console.log("Testing notification sound...");
    messageSound.currentTime = 0;
    messageSound.play()
        .then(() => showToast("Sound playing!"))
        .catch(err => {
            console.error("Test sound failed:", err);
            showToast("Click anywhere first to enable audio!");
        });
}

function initGlobalNotificationListener() {
    console.log("Initializing Global Notification Listener...");

    // 1. Normal Messages Listener
    client
        .channel('public:messages:global')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, (payload) => {
            const msg = payload.new;
            const isMyMessage = msg.sender === username;
            const isNotificationsOn = localStorage.getItem("notifications") === "true";
            const isInSameChat = (msg.conversation_id == currentChatId);

            if (!isMyMessage && isNotificationsOn && !isInSameChat) {
                console.log("New normal message notification!");
                playMessageSound();
                const dot = document.getElementById("unreadDot");
                if (dot) dot.classList.remove("hidden");
            }
        })
        .subscribe((status) => console.log("Global Messages Subscription:", status));

    // 2. Random Messages Listener
    client
        .channel('public:random_messages:global')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'random_messages'
        }, (payload) => {
            const msg = payload.new;
            const isMyMessage = msg.sender === username;
            const isNotificationsOn = localStorage.getItem("notifications") === "true";

            // For random messages, currentChatId is compared against session_id
            const currentSessionId = localStorage.getItem("misto_random_session");
            const isInSameChat = (msg.session_id === currentSessionId && window.location.pathname.includes("randomChat.html"));

            if (!isMyMessage && isNotificationsOn && !isInSameChat) {
                console.log("New random message notification!");
                playMessageSound();
            }
        })
        .subscribe((status) => console.log("Global Random Messages Subscription:", status));
}

// INIT
loadStories()