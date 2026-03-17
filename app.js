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

    const { error } = await client
        .from("stories")
        .insert({
            username: username,
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

    await loadStories()
}


// ================== LOAD STORIES ==================

async function loadStories() {

    const now = new Date().toISOString()

    const { data, error } = await client
        .from("stories")
        .select("*")
        .gt("expires_at", now)
        .order("created_at", { ascending: true })

    if (error) {
        console.error(error)
        return
    }

    const container = document.getElementById("stories")
    container.innerHTML = ""

    const viewed = getViewedStories()


    // ================== YOUR STORY ==================

    const yourStories = data.filter(story => story.username === username)
    const yourStoryDiv = document.querySelector(".your-story")

    const yourRingClass = viewed[username] ? "seen" : "unseen"

    if (yourStories.length > 0) {

        yourStoryDiv.innerHTML = `
            <div class="status-circle ${yourRingClass}">${username[0]}</div>
            <div class="status-text">
                <b>Your Story</b>
                <p>${yourStories.length} update(s)</p>
            </div>
        `

        yourStoryDiv.onclick = () => openStorySequence(yourStories, 0)

    } else {

        yourStoryDiv.innerHTML = `
            <div class="status-circle plus">+</div>
            <div class="status-text">
                <b>Your Story</b>
                <p>Tap to add</p>
            </div>
        `

        yourStoryDiv.onclick = openUpload
    }


    // ================== OTHER USERS ==================

    const users = {}

    data.forEach(story => {
        if (story.username === username) return

        if (!users[story.username]) {
            users[story.username] = []
        }

        users[story.username].push(story)
    })

    const unseenUsers = []
    const seenUsers = []

    Object.keys(users).forEach(user => {
        if (viewed[user]) {
            seenUsers.push(user)
        } else {
            unseenUsers.push(user)
        }
    })

    const sortedUsers = [...unseenUsers, ...seenUsers]

    sortedUsers.forEach(user => {

        const ringClass = viewed[user] ? "seen" : "unseen"

        const div = document.createElement("div")
        div.className = "status-item"

        div.innerHTML = `
            <div class="status-circle ${ringClass}">${user[0]}</div>
            <div class="status-text">
                <b>${user}</b>
                <p>View story</p>
            </div>
        `

        div.onclick = () => openStorySequence(users[user], 0)

        container.appendChild(div)
    })
}


// ================== OPEN STORY ==================

function openStory(story) {

    const viewer = document.getElementById("viewer")

    const created = new Date(story.created_at)
    const now = new Date()
    const diff = Math.floor((now - created) / 1000 / 60 / 60)

    const timeText = diff === 0 ? "Just now" : `${diff}h ago`

    document.getElementById("viewerUser").innerHTML =
        `${story.username} • ${timeText}`

    let content = ""

    if (story.media_url) {
        content += `<img src="${story.media_url}" style="max-width:300px;">`
    }

    if (story.text_content) {
        content += `<p>${story.text_content}</p>`
    }

    document.getElementById("viewerText").innerHTML = content

    viewer.classList.remove("hidden")
}


// ================== STORY SEQUENCE ==================

function openStorySequence(stories, index) {

    if (!getViewedStories()[stories[0].username]) {
        markStoryViewed(stories[0].username)
        loadStories()
    }

    const story = stories[index]
    openStory(story)

    const progressContainer = document.getElementById("storyProgress")
    progressContainer.innerHTML = ""

    stories.forEach((_, i) => {

        const bar = document.createElement("div")
        bar.className = "progress-bar"

        const fill = document.createElement("div")
        fill.className = "progress-fill"

        if (i < index) fill.style.width = "100%"

        bar.appendChild(fill)
        progressContainer.appendChild(bar)
    })

    const currentFill = progressContainer.children[index].firstChild

    setTimeout(() => {
        currentFill.style.width = "100%"
    }, 50)

    setTimeout(() => {
        if (index + 1 < stories.length) {
            openStorySequence(stories, index + 1)
        }
    }, 4000)
}


// ================== CLOSE VIEWER ==================

function closeViewer() {
    document.getElementById("viewer").classList.add("hidden")
}


// ================== AUTO REFRESH ==================

setInterval(loadStories, 60000)


// ================== LOGOUT ==================

window.logout = function () {
    localStorage.removeItem("vanta_username")
    localStorage.removeItem("vanta_gender")
    location.reload()
}


// ================== INIT ==================

loadStories()


// ================== UI ==================

function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active")
    document.getElementById("overlay").classList.toggle("active")
}

function openUpload() {
    document.getElementById("uploadBox").classList.toggle("hidden")
}