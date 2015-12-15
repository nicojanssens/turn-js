var inherits = require('util').inherits
var merge = require('merge')
var Q = require('q')
var winston = require('winston')

var Attributes = require('./attributes')
var ChannelData = require('./channel_data')
var Packet = require('./packet')
var StunSocket = require('libstun').StunSocket

// Constructor
var TurnSocket = function (stunHost, stunPort, username, password) {
  StunSocket.call(this, stunHost, stunPort)
  this.username = username
  this.password = password
}

// Inherit from StunSocket
inherits(TurnSocket, StunSocket)

var pjson = require('../package.json')
var defaultSoftwareTag = pjson.name + ' v' + pjson.version
TurnSocket.DEFAULTS = {
  software: defaultSoftwareTag,
  lifetime: 3600,
  dontFragment: true
}

/** TurnSocket opertions */

// Execute allocation
TurnSocket.prototype.allocateP = function () {
  var self = this
  // send an allocate request without credentials
  return this.sendAllocateP()
    .then(function (allocateReply) {
      var errorCode = allocateReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        // check of this is a 401 Unauthorized error
        if (errorCode.code === 401) {
          // throw error if username and password are undefined
          if (self.username === undefined || self.password === undefined) {
            throw new Error('[libturn] allocate error: unauthorized access, while username and/or password are undefined')
          }
          // create a new allocate request
          var args = {}
          self.nonce = args.nonce = allocateReply.getAttribute(Attributes.NONCE).value
          self.realm = args.realm = allocateReply.getAttribute(Attributes.REALM).value
          args.user = self.username
          args.pwd = self.password
          return self.sendAllocateP(args)
        } else {
          // throw an error if error code !== 401
          throw new Error('[libturn] allocate error: ' + errorCode.reason)
        }
      } else {
        // process allocate reply in next call
        return Q.fcall(function () {
          return allocateReply
        })
      }
    })
    // let's process that allocate reply
    .then(function (allocateReply) {
      var errorCode = allocateReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('[libturn] allocate error: ' + errorCode.reason)
      }
      // store mapped address
      var mappedAddressAttr = allocateReply.getAttribute(Attributes.XOR_MAPPED_ADDRESS)
      if (!mappedAddressAttr) {
        mappedAddressAttr = allocateReply.getAttribute(Attributes.MAPPED_ADDRESS)
      }
      self.mappedAddress = {
        address: mappedAddressAttr.address,
        port: mappedAddressAttr.port
      }
      // store relayed address
      var relayedAddressAttr = allocateReply.getAttribute(Attributes.XOR_RELAYED_ADDRESS)
      self.relayedAddress = {
        address: relayedAddressAttr.address,
        port: relayedAddressAttr.port
      }
      // create and return result
      var result = {
        mappedAddress: self.mappedAddress,
        relayedAddress: self.relayedAddress
      }
      return Q.fcall(function () {
        return result
      })
    })
}

