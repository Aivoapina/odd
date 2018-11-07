"use strict";
var app = require('express')()
var wsapp = require('express-ws')(app)
var hashids = require('hashids')
var hasher = new hashids('salt done drunk')
var schedule = require('./schedule.js'); // schedule from horaro
var path = require('path');

var odd = {}

app.ws('*', (ws, req) => {
	var id = req.params[0].split('/')[1].toString()
	var self = odd[id]
	if(self == undefined) {
		self = new Odd
		odd[id] = self
	}
	self.clients.push(ws)
	ws.on('message', (msg) => {
		msg = JSON.parse(msg)
		self.run(msg.cmd, msg.arg)
	})
})

class Odd {
	constructor() {
		this.started = 0
		this.paused = 0
		this.stopped = 0
		this.clients = []
		this.text = {}
	}
	start() {
		if(this.paused) {
			this.pause()
			return
		}
		this.started = +new Date
		this.paused = 0
		this.stopped = 0
		this.broadcast()
	}
	pause() {
		if(!this.started || this.stopped) return
		if(!this.paused) {
			this.paused = +new Date
		} else {
			this.started += +new Date-this.paused
			this.paused = 0
		}
		this.broadcast()
	}
	stop() {
		if(!this.started) return
		this.stopped = +new Date
		this.paused = 0
		this.broadcast()
	}
	reset() {
		this.started = 0
		this.paused = 0
		this.stopped = 0
		this.broadcast()
	}
	setText(pos, arg) {
		this.text[pos] = arg
		this.broadcast()
	}
	get status() {
		var out = {}
		out.started = this.started
		out.paused = this.paused
		out.stopped = this.stopped
		out.time = this.time
		out.now = +new Date()
		out.text = this.text
		return out
	}
	broadcast() {
		var out = this.status
		this.clients.forEach((client) => {
			if(client.readyState != 1) return
			client.send(JSON.stringify(out))
		})
	}
	run(cmd, arg) {
		switch(cmd) {
			case 'start':
				this.start()
				break
			case 'pause':
				this.pause()
				break
			case 'stop':
				this.stop()
				break
			case 'reset':
				this.reset()
				break
			case 'text':
				this.setText(arg.pos, arg.text)
				break
			default:
				this.broadcast()
				break
		}
	}
}

app.get('/', (req, res, next) => {
	res.redirect(hasher.encode(+new Date))
})

app.get('/schedule', (req, res, next) => {
	res.json(schedule);
})

app.get('*', (req, res, next) => {
	var id = req.params[0].split('/')[1].toString()
	if(id) {
		var self = odd[id]
		if(self == undefined) {
			self = new Odd
			odd[id] = self
		}
	}
	res.sendFile(path.join(__dirname + '/index.html'));
})
app.listen(process.env.ODD_PORT || 4209)
