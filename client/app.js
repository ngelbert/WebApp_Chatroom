// Empties a DOM element from a given HTMLelement.
function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

function createListDOM (room) {
    var node = document.createElement('li');
    var img = document.createElement('img');
    img.src = room.image;
    node.appendChild(img);
    var a = document.createElement('a');
    a.href = "#/chat/" + room.id;
    a.appendChild(document.createTextNode(room.name));
    node.appendChild(a);
    return node;
}

function createMessageBoxDOM (message, mine) {
    var node = document.createElement('div');
    node.classList.add("message");
    if (mine) {
        node.classList.add("my-message");
    }
    var uname = document.createElement('span');
    uname.classList.add("message-user");
    uname.appendChild(document.createTextNode(message.username));
    var text = document.createElement('span');
    text.classList.add("message-text");
    text.appendChild(document.createTextNode(message.text));
    node.appendChild(uname);
    node.appendChild(text);
    return node;
}

var profile = {};

var Service = {
    origin: window.location.origin,
    getAllRooms: () => {
        return new Promise((resolve, reject) => {
            var x = new XMLHttpRequest();
            x.open("GET", Service.origin + "/chat");
            x.onload = () => {
                if (x.status === 200) {
                    if (x.response && (x.responseURL === Service.origin + "/chat")) {
                        resolve(JSON.parse(x.response));
                    }
                }
                else {
                    reject(new Error(x.responseText));
                }
            }
            x.onerror = () => reject(new Error(x.responseText));
            x.send();
        })
    },
    addRoom: (data) => {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', Service.origin + "/chat");
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (xhr.response) {
                        resolve(JSON.parse(xhr.response));
                    }
                }
                else {
                    reject(new Error(xhr.responseText));
                }
            }
            xhr.onerror = () => reject(new Error(xhr.responseText));
            xhr.send(JSON.stringify(data));
        })
    },
    getLastConversation: (roomId, before) => {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', Service.origin + "/chat/" + roomId + "/messages?before=" + before);
            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (xhr.response) {
                        resolve(JSON.parse(xhr.response));
                    }
                    else {
                        reject(new Error(xhr.responseText));
                    }
                }
                else {
                    reject(new Error(xhr.responseText));
                }
            }
            xhr.onerror = () => reject(new Error(xhr.responseText));
            xhr.send();
        })
    },
    getProfile: () => {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', Service.origin + '/profile');
            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (xhr.response) {
                        resolve(JSON.parse(xhr.response));
                    }
                    else {
                        reject(new Error(xhr.responseText));
                    }
                }
                else {
                    reject(new Error(xhr.responseText));
                }
            }
            xhr.onerror = () => reject(new Error(xhr.responseText));
            xhr.send();
        })
    }
}

function* makeConversationLoader (room) {
    var lastTime = room.time;
    var empty = false;
    var roomId = room.id;
    while (!empty) {
        room.canLoadConversation = false;
        yield new Promise((resolve, reject) => {
            Service.getLastConversation(roomId, lastTime).then((result) => {
                if (!result) {
                    resolve(result);
                    empty = true;
                }
                else {
                    lastTime = result.timestamp;
                    roomId = result.room_id;
                    room.canLoadConversation = true;
                    room.addConversation(result);
                    resolve(result);
                }
            }).catch((error) => {
                empty = true;
                console.log(error);
                resolve(null);
            })
        }); 
    }
}

class Room {
    constructor(id, name, image = "assets/everyone-icon.png", messages = []) {
        this.id = id;
        this.name = name;
        this.image = image;
        this.messages = messages;
        this.getLastConversation = makeConversationLoader(this);
        this.canLoadConversation = true;
        this.time = Date.now();
    }
    addMessage(username, text) {
        if (text.trim() === "") {
            return;
        }
        var message = {
            username: username,
            text: text
        }
        this.messages.push(message);
        if (this.onNewMessage) {
            this.onNewMessage(message);
        }
    }
    addConversation(conversation) {
        this.messages = conversation.messages.concat(this.messages);
        if (this.onFetchConversation) {
            this.onFetchConversation(conversation);
        }
    }
}

class Lobby {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        if(this.rooms[roomId]) {
            return this.rooms[roomId];
        }
        else {
            return null;
        }
    }

    addRoom(id, name, image, messages) {
        this.rooms[id] = new Room(id, name, image, messages);
        if (this.onNewRoom) {
            this.onNewRoom(this.rooms[id]);
        }
    }
}

class LobbyView {
    constructor(lobby) {
        this.elem = createDOM(
            `<div class="content">
                <ul class="room-list">
                    <li>
                        <img src="/assets/everyone-icon.png">
                        <a href="#/chat">Everyone in CPEN 322</a>
                    </li>
                    <li>
                        <img src="/assets/bibimbap.jpg">
                        <a href="#/chat">Food Group</a>
                    </li>
                    <li>
                        <img src="/assets/minecraft.jpg">
                        <a href="#/chat">Game Group</a>
                    </li>
                </ul>
                <div class="page-control">
                    <input type="text" placeholder="Room Title">
                    <button>Create Room</button>
                </div>
            </div>`);
        this.lobby = lobby;
        this.listElem = this.elem.querySelector("ul.room-list");
        this.inputElem = this.elem.querySelector("input");
        this.buttonElem = this.elem.querySelector('button');
        this.redrawList();
        this.buttonElem.addEventListener('click', () => {
            var roomname = this.inputElem.value;
            Service.addRoom({name: roomname, image: '/assets/everyone-icon.png'}).then((result) => {
                this.lobby.addRoom(result._id, result.name, result.image);
            },
            (error) => {
                console.log(error);
            });
            this.inputElem.value = '';
        });
        this.lobby.onNewRoom = (room) => {
            var item = createListDOM(room);
            this.listElem.appendChild(item);
        };
    }
    redrawList(){
        emptyDOM(this.listElem);
        for (var id in this.lobby.rooms) {
            var node = createListDOM(this.lobby.rooms[id]);
            this.listElem.appendChild(node);
        }
    }
}

