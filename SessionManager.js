const crypto = require('crypto');
const byteLength = 64;

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		/* To be implemented */
        const token = crypto.randomBytes(byteLength).toString('hex');
        var obj = {
            username: username,
            created: Date.now(),
            expiry: Date.now() + maxAge,
        };
        sessions[token] = obj;
        response.cookie("cpen322-session", token, {maxAge: maxAge});
        setTimeout(() => {
            delete sessions[token];
        }, maxAge);
	};

	this.deleteSession = (request) => {
		/* To be implemented */
        delete request.username;
        delete sessions[request.session];
        delete request.session;
	};

	this.middleware = (request, response, next) => {
		/* To be implemented */
        var cookie = request.get("Cookie");
        if (cookie) {
            var parsedcookie = cookie.split(';')
            .map(v => v.split('='))
            .reduce((acc, v) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
            return acc;
            }, {});
            if (sessions[parsedcookie["cpen322-session"]]) {
                request.username = sessions[parsedcookie["cpen322-session"]].username;
                request.session = parsedcookie["cpen322-session"];
                next();
            }
            else {
                next(new SessionError());
            }
        }
        else {
            next(new SessionError());
        }
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;