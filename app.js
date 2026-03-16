const supabaseUrl = "https://rgfwsxrjwnzfbxpyywqg.supabase.co"
const supabaseKey = "sb_publishable_Uk36ksZrA4Gimw3ir5JFDQ_U1wcCwtr"

const client = supabase.createClient(supabaseUrl, supabaseKey)

// GET OR CREATE USERNAME

let username = localStorage.getItem("vanta_username")

if (!username) {

    username = generateUsername()

    localStorage.setItem("vanta_username", username)

}

// GET OR CREATE USER GENDER

let gender = localStorage.getItem("vanta_gender")

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("genderModal")

    if (!gender) {
        modal.classList.remove("hidden")
    } else {
        modal.classList.add("hidden")
    }

})

window.setGender = function (g) {

    gender = g

    localStorage.setItem("vanta_gender", g)

    const modal = document.getElementById("genderModal")

    modal.classList.add("hidden")
    modal.style.display = "none"

}

// POST STORIES
async function postStory() {

    const text = document.getElementById("storyText").value
    const imageFile = document.getElementById("storyImage").files[0]

    let mediaUrl = null

    // upload image if exists
    if (imageFile) {

        const fileName = Date.now() + "_" + imageFile.name

        const { data, error } = await client.storage
            .from("stories")
            .upload(fileName, imageFile)

        if (error) {
            console.error(error)
            alert("Image upload failed")
            return
        }

        mediaUrl = supabaseUrl + "/storage/v1/object/public/stories/" + fileName

    }

    let expires = new Date()
    expires.setHours(expires.getHours() + 24)

    const { error } = await client
        .from("stories")
        .insert({
            username: username,
            gender: gender,
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

    loadStories()

}


// LOAD STORIES
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

    const users = {}

    data.forEach(story => {

        if (!users[story.username]) {
            users[story.username] = []
        }

        users[story.username].push(story)

    })

    Object.keys(users).forEach(username => {

        const div = document.createElement("div")
        div.className = "status-item"

        div.innerHTML = `
<div class="status-circle">${username[0]}</div>
<div>${username}</div>
`

        div.onclick = () => openStorySequence(users[username], 0)

        container.appendChild(div)

    })

}


// OPEN STORY VIEWER
function openStory(story) {

    const viewer = document.getElementById("viewer")

    document.getElementById("viewerUser").innerText = story.username

    let content = ""

    if (story.media_url) {
        content += `<img src="${story.media_url}" style="max-width:300px;">`
    }

    content += `<p>${story.text_content}</p>`

    document.getElementById("viewerText").innerHTML = content

    viewer.classList.remove("hidden")

}
//STORY SEQUENCER
function openStorySequence(stories, index) {

    const story = stories[index]

    openStory(story)

    const progressContainer = document.getElementById("storyProgress")
    progressContainer.innerHTML = ""

    stories.forEach((s, i) => {

        const bar = document.createElement("div")
        bar.className = "progress-bar"

        const fill = document.createElement("div")
        fill.className = "progress-fill"

        if (i < index) {
            fill.style.width = "100%"
        }

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

// CLOSE STORY VIEWER
function closeViewer() {

    document.getElementById("viewer").classList.add("hidden")

}



// LOAD STORIES WHEN PAGE OPENS
loadStories()

//LOGOUT
function logout() {

    localStorage.removeItem("vanta_username")
    localStorage.removeItem("vanta_gender")

    location.reload()

}