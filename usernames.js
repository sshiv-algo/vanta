const adjectives = [
    "Silent",
    "Neon",
    "Shadow",
    "Lunar",
    "Crimson",
    "Golden",
    "Electric",
    "Frozen"
]

const animals = [
    "Fox",
    "Tiger",
    "Wolf",
    "Falcon",
    "Panda",
    "Panther",
    "Dragon",
    "Comet"
]

function generateUsername() {

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]

    return adj + animal

}