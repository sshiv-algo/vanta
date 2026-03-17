// ================== GLOBAL ==================

let currentStories = []
let currentIndex = 0
let storyTimer = null
let isLongPress = false
let touchTimer = null


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
            <div class="status-circle">${username[0]}</div>
            <div class="status-text">
                <b>Your Story</b>
                <p>${yourStories.length} update(s)</p>
            </div>
        `
        yourDiv.onclick = () => openStorySequence(yourStories, 0)
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

    const sorted = [
        ...Object.keys(users).filter(u => !viewed[u]),
        ...Object.keys(users).filter(u => viewed[u])
    ]

    sorted.forEach(user => {

        const ring = viewed[user] ? "seen" : "unseen"

        const div = document.createElement("div")
        div.className = "status-item"

        div.innerHTML = `
            <div class="status-circle ${ring}">${user[0]}</div>
            <div class="status-text">
                <b>${user}</b>
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

    const created = new Date(story.created_at)
    const diff = Math.floor((Date.now() - created) / 3600000)

    const timeText = diff === 0 ? "Just now" : `${diff}h ago`

    document.getElementById("viewerUser").innerText =
        `${story.username} • ${timeText}`

    let content = story.media_url
        ? `<img src="${story.media_url}" class="story-media">`
        : `<div class="story-text">${story.text_content}</div>`

    document.getElementById("viewerText").innerHTML = content

    // REMOVE OLD DELETE BTN
    const old = document.querySelector(".delete-btn")
    if (old) old.remove()

    // ADD DELETE IF OWNER
    if (isOwner) {
        const btn = document.createElement("div")
        btn.className = "delete-btn"
        btn.innerText = "🗑"
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

function pauseStory() {
    isLongPress = true
    clearTimeout(storyTimer)
}

function resumeStory() {
    isLongPress = false
    storyTimer = setTimeout(nextStory, 2000)
}


// ================== VIEWER CONTROLS ==================

function setupViewerControls() {

    const viewer = document.getElementById("viewer")

    viewer.addEventListener("touchstart", pauseStory)
    viewer.addEventListener("touchend", resumeStory)

    viewer.addEventListener("mousedown", pauseStory)
    viewer.addEventListener("mouseup", resumeStory)
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
    localStorage.clear()
    location.reload()
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