TurnSocket.prototype.allocate = function (onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libturn] allocate callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.allocateP()
    .then(function (result) {
      onSuccess(result)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Create permission to send data to a peer address
TurnSocket.prototype.createPermissionP = function (address, lifetime) {
  if (address === undefined) {
    var error = '[libturn] create permission requires specified peer address'
    winston.error(error)
    throw new Error(error)
  }
  // send a create permission request
  var args = {}
  args.nonce = this.nonce
  args.realm = this.realm
  args.user = this.username
  args.pwd = this.password
  args.address = address
  if (lifetime !== undefined) {
    args.lifetime = lifetime
  }
  return this.sendCreatePermissionP(args)
    .then(function (createPermissionReply) {
      var errorCode = createPermissionReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('[libturn] create permission error ' + errorCode.reason)
      }
    // done
    })
}

TurnSocket.prototype.createPermission = function (address, lifetime, onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var undefinedCbError = '[libturn] create permission callback handlers are undefined'
    winston.error(undefinedCbError)
    throw new Error(undefinedCbError)
  }
  if (address === undefined) {
    var undefinedAddressError = '[libturn] create permission requires specified peer address'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  this.createPermissionP(address, lifetime)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Create channel
TurnSocket.prototype.bindChannelP = function (address, port, channel, lifetime) {
  if (address === undefined || port === undefined) {
    var undefinedAddressError = '[libturn] channel bind requires specified peer address and port'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  // create channel id
  var min = 0x4000
  var max = 0x7FFF
  if (channel !== undefined) {
    if (channel < min || channel > max) {
      var incorrectChannelError = '[libturn] channel id must be >= 0x4000 and =< 0x7FFF'
      winston.error(incorrectChannelError)
      throw new Error(incorrectChannelError)
    }
  } else {
    channel = Math.floor(Math.random() * (max - min + 1)) + min
  }
  // send a channel bind request
  var args = {}
  args.nonce = this.nonce
  args.realm = this.realm
  args.user = this.username
  args.pwd = this.password
  args.address = address
  args.channel = channel
  args.port = port
  if (lifetime !== undefined) {
    args.lifetime = lifetime
  }
  return this.sendChannelBindP(args)
    .then(function (channelBindReply) {
      var errorCode = channelBindReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('[libturn] bind error: ' + errorCode.reason)
      }
      return Q.fcall(function () {
        return channel
      })
    })
}

TurnSocket.prototype.bindChannel = function (address, port, channel, lifetime, onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var undefinedCbError = '[libturn] bind callback handlers are undefined'
    winston.error(undefinedCbError)
    throw new Error(undefinedCbError)
  }
  if (address === undefined || port === undefined) {
    var undefinedAddressError = '[libturn] channel bind requires specified peer address and port'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  this.bindChannelP(address, port, channel, lifetime)
    .then(function (duration) {
      onSuccess(duration)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Execute refresh
TurnSocket.prototype.refreshP = function (lifetime) {
  var self = this
  // send refresh request
  var args = {}
  args.nonce = this.nonce
  args.realm = this.realm
  args.user = this.username
  args.pwd = this.password
  if (lifetime !== undefined) {
    args.lifetime = lifetime
  }
  return this.sendRefreshP(args)
    .then(function (refreshReply) {
      var errorCode = refreshReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        // check of this is a 438 Stale nonce error
        if (errorCode.code === 438) {
          // create a new refresh request
          var args = {}
          self.nonce = args.nonce = refreshReply.getAttribute(Attributes.NONCE).value
          self.realm = args.realm = refreshReply.getAttribute(Attributes.REALM).value
          args.user = self.username
          args.pwd = self.password
          return self.sendRefreshP(args)
        } else {
          // throw an error if error code !== 438
          throw new Error('[libturn] refresh error: ' + refreshReply.getAttribute(Attributes.ERROR_CODE).reason)
        }
      } else {
        // process refresh reply in next call
        return Q.fcall(function () {
          return refreshReply
        })
      }
    })
    .then(function (refreshReply) {
      var errorCode = refreshReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('[libturn] refresh error: ' + errorCode.reason)
      }
      // otherwise retrieve and return lifetime
      var lifetime = refreshReply.getAttribute(Attributes.LIFETIME).duration
      return Q.fcall(function () {
        return lifetime
      })
    })
}

TurnSocket.prototype.refresh = function (lifetime, onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libturn] refresh callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.refreshP(lifetime)
    .then(function (duration) {
      onSuccess(duration)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Close this socket
TurnSocket.prototype.closeP = function () {
  var self = this
  return this.refreshP(0)
    .then(function () {
      TurnSocket.super_.prototype.close.call(self)
    })
}

TurnSocket.prototype.close = function (onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libturn] close callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.closeP()
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

/** Message transmission */

// Send TURN allocation
TurnSocket.prototype.sendAllocateP = function (args) {
  winston.debug('[libturn] send allocate (using promises)')
  var message = composeAllocateRequest(args)
  return this.sendStunRequestP(message)
}

TurnSocket.prototype.sendAllocate = function (args, onSuccess, onFailure) {
  winston.debug('[libstun] send allocate')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send allocate callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendAllocateP(args)
    .then(function (reply) {
      onSuccess(reply)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send TURN create permission
TurnSocket.prototype.sendCreatePermissionP = function (args) {
  winston.debug('[libturn] send create permission (using promises)')
  var message = composeCreatePermissionRequest(args)
  return this.sendStunRequestP(message)
}

TurnSocket.prototype.sendCreatePermission = function (args, onSuccess, onFailure) {
  winston.debug('[libturn] send create permission')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send create permission callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendCreatePermissionP(args)
    .then(function (reply) {
      onSuccess(reply)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send TURN channel bind
TurnSocket.prototype.sendChannelBindP = function (args) {
  winston.debug('[libturn] send channel bind (using promises)')
  var message = composeChannelBindRequest(args)
  return this.sendStunRequestP(message)
}

TurnSocket.prototype.sendChannelBind = function (args, onSuccess, onFailure) {
  winston.debug('[libturn] send channel bind')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send channel bind callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendChannelBindP(args)
    .then(function (reply) {
      onSuccess(reply)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send TURN refresh
TurnSocket.prototype.sendRefreshP = function (args) {
  winston.debug('[libturn] send refresh (using promises)')
  var message = composeRefreshRequest(args)
  return this.sendStunRequestP(message)
}

TurnSocket.prototype.sendRefresh = function (args, onSuccess, onFailure) {
  winston.debug('[libturn] send refresh')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send refresh callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendRefreshP(args)
    .then(function (reply) {
      onSuccess(reply)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send data via relay/turn server
TurnSocket.prototype.sendDataP = function (args) {
  var message = composeSendIndication(args)
  return this.sendStunIndicationP(message)
}

TurnSocket.prototype.sendData = function (args, onSuccess, onFailure) {
  winston.debug('[libturn] send data')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send data callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendDataP(args)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send channel data via relay/turn server
TurnSocket.prototype.sendChannelDataP = function (channel, data) {
  var message = composeChannelDataMessage(channel, data)
  return this.sendStunIndicationP(message)
}

TurnSocket.prototype.sendChannelData = function (channel, data, onSuccess, onFailure) {
  winston.debug('[libturn] send channel data')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = '[libstun] send channel data callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.sendChannelDataP(channel, data)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

/** Message arrival */

// Incoming STUN indication
TurnSocket.prototype.onIncomingStunIndication = function (stunPacket, rinfo) {
  if (stunPacket.method === Packet.METHOD.DATA) {
    var data = stunPacket.getAttribute(Attributes.DATA).data
    var xorPeerAddress = stunPacket.getAttribute(Attributes.XOR_PEER_ADDRESS)
    this.emit('data', data, {
      address: xorPeerAddress.address,
      port: xorPeerAddress.port
    })
  } else {
    TurnSocket.super_.prototype.onIncomingStunIndication.call(this, stunPacket, rinfo)
  }
}

// Incoming message that is different from regular STUN packets
TurnSocket.prototype.onOtherIncomingMessage = function (msg, rinfo) {
  var channelData = ChannelData.decode(msg)
  // if this is a channel-data message
  if (channelData) {
    var data = channelData.data
    this.emit('data', data, {
      address: rinfo.address,
      port: rinfo.port
    })
  } else {
    TurnSocket.super_.prototype.onOtherIncomingMessage.call(this, msg, info)
  }
}

/** Message composition */

function composeAllocateRequest (args) {
  var margs = merge(Object.create(TurnSocket.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, margs)
  attrs.add(new Attributes.Software(margs.software))
  attrs.add(new Attributes.Lifetime(margs.lifetime))
  attrs.add(new Attributes.RequestedTransport())
  if (margs.dontFragment) {
    attrs.add(new Attributes.DontFragment())
  }
  // create allocate packet
  var packet = new Packet(Packet.METHOD.ALLOCATE, Packet.TYPE.REQUEST, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function composeCreatePermissionRequest (args) {
  // check args
  if (args === undefined) {
    var undefinedArgsError = '[libturn] invalid create-permission attributes: args = undefined'
    winston.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = '[libturn] invalid create-permission attributes: args.address = undefined'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, args)
  attrs.add(new Attributes.XORPeerAddress(args.address))
  // create createPermission packet
  var packet = new Packet(Packet.METHOD.CREATEPERMISSION, Packet.TYPE.REQUEST, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function composeSendIndication (args) {
  // check args
  if (args === undefined) {
    var undefinedArgsError = '[libturn] invalid send attributes: args = undefined'
    winston.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = '[libturn] invalid send attributes: args.address = undefined'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  if (args.port === undefined) {
    var undefinedPortError = '[libturn] invalid send attributes: args.port = undefined'
    winston.error(undefinedPortError)
    throw new Error(undefinedPortError)
  }
  if (args.data === undefined) {
    var undefinedDataError = '[libturn] invalid send attributes: args.data = undefined'
    winston.error(undefinedDataError)
    throw new Error(undefinedDataError)
  }
  var margs = merge(Object.create(TurnSocket.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  attrs.add(new Attributes.XORPeerAddress(margs.address, margs.port))
  if (margs.dontFragment) {
    attrs.add(new Attributes.DontFragment())
  }
  attrs.add(new Attributes.Data(margs.data))
  // create send packet
  var packet = new Packet(Packet.METHOD.SEND, Packet.TYPE.INDICATION, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function composeChannelBindRequest (args) {
  // check args
  if (args === undefined) {
    var undefinedArgsError = '[libturn] invalid channel-bind attributes: args = undefined'
    winston.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.channel === undefined) {
    var undefinedChannelError = '[libturn] invalid channel-bind attributes: args.channel = undefined'
    winston.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = '[libturn] invalid channel-bind attributes: args.address = undefined'
    winston.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  if (args.port === undefined) {
    var undefinedPortError = '[libturn] invalid channel-bind attributes: args.port = undefined'
    winston.error(undefinedPortError)
    throw new Error(undefinedPortError)
  }
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, args)
  attrs.add(new Attributes.ChannelNumber(args.channel))
  attrs.add(new Attributes.XORPeerAddress(args.address, args.port))
  if (args.lifetime !== undefined) {
    attrs.add(new Attributes.Lifetime(args.lifetime))
  }
  // create channelBind packet
  var packet = new Packet(Packet.METHOD.CHANNELBIND, Packet.TYPE.REQUEST, attrs)
  // create channelBind packet
  var message = packet.encode()
  return message
}

function composeChannelDataMessage (channel, data) {
  if (data === undefined) {
    var undefinedDataError = '[libturn] invalid channel-data attribute: data = undefined'
    winston.error(undefinedDataError)
    throw new Error(undefinedDataError)
  }
  if (channel === undefined) {
    var undefinedChannelError = '[libturn] invalid channel-data attribute: channel = undefined'
    winston.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  // create channel-data packet
  var channelData = new ChannelData(channel, data)
  // encode packet
  var message = channelData.encode()
  return message
}

function composeRefreshRequest (args) {
  var margs = merge(Object.create(TurnSocket.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, margs)
  attrs.add(new Attributes.Software(margs.software))
  attrs.add(new Attributes.Lifetime(margs.lifetime))
  // create refresh packet
  var packet = new Packet(Packet.METHOD.REFRESH, Packet.TYPE.REQUEST, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function _addSecurityAttributes (attrs, args) {
  if (args.user) {
    attrs.add(new Attributes.Username(args.user))
  }
  if (args.nonce) {
    attrs.add(new Attributes.Nonce(args.nonce))
  }
  if (args.realm) {
    attrs.add(new Attributes.Realm(args.realm))
  }
  if (args.user && args.pwd) {
    attrs.add(new Attributes.MessageIntegrity({
      username: args.user,
      password: args.pwd,
      realm: args.realm
    }))
  }
}

module.exports = TurnSocket
