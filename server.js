
var fs = require('fs');
var mime = require('mime');
var urlparse = require('url').parse;

var tail = fs.readFileSync('tail.html');
var root = './pub';

var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var stamp = (new Date()).getTime();


/*
 * File Watch
 *
 */

var watchers = {};
function watchFile(path, onchange) {
  var watcher = watchers[path];
  if (watcher) {
    watcher.extend();
    return watcher;
  }

  console.log("watch\tstart\t" + path);
  watcher = fs.watch(path, {persistent: false}, watchf);
  function watchf(ev) {
    if (!self) return;
    if (ev == 'change') {
      console.log("watch\tchange\t" + path);
      onchange();
      self.extend();
    } else if (ev == 'rename' && fs.existsSync(path)) {
      console.log("watch\tchange2\t" + path);
      // this usually follows or followed by 'change' event
      watcher.close();
      watcher = fs.watch(path, {persistent: false}, watchf);
    }
  }

  var terminator = setTimeout(function() { self.close(); }, 35000);

  var self = {
    path: path,
    extend: function() {
      clearTimeout(terminator);
      terminator = setTimeout(function() { self.close(); }, 35000);
    },
    close: function() {
      console.log("watch\tend\t" + path);
      if (terminator)
        clearTimeout(terminator);
      watcher.close();
      delete(watchers[path]);
      self = null;
    }
  };

  watchers[path] = self;

  return self;
}
function isWatched(path) {
  if (watchers[path]) return true;
  return false;
}
function extendWatcher(path) {
  var watcher = watchers[path];
  if (watcher) watcher.extend();
}
function unwatchFile(path) {
  var watcher = watchers[path];
  if (watcher) watcher.close();
}


/*
 * HTTP server
 *
 */

function resp404(resp) {
  resp.writeHead(404);
  resp.end("<h1>404 Not Found</h1>");
}

function handler(req, resp) {
  req.url = urlparse(req.url);
  if (req.url.pathname === '/favicon.ico')
    return;
  
  var filename = root + req.url.pathname;
  if (! fs.existsSync(filename))
    return resp404(resp);

  var stat = fs.statSync(filename);
  if (stat.isFile()) {
    resp.setHeader("Content-Type", mime.lookup(filename));

    fs.readFile(filename, function(err, data) {
      if (err) resp404(resp)
      else {
        if (filename.match(/\.html?$/))
          data += tail;
        resp.writeHead(200);
        resp.end(data);
      }
    });
  } else {
    if (isWatched(filename))
      unwatchFile(filename);

    resp404(resp);
  }
}

app.listen(8080);


/*
 * socket.io
 *
 */

io.set('log level', 0);

var signals = {};
function signalClient(name, msg, params) {
  if (signals[name]) clearTimeout(signals[name]);
  signals[name] = setTimeout(function () {
    console.log("send\t" + msg + "\t" + name);
    io.sockets.in(name).emit(msg, params);
    delete(signals[name]);
  }, 300);
}

io.sockets.on('connection', function(sock) {
  var files = [];

  console.log('client\tconn');
  sock.emit('hello', { stamp: stamp });

  sock.on('join', function (data) {
    console.log('client\tjoin\t' + data.pathname);

    var file = root + data.pathname;
    if (isWatched(file) || fs.existsSync(file)) {
      files.push(file);
      watchFile(file, function() { signalClient(file, 'reload', {}); });
      sock.join(file);
    }
  });

  sock.on('alive', function () {
    var i;
    for (i = 0; i < files.length; i ++)
      extendWatcher(files[i]);
  });
});

