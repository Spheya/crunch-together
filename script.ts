import { io, Socket } from 'socket.io-client'
import { type VideoState } from './shared'

const roomSectionTemplate = `
    <div class='crunch-together-room-link'>
        <input class='crunch-together-room-url' readonly>
        <button><span>Copy</span></button>
    </div>
`

let socket : Socket | undefined
let roomUrl : string = ''
let synced : boolean = false;

function connect(room?: string) {
    socket = io('http://localhost:3000')
    socket.on('connect', () => {
        if(room) {
            socket?.emit('join-room', room)
        } else {
            socket?.emit('create-room', window.location.href)
        }
    })

    socket.on('disconnect', disconnect)

    socket.on('room-joined', (link: string) => {
        roomUrl = link
        let header = document.querySelector('.current-media-header')
        if(header) createRoomInfo(header)
        if(room) {
            socket?.emit('get-state')
        } else {
            let videoPlayer = document.querySelector('.bitmovinplayer-container video')
            synced = true;
            if(videoPlayer && videoPlayer instanceof HTMLVideoElement) onStateUpdate(videoPlayer)
        }
    })

    socket.on('state-update', (state: VideoState) => { 
        syncVideoPlayer(state)
        console.log("synced!")
    })

    let buttonContent = document.querySelector('.crunch-together-button span')
    if(buttonContent) buttonContent.textContent = 'Leave Room'
}

function disconnect() {
    socket?.close()
    socket = undefined
    roomUrl = ''

    let roomSection = document.querySelector('.crunch-together-room-info')
    if(roomSection) roomSection.remove()

    let buttonContent = document.querySelector('.crunch-together-button span')
    if(buttonContent) buttonContent.textContent = 'Create Room'
}

function createRoomInfo(header : Element) {
    let roomSection = document.createElement('div')
    roomSection.className = 'crunch-together-room-info'
    roomSection.innerHTML = roomSectionTemplate
    let url = roomSection.querySelector('.crunch-together-room-url')
    if(url instanceof HTMLInputElement)
        url.value = roomUrl
    let button = roomSection.querySelector('.crunch-together-room-link button')
    if(button instanceof HTMLButtonElement) {
        button.onclick = () => {
            if(roomUrl !== '') navigator.clipboard.writeText(roomUrl)
        }
    }

    header.after(roomSection)
}

function createButton(header : Element) {
    let button = document.createElement('button')
    button.className = 'crunch-together-button'
    let buttonContent = document.createElement('span')
    buttonContent.textContent = socket ? 'Leave Room' : 'Create Room'
    button.appendChild(buttonContent)
    header.appendChild(button)

    button.onclick = () => {
        if(socket) {
            disconnect()
        } else {
            connect()
        }
    }
}

function onEpisodeLoad() {
    let header = document.querySelector('.current-media-header')
    if(header) { 
        createButton(header)
        if(roomUrl !== '') createRoomInfo(header)
    }
}

function getVideoState(videoPlayer: HTMLVideoElement) : VideoState {
    return { 
        url: window.location.href,
        playing: videoPlayer.currentTime > 0 && !videoPlayer.paused && !videoPlayer.ended && videoPlayer.readyState > 2,
        time: videoPlayer.currentTime,
        rate: videoPlayer.playbackRate
    }
}

function onStateUpdate(videoPlayer: HTMLVideoElement) {
    console.log(`state change detected synced=${synced}`)
    if(synced && socket) { 
        console.log("video player state change")
        socket.emit('state-update', getVideoState(videoPlayer))
    }
}

function syncVideoPlayer(targetState: VideoState) {
    let videoPlayer = document.querySelector('.bitmovinplayer-container video')
    if(videoPlayer && videoPlayer instanceof HTMLVideoElement) {
        synced = false
        videoPlayer.currentTime = targetState.time
        videoPlayer.playbackRate = targetState.rate
        if(targetState.playing) {
            videoPlayer.play()
        } else {
            videoPlayer.pause()
        }
        setTimeout(() => synced = true, 1000)
    }
}

function onVideoPlayerLoad() {
    if(!socket) {
        // Connect if we have a room URL
        let room = new URLSearchParams(window.location.search).get('ctroom')
        if(room) connect(room)
    }

    let videoPlayer = document.querySelector('.bitmovinplayer-container video')
    if(videoPlayer && videoPlayer instanceof HTMLVideoElement) {
        videoPlayer.addEventListener("playing", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
        videoPlayer.addEventListener("pause", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
        videoPlayer.addEventListener("ended", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
        videoPlayer.addEventListener("seeked", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
        videoPlayer.addEventListener("ratechange", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
        videoPlayer.addEventListener("waiting", () => { onStateUpdate(videoPlayer) }, { capture: false, passive: true });
    }
}

// Crunchyroll dynamically loads everything, even when going to a different page.
// so to inject anything, we just need to wait until the elements we care about appear on the page
let observer = new MutationObserver((mutations) => {
    for(let mutation of mutations) {
        for(let node of mutation.addedNodes) {
            if(!(node instanceof Element)) continue;            
            if(node.classList?.contains('erc-watch-episode')) onEpisodeLoad(); // erc-watch-episode contains the episode description
            if(node.classList?.contains('kat:absolute')) onVideoPlayerLoad(); // I don't fully understand why this works, but the video player doesnt exist before this
        }
    }
})
observer.observe(document.body, { childList: true, subtree: true })
