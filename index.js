'use strict'

var Attributes = require('./src/attributes')
var ChannelData = require('./src/channel_data')
var Packet = require('./src/packet')
var transports = require('stun-js').transports
var TurnClient = require('./src/turn_client')

module.exports = function createClient (address, port, user, pwd, transport) {
  return new TurnClient(address, port, user, pwd, transport)
}

// TURN components
module.exports.Attributes = Attributes
module.exports.ChannelData = ChannelData
module.exports.Packet = Packet
module.exports.TurnClient = TurnClient
// STUN transports
module.exports.transports = transports
