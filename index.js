const WS = require('ws');
const BdsdClient = require('bdsd.client');

const wss = new WS.Server({ port: 49198 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    try {
      let obj = JSON.parse(message);
      if (obj.method === "set value") {
        let id = parseInt(obj.id);
        let value = obj.value;
        bdsd.setValue(id, value);
      };
    } catch(e) {
      console.log(e.message);
    }
  });

  ws.on("close", function close() {
    console.log("Connection closed")
  });
  ws.send(JSON.stringify({"id": 49198, "method": "greeting", "value": "friend"}));
});





wss.on('error', console.log);

const bdsd = BdsdClient();

bdsd.on('value', data => {
  let msg = JSON.stringify({method: "cast value", id: data.id, value: data.value.toString()});
  wss.clients.forEach(function (conn) {
    console.log('send text', msg);
    conn.send(msg);
  })
});

bdsd.on('error', console.log);