class ChatView {
    constructor(socket) {
        this.elem = createDOM(
            `<div class="content">
                <h4 class="room-name">test</h4>
                <div class="message-list">
                    <div class="message">
                        <span class="message-user">Alice:</span>
                        <span class="message-text">Hi guys, how was the assignment?</span>
                    </div>
                    <div class="my-message">
                        <span class="message-user">Elbert:</span>
                        <span class="message-text">It was not that bad.</span>
                    </div>
                </div>
                <div class="page-control">
                    <textarea placeholder="Type Something..."></textarea>
                    <button>Send</button>
                </div>
            </div>`
        );
        this.socket = socket;
        this.room = null;
        this.titleElem = this.elem.querySelector('h4');
        this.chatElem = this.elem.querySelector('div.message-list');
        this.inputElem = this.elem.querySelector('textarea');
        this.buttonElem = this.elem.querySelector('button');
        this.buttonElem.addEventListener('click', () => {
            this.sendMessage();
        });
        this.inputElem.addEventListener('keyup', (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                this.sendMessage();
            }
        })
        this.chatElem.addEventListener('wheel', (event) => {
            if (event.deltaY < 0 && this.room.canLoadConversation && this.chatElem.scrollTop <= 0) {
                this.room.getLastConversation.next(); 
            }
        })
    }

    sendMessage() {
        this.room.addMessage(profile.username, this.inputElem.value);
        this.socket.send(JSON.stringify({roomId: this.room.id, username: profile.username, text: this.inputElem.value}));
        this.inputElem.value = '';
    }

    setRoom(room) {
        this.room = room;
        emptyDOM(this.titleElem);
        this.titleElem.appendChild(document.createTextNode(this.room.name));
        emptyDOM(this.chatElem);
        for (var i = 0; i < this.room.messages.length; i++) {
            if (this.room.messages[i].username === profile.username) {
                this.chatElem.appendChild(createMessageBoxDOM(this.room.messages[i], true));
            }
            else {
                this.chatElem.appendChild(createMessageBoxDOM(this.room.messages[i], false));
            }
        }
        this.room.onNewMessage = (message) => {
            if (message.username === profile.username) {
                this.chatElem.appendChild(createMessageBoxDOM(message, true));
            }
            else {
                this.chatElem.appendChild(createMessageBoxDOM(message, false));
            }
        }
        this.room.onFetchConversation = (conversation) => {
            var messages = conversation.messages;
            var prevscroll = this.chatElem.scrollTop;
            for (let i = messages.length - 1; i >= 0; i--) {
                this.chatElem.insertBefore(createMessageBoxDOM(messages[i], messages[i].username === profile.username), this.chatElem.firstChild);
            }
            this.chatElem.scrollTop = this.chatElem.scrollTop - prevscroll;
        }
    }
}

class ProfileView {
    constructor() {
        this.elem = createDOM(
            `<div class="content">
                <div class="profile-form">
                    <div class="form-field">
                        <label>Username</label>
                        <input type="text">
                    </div>
                    <div class="form-field">
                        <label>Password</label>
                        <input type="password">
                    </div>
                    <div class="form-field">
                        <label>Avatar Image</label>
                        <input type="file">
                    </div>
                </div>
                <div class="page-control">
                    <button>Save</button>
                </div>
            </div>`
        );
    }
}

function main() {
    var lobby = new Lobby();
    var socket = new WebSocket('ws://localhost:8000');
    var lobbyView = new LobbyView(lobby);
    var chatView = new ChatView(socket);
    var profileView = new ProfileView();
    var elem = document.getElementById('page-view');
    Service.getProfile().then((result) => {
        profile = result;
    }).catch((error) => console.log(error));
    function renderRoute() {
        if (window.location.hash === "#/") {
            emptyDOM(elem);
            elem.appendChild(lobbyView.elem);
        }
        else if (window.location.hash.startsWith("#/chat")) {
            var id  = window.location.hash.split('/')[2];
            emptyDOM(elem);
            elem.appendChild(chatView.elem);
            if (lobby.getRoom(id)) {
                chatView.setRoom(lobby.getRoom(id));
            }
        }
        else if (window.location.hash === "#/profile") {
            emptyDOM(elem);
            elem.appendChild(profileView.elem);
        }
        else {
            console.log("No page with that path.");
        }
    }
    function refreshLobby() {
        let prom = Service.getAllRooms();
        prom.then((result) => {
            for (let i = 0; i < result.length; i++) {
                if (lobby.rooms[result[i]._id]) {
                    lobby.rooms[result[i]._id].name = result[i].name;
                    lobby.rooms[result[i]._id].image = result[i].image;
                }
                else {
                    lobby.addRoom(result[i]._id, result[i].name, result[i].image, result[i].messages);
                }
            }
        }, 
        (error) => {
            console.log(error);
        })
    }
    renderRoute();
    refreshLobby();
    setInterval(refreshLobby, 15000);
    window.addEventListener('popstate', renderRoute);
    socket.addEventListener('message', (message) => {
        var data = JSON.parse(message.data)
        let room = lobby.getRoom(data.roomId);
        if (room) {
            room.addMessage(data.username, data.text);
        }
        else {
            console.log("no room with the id");
        }
    })
    cpen322.export(arguments.callee, {renderRoute, refreshLobby, lobbyView, chatView, profileView, lobby, socket});
}

window.addEventListener('load', main);



