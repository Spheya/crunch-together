import { io, Socket } from 'socket.io-client'
import hostUrl from './url.json' with { type: 'json' }

type VideoState = {
    url: string,
    playing: boolean,
    time: number
    rate: number
};

const roomSectionTemplate = `
    <div class='crunch-together-room-link'>
        <input class='crunch-together-room-url' readonly>
        <button><span>Copy</span></button>
    </div>
`

const events = [ "playing", "pause", "seeked", "ratechange" ]

let videoPlayer : HTMLVideoElement | null = null
let socket : Socket | undefined
let roomUrl : string = ''
let skipEvent : { [index: string]: number } = {}

function connect(room?: string) {
    socket = io(hostUrl.url)
    socket.on('connect', () => {
        console.log('[Crunch Together] connection opened')
        if(room) {
            socket?.emit('join-room', room)
        } else {
            socket?.emit('create-room', window.location.href)
        }
    })

    socket.on('room-joined', (link: string) => {
        roomUrl = link
        let header = document.querySelector('.current-media-header')
        if(header) createRoomInfo(header)
        if(room) {
            socket?.emit('get-state')
        } else {
            if(videoPlayer) onStateUpdate('roomcreation', videoPlayer)
        }
    })

    socket.on('state-update', (state: VideoState) => syncVideoPlayer(state))
    
    socket.on('disconnect', disconnect)

    let buttonContent = document.querySelector('.crunch-together-button span')
    if(buttonContent) buttonContent.textContent = 'Leave Room'
}

function disconnect() {
    console.log('[Crunch Together] connection closed')
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

function isPlaying() {
    if(!videoPlayer) return false
    return videoPlayer.currentTime > 0 && !videoPlayer.paused && !videoPlayer.ended && videoPlayer.readyState > 2
}

function getVideoState(videoPlayer: HTMLVideoElement) : VideoState {
    return { 
        url: window.location.href,
        playing: isPlaying(),
        time: videoPlayer.currentTime,
        rate: videoPlayer.playbackRate
    }
}

async function syncVideoPlayer(targetState: VideoState) {
    if(videoPlayer) {
        console.log('[Crunch Together] synchronizing video player')

        if(!targetState.playing && isPlaying()) {
            skipEvent['pause'] = (skipEvent['pause'] || 0) + 1
            videoPlayer.pause()
        }

        if(videoPlayer.playbackRate != targetState.rate) {
            skipEvent['ratechange'] = (skipEvent['ratechange'] || 0) + 1
            videoPlayer.playbackRate = targetState.rate
        }
        
        if(Math.abs(videoPlayer.currentTime - targetState.time) > 0.5) {
            skipEvent['seeked'] = (skipEvent['seeked'] || 0) + 1
            videoPlayer.currentTime = targetState.time
        }

        if(targetState.playing && !isPlaying()) {
            skipEvent['playing'] = (skipEvent['playing'] || 0) + 1
            await videoPlayer.play().catch(() => {})
        }
    }
}

function onStateUpdate(event: string, videoPlayer: HTMLVideoElement) {
    if(skipEvent[event]) {
        --skipEvent[event]
        return
    }

    if(socket) { 
        console.log(`[Crunch Together] player state update: ${event}`)
        socket.emit('state-update', getVideoState(videoPlayer))
    }
}

function onVideoPlayerLoad() {
    if(videoPlayer) { // Only set up everything if there's actually a video player on the page (in case of a false positive calling this function)
        // Immediately connect if the URL contains a room code
        let room = new URLSearchParams(window.location.search).get('ctroom')
        if(room) connect(room)

        // Create the crunch-together UI
        let header = document.querySelector('.current-media-header')
        if(header) { 
            createButton(header)
            if(roomUrl !== '') createRoomInfo(header)
        }

        // Setup video player events
        for(let event of events) {
            skipEvent[event] = 0;
            videoPlayer.addEventListener(event, () => { if(videoPlayer) onStateUpdate(event, videoPlayer) }, { capture: false, passive: true })
        }
    }
}

// Crunchyroll dynamically loads everything, even when going to a different page.
// so to inject anything, we just need to wait until the elements we care about appear on the page
let observer = new MutationObserver((mutations) => {
    for(let mutation of mutations) {
        for(let node of mutation.addedNodes) {
            if(!(node instanceof Element)) continue

            // there might be a better way to do this, but this is very robust and will set the videoplayer to null when it gets removed
            let hasVideoPlayer = videoPlayer != null;
            videoPlayer = document.querySelector('.bitmovinplayer-container video')
            if(videoPlayer && !hasVideoPlayer) onVideoPlayerLoad()
        }
    }
})
observer.observe(document.body, { childList: true, subtree: true })
