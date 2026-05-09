import { Server } from 'socket.io'
import {createServer} from 'http'
import express from 'express'
import hostUrl from './url.json' with { type: 'json' }

type VideoState = {
    url: string,
    playing: boolean,
    time: number
    rate: number
};

class Room {
    creationTime : number
    url : string
    playing : boolean
    playRate : number
    time : number
    lastUpdateTime : number

    constructor(url : string) {
        this.creationTime = Date.now()
        this.url = url
        this.playing = false
        this.playRate = 1
        this.time = 0
        this.lastUpdateTime = Date.now()
    }

    update(state: VideoState) {
        this.url = state.url
        this.playing = state.playing
        this.playRate = state.rate
        this.time = state.time
        this.lastUpdateTime = Date.now()
    }

    getState() : VideoState {
        let delta = Date.now() - this.lastUpdateTime
        return {
            url: this.url,
            playing: this.playing,
            rate: this.playRate,
            time: this.time + (delta * this.playRate)
        }
    }
}

let rooms: Map<string, Room> = new Map()

function generateRoomId() : string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let result = ''
    for(let i = 0; i < 5; i++) result += characters[Math.floor(Math.random() * characters.length)]
    while(result in rooms) result += characters[Math.floor(Math.random() * characters.length)]
    return result
}

let app = express()
let httpServer = createServer(app)

app.use((req, res) => {
    let roomId = req.url.slice(1)
    let room = rooms.get(roomId)
    if(room) {
        let url = new URL(room.url)
        url.searchParams.set('ctroom', roomId)
        res.redirect(302, room.url.toString())
    }else{
        res.status(404).send('Not found')
    }
})
httpServer.listen(80)

let io = new Server(httpServer, {
    cors: { origin: '*' }
})

io.on('connection', socket => {
    socket.on('create-room', (url: string) => {
        let roomUrl = new URL(url)
        let id = generateRoomId()
        roomUrl.searchParams.set('ctroom', id)
        rooms.set(id, new Room(roomUrl.toString()))
        socket.data.roomId = id;
        socket.join(id)
        socket.emit('room-joined', hostUrl.url + id)
    })

    socket.on('join-room', (id: string) => {
        let room = rooms.get(id)
        if(room) {
            socket.data.roomId = id
            socket.join(id)
            socket.emit('room-joined', hostUrl.url + id)
        }
    })

    socket.on('state-update', (state: VideoState) => {
        let room = rooms.get(socket.data.roomId);
        if(room) {
            let url = new URL(state.url);
            url.searchParams.set('ctroom', socket.data.roomId)
            state.url = url.toString()
            room.update(state)
            socket.to(socket.data.roomId).emit('state-update', room.getState())
        }
    })

    socket.on('get-state', () => { 
        let room = rooms.get(socket.data.roomId)
        if(room) socket.emit('state-update', room.getState())
    })
})