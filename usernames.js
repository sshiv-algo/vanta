const adjectives = [
    "Silent", "Neon", "Shadow", "Lunar", "Crimson",
    "Golden", "Electric", "Frozen", "Cosmic", "Phantom",
    "Velvet", "Blazing", "Mystic", "Hollow", "Savage",
    "Serene", "Rustic", "Molten", "Drifting", "Ancient",
    "Rogue", "Stellar", "Vivid", "Burning", "Icy",
    "Radiant", "Obscure", "Wild", "Hidden", "Glowing",
    "Swift", "Dark", "Bright", "Cloudy", "Stormy",
    "Scarlet", "Azure", "Jade", "Silver", "Amber",
    "Onyx", "Ruby", "Feral", "Primal", "Spectral",
    "Invisible", "Lucid", "Shattered", "Infinite", "Lost"
]

const animals = [
    "Fox", "Tiger", "Wolf", "Falcon", "Panda",
    "Panther", "Dragon", "Comet", "Raven", "Lynx",
    "Cobra", "Hawk", "Viper", "Eagle", "Jaguar",
    "Shark", "Bear", "Owl", "Phoenix", "Mantis",
    "Bison", "Coyote", "Dingo", "Ferret", "Gecko",
    "Hyena", "Iguana", "Jackal", "Kestrel", "Lemur",
    "Mamba", "Narwhal", "Osprey", "Piranha", "Quetzal",
    "Raptor", "Scorpion", "Talon", "Urial", "Vulture",
    "Weasel", "Xerus", "Yak", "Zebra", "Otter",
    "Puffin", "Badger", "Wombat", "Okapi", "Dhole"
]

function generateUsername() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]
    return adj + animal
}