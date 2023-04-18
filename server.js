const path = require('path');
const fs = require('fs');
const ws = require('ws');
const express = require('express');
const cpen322 = require('./cpen322-tester.js');
const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js')
const crypto = require('crypto');

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

function isCorrectPassword(password, saltedHash) {
	var salt = saltedHash.substring(0,20);
	var hash = crypto.createHash('sha256').update(password + salt).digest('base64');
	return hash === saltedHash.substring(20, saltedHash.length);
}

const broker = new ws.Server({port: 8000});
const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');
const db = new Database("mongodb://localhost:27017", 'cpen322-messenger');
const sessionManager = new SessionManager();
const messageBlockSize = 10;

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug


app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

var messages = {};

db.getRooms().then((result) => {
	for (let i = 0; i < result.length; i++) {
		messages[result[i]._id] = [];
	}
})

app.use(function (req, res, next) {
	if (req.path.slice(-1) == '/' && req.path.length > 1) {
	  let query = req.url.slice(req.path.length)
	  res.redirect(301, req.path.slice(0, -1) + query)
	} else {
	  next()
	}
  })

app.use("/login", express.static(clientApp + "/login.html", { extensions: ["html"]}) )

app.route('/login').post((req, res) => {
	db.getUser(req.body.username).then((result) => {
		if (result) {
			if (isCorrectPassword(req.body.password, result.password)) {
				sessionManager.createSession(res, req.body.username);
				res.redirect('/');
			}
			else {
				res.redirect('/login');
			}
		}
		else {
			res.redirect('/login');
		}
	}).catch((error) => console.log(error));
})

app.route('/logout').get((req, res) => {
	sessionManager.deleteSession(req);
	res.redirect('/login');
})

app.route('/chat/:room_id/messages').get(sessionManager.middleware, (req, res) => {
	db.getLastConversation(req.params.room_id, req.query.before).then((result) => {
		res.send(result);
	}).catch((error) => console.log(error))
});

app.route('/chat/:room_id').get(sessionManager.middleware, (req, res) => {
	db.getRoom(req.params.room_id).then((result) => {
		if (result) 
			res.send(result);
		else 
			res.status(404).send("Room " + req.params.room_id + " was not found");
	}).catch((error) => console.log(error))
});

app.route('/chat').get(sessionManager.middleware, (req, res) => {
	var data = [];
	db.getRooms().then((result) => {
		for (let i = 0; i < result.length; i++) {
			data.push({
				_id: result[i]._id,
				name: result[i]["name"],
				image: result[i]["image"],
				messages: messages[result[i]._id]
			});
		}
		res.send(data);
	}).catch((error) => console.log(error));
}).post(sessionManager.middleware, (req, res) => {
	data = req.body;
	if (!data["name"]) {
		res.status(400).send("Error: Name Not Found");
	}
	else {
		db.addRoom(req.body).then((result) => {
			messages[result._id] = [];
			res.status(200).send(JSON.stringify(result));
		})	
	}
});

app.route('/profile').get(sessionManager.middleware, (req, res) => {
	res.send(JSON.stringify({username: req.username}));
});
app.use('/app.js', sessionManager.middleware, express.static(clientApp + '/app.js'));
app.use('/index.html', sessionManager.middleware, express.static(clientApp + '/index.html', {extensions: ['html']}));
app.use('/index', sessionManager.middleware);

// serve static files (client-side)
app.use('/', sessionManager.middleware, express.static(clientApp, { extensions: ['html'] }));

app.use((err, req, res, next) => {
	if (err instanceof SessionManager.Error) {
		let acchead = req.get("Accept");
		if (acchead === "application/json") {
			res.status(401).send("application/json sessionerror");
		}
		else {
			res.redirect('/login');
		}
	}
	else {
		res.status(500).send("Error.");
	}
})

broker.on('connection', (cs, request) => {
	var cookie = request.headers.cookie;
	if (cookie) {
		var parsedcookie = cookie.split(';')
            .map(v => v.split('='))
            .reduce((acc, v) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
            return acc;
            }, {});
		if (sessionManager.getUsername(parsedcookie["cpen322-session"])) {
			cs.on('message', (message) => {
				var parsed = JSON.parse(message);
				parsed.username = sessionManager.getUsername(parsedcookie["cpen322-session"]);
				broker.clients.forEach((client) => {
					if (client !== cs && client.readyState === ws.OPEN) {
						client.send(JSON.stringify(parsed));
					}
				})
				messages[parsed.roomId].push(parsed);
				if (messages[parsed.roomId].length === messageBlockSize) {
					var conversation = {
						room_id: parsed.roomId,
						timestamp: Date.now(),
						messages: messages[parsed.roomId]
					};
					db.addConversation(conversation).then((result) => {
						messages[parsed.roomId] = [];
					}).catch((error) => console.log(error));
				}
			})
		} 
		else {
			cs.close();
		}
	}
	else {
		cs.close();
	}
})

cpen322.connect('http://52.43.220.29/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, messages, broker, db, messageBlockSize, sessionManager, isCorrectPassword});



