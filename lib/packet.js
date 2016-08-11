'use strict'

var stun = require('stun-js')

// STUN packet
var Packet = stun.Packet

// RFC 5766 (TURN)
Packet.METHOD.ALLOCATE = 0x003
Packet.METHOD.REFRESH = 0x004
Packet.METHOD.SEND = 0x006
Packet.METHOD.DATA = 0x007
Packet.METHOD.CREATEPERMISSION = 0x008
Packet.METHOD.CHANNELBIND = 0x009

module.exports = Packet
