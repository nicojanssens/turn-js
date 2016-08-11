'use strict'

var Attributes = require('./lib/attributes')
var ChannelData = require('./lib/channel_data')
var Packet = require('./lib/packet')
var transports = require('stun-js').transports
var TurnClient = require('./lib/turn_client')

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
