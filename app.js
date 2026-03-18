// ================== GLOBAL ==================
let currentViewers = []
let isViewerOpen = false
let currentStories = []
let currentIndex = 0
let storyTimer = null
let isLongPress = false
let touchTimer = null

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

    const modal = document.getElementById("genderModal")
    const gender = localStorage.getItem("vanta_gender")

    if (gender && gender !== "null" && gender !== "undefined") {
        modal.style.display = "none"
    } else {
        modal.style.display = "flex"
    }

    setupViewerControls()
    loadMenuUser()
})

// SET GENDER
window.setGender = function (g) {
    localStorage.setItem("vanta_gender", g)
    document.getElementById("genderModal").style.display = "none"
}


// ================== POST STORY ==================

async function postStory() {

    const text = document.getElementById("storyText").value
    const imageFile = document.getElementById("storyImage").files[0]

    if (!text && !imageFile) {
        alert("Add text or image")
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
            alert("Image upload failed")
            return
        }

        mediaUrl = `${supabaseUrl}/storage/v1/object/public/stories/${fileName}`
    }

    let expires = new Date()
    expires.setHours(expires.getHours() + 24)

    const { error } = await client.from("stories").insert({
        username,
        gender: localStorage.getItem("vanta_gender"),
        text_content: text,
        media_url: mediaUrl,
        created_at: new Date(),
        expires_at: expires
    })

    if (error) {
        console.error(error)
        alert("Error posting story")
        return
    }

    document.getElementById("storyText").value = ""
    document.getElementById("storyImage").value = ""

    loadStories()
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

        yourDiv.innerHTML = `
        <div style="position:relative;">
            <div class="status-circle">${username[0]}</div>

            <!-- ➕ BUTTON -->
            <div class="add-btn">+</div>
        </div>

        <div class="status-text">
            <b>Your Story</b>
            <p>${yourStories.length} update(s)</p>
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
        text_content: "🚀 What's New:\n\n✨ Swipe up on your story to see viewers\n✨ Add text captions to your image stories\n✨ Sleek new UI design and animations\n\nEnjoy the new Misto! 🥷",
        media_url: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        viewers: []
    }]

    const unseen = Object.keys(users).filter(u => !viewed[u])
    const seen = Object.keys(users).filter(u => viewed[u])

    // Ensure Misto Official is always at the front of its respective category
    const sortOfficialFirst = (arr) => arr.sort((a, b) => {
        if (a === "Misto Official") return -1
        if (b === "Misto Official") return 1
        return 0
    })

    const sorted = [
        ...sortOfficialFirst(unseen),
        ...sortOfficialFirst(seen)
    ]

    sorted.forEach(user => {

        const ring = viewed[user] ? "seen" : "unseen"

        const badge = user === "Misto Official" 
            ? `<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align: -2px; margin-left: 4px;"><path fill="#6366f1" d="M22.5 12.5l-2.1 2.3.5 3.1-3 .9-1.6 2.6-2.9-1.2L11 22.5l-2.4-2.3-2.9 1.2-1.6-2.6-3-.9.5-3.1L-.5 12.5l2.1-2.3-.5-3.1 3-.9 1.6-2.6 2.9 1.2L11 2.5l2.4 2.3 2.9-1.2 1.6 2.6 3 .9-.5 3.1z"/><path fill="#fff" d="M9.8 16.8l-4.2-4.2 1.4-1.4 2.8 2.8 7.1-7.1 1.4 1.4z"/></svg>` 
            : ""

        const div = document.createElement("div")
        div.className = "status-item"

        div.innerHTML = `
            <div class="status-circle ${ring}">${user[0]}</div>
            <div class="status-text">
                <b>${user}${badge}</b>
                <p>View story</p>
            </div>
        `

        div.onclick = () => openStorySequence(users[user], 0)

        container.appendChild(div)
    })
}


// ================== STORY VIEW ==================

function openStory(story) {
    console.log("Story object:", story)
    const viewer = document.getElementById("viewer")

    const isOwner = story.username === username

    const timeText = formatTime(story.created_at)

    const badge = story.username === "Misto Official" 
        ? `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: -3px; margin-left: 4px; margin-right: 2px;"><path fill="#6366f1" d="M22.5 12.5l-2.1 2.3.5 3.1-3 .9-1.6 2.6-2.9-1.2L11 22.5l-2.4-2.3-2.9 1.2-1.6-2.6-3-.9.5-3.1L-.5 12.5l2.1-2.3-.5-3.1 3-.9 1.6-2.6 2.9 1.2L11 2.5l2.4 2.3 2.9-1.2 1.6 2.6 3 .9-.5 3.1z"/><path fill="#fff" d="M9.8 16.8l-4.2-4.2 1.4-1.4 2.8 2.8 7.1-7.1 1.4 1.4z"/></svg>` 
        : ""

    document.getElementById("viewerUser").innerHTML =
        `${story.username}${badge} • ${timeText}`

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
            deleteStory(story.id)
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
        alert("Delete error")
        return
    }

    if (!data || data.length === 0) {
        alert("No row deleted — mismatch issue")
        return
    }

    alert("Deleted successfully")

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
        if (endY - startY > 50) { // Swipe down
            closeViewerList()
        }
    })
}

function openViewerList() {

    isViewerOpen = true
    pauseStory()

    const sheet = document.getElementById("viewerList")
    const list = document.getElementById("viewerListContent")

    list.innerHTML = ""

    const filtered = currentViewers
        .map(v => typeof v === "string"
            ? { username: v, time: new Date().toISOString() }
            : v
        )
        .filter(v => v.username !== username)

    if (filtered.length === 0) {
        list.innerHTML = "<p>No viewers yet</p>"
    } else {

        filtered.forEach(v => {

            const div = document.createElement("div")
            div.className = "viewer-item"

            div.innerHTML = `
                <div class="viewer-avatar">${v.username[0]}</div>
                <div>
                    <b>${v.username}</b><br>
                    <small>${formatTime(v.time)}</small>
                </div>
            `

            list.appendChild(div)
        })
    }

    sheet.classList.add("active")
}

function closeViewerList() {
    isViewerOpen = false
    document.getElementById("viewerList").classList.remove("active")
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


// INIT
loadStories()