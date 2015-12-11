var TurnSession = require('./src/turn_session')

function init(address, port, user, pwd) {
  return new TurnSession(address, port, user, pwd)
}

exports.init = init
