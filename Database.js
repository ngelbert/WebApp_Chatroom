const { MongoClient, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v4.2+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/4.2/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
            db.collection("chatrooms").find().toArray().then((result) => {
                resolve(result);	
            }).catch((error => console.log(error)))
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
            try {
                obj = ObjectId(room_id);
                resolve(db.collection("chatrooms").findOne({_id: obj}));
            } catch (error) {
                resolve(db.collection("chatrooms").findOne({_id: room_id}));
            }
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
            if(!room) {
                reject(new Error("Room undefined"));
            }
            else if (!room.name) {
                reject(new Error("Name undefined"));
            }
            else {
                db.collection("chatrooms").insertOne(room).then((result) => {
                    resolve(db.collection("chatrooms").findOne({_id: result.insertedId}));
                }).catch((error) => console.log(error)); 
            }
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
            if (!room_id) {
                reject(new Error("No room id"));
            }
            else {
                var time = before ? before : Date.now();
                db.collection("conversations").find({room_id: room_id}).toArray().then((result) => {
                    var maxTime = 0;
                    var message = null;
                    for(let i = 0; i < result.length; i++) {
                        if (maxTime < result[i].timestamp && result[i].timestamp < time) {
                            maxTime = result[i].timestamp;
                            message = result[i];
                        }
                    }
                    resolve(message);
                }).catch((error) => console.log(error));
            }
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
            if (!conversation.room_id || !conversation.timestamp || !conversation.messages) {
                reject(new Error("Conversation properties not complete"));
            }
            else {
                db.collection("conversations").insertOne(conversation).then((result) => {
                    resolve(db.collection("conversations").findOne({_id: result.insertedId}));
                }).catch((error) => console.log(error));
            }
		})
	)
}

Database.prototype.getUser = function(username) {
    return this.connected.then(db => 
        new Promise((resolve, reject) => {
            if (!username) {
                reject(new Error("username is null"));
            }
            else {
                resolve(db.collection("users").findOne({username: username}));
            }
        })
    )
}

module.exports = Database;