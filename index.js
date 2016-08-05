"use strict";
var app = require('express')()
var wsapp = require('express-ws')(app)
var hashids = require('hashids')
var hasher = new hashids('salt done drunk')
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

app.get('*', (req, res, next) => {
	var id = req.params[0].split('/')[1].toString()
	if(id) {
		var self = odd[id]
		if(self == undefined) {
			self = new Odd
			odd[id] = self
		}
	}
	res.send(`<!doctype html>
<html>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width, initial-scale=1'>
<title>Overlay Done Drunk</title>
<style>
* { margin: 0; padding: 0; background: transparent; }
body { font-family: sans-serif; }
#timer { font-size: 60px; position: absolute; bottom: 0; right: 0; padding: 0 10px 0 0; font-family: 'Calibri', sans-serif; font-weight: bold; }
#timer span { font-size: 0.7em; }
#controls { width: 200px; height: 200px; position: absolute; top: 50%; left: 50%; margin: -100px -100px; }
#controls button { width: 100%; padding: 10px; text-transform: uppercase; }
.text { white-space: pre; padding: 10px; font-size: 20px; position: absolute; overflow: show; width: 33.333% }
#t { top: 0; left: 33.333%; text-align: center; }
#tl { top: 0; left: 0; }
#tr { top: 0; right: 0; text-align: right; }
#b { bottom: 0; left: 33.333%; text-align: center; }
#bl { bottom: 0; left: 0; }
#br { bottom: 0; right: 0; text-align: right; }
</style>
</head>
<body>
<div id='container'>
<div class='reset' id='timer'></div>
<div class='text' id='tl' contenteditable='true'></div>
<div class='text' id='t' contenteditable='true'></div>
<div class='text' id='tr' contenteditable='true'></div>
<div class='text' id='bl' contenteditable='true'></div>
<div class='text' id='b' contenteditable='true'></div>
<div class='text' id='br' contenteditable='true'></div>
<div id='controls'><button>start</button><button>pause</button><button>stop</button><button>reset</button></div>
</div>
<script src='//cdnjs.cloudflare.com/ajax/libs/reconnecting-websocket/1.0.0/reconnecting-websocket.min.js'></script>
<script>
"use strict";
var odd = { started: 0, paused: 0, stopped: 0, error: 0, text: {} },
	timer = document.getElementById('timer'),
	controls = document.getElementById('controls')
var ttime = function(time) {
  time = Math.abs(time)
  if(time == 0) return ''
  var s = (time / 1000) % 60
  var m = Math.floor((time / (1000 * 60)) % 60)
  if(m < 10) m = '0'+m
  var h = Math.floor((time / (1000 * 60 * 60)) % 24)
  if(h < 10) h = '0'+h
  var newTime = h+':'+m+':'+(s<10?'0':'')+s.toFixed(2)
  newTime = newTime.replace(/^[0:]+/, '')
  newTime = newTime.replace(/^[\.]/, '0.')
  newTime = newTime.replace('.','<span>.')+'</span>'
  return newTime
}
var format = function() {
	if(odd.stopped) return ttime(odd.stopped-odd.started)
	else if(odd.paused) return ttime(odd.paused-odd.started)
	else if(odd.started) return ttime(+new Date()-odd.started+odd.error)
	else return ttime(0)
}
var ws = new ReconnectingWebSocket(window.location.href.replace(/(^http)/, 'ws'))
ws.onopen = function(e) {
	ws.onmessage = function(e) {
		odd = JSON.parse(e.data)
		console.log(odd)
		if(!odd.error) odd.error = odd.now - +new Date
		for(var i of Object.keys(odd.text)) {
			document.getElementById(i).innerHTML = odd.text[i]
		}
		if(odd.stopped) timer.className = 'stop'
		else if(odd.paused) timer.className = 'pause'
		else if(odd.started) timer.className = 'start'
	}
	ws.send(JSON.stringify({ cmd: 'status' }))
}
setInterval(function() {
	timer.innerHTML = format()
}, 10)
for(var i of document.getElementsByTagName('button')) {
	i.addEventListener('click', (e) => {
		var cmd = { cmd: e.target.innerHTML, arg: '' }
		ws.send(JSON.stringify(cmd))
	}, false)
}
for(var i of document.getElementsByClassName('text')) {
	i.addEventListener('blur', (e) => {
		var cmd = { cmd: 'text', arg: { pos: e.target.id, text: e.target.innerHTML }}
		ws.send(JSON.stringify(cmd))
	}, false)
}
</script>
</body>
</html>
`)
	res.end()
})
app.listen(process.env.ODD_PORT || 4209)
