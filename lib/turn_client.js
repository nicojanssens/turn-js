'use strict'

var inherits = require('util').inherits
var merge = require('merge')
var Q = require('q')
var winston = require('winston-debug')
var winstonWrapper = require('winston-meta-wrapper')

var Attributes = require('./attributes')
var ChannelData = require('./channel_data')
var Packet = require('./packet')
var StunClient = require('stun-js').StunClient

var _log = winstonWrapper(winston)
_log.addMeta({
  module: 'turn:client'
})

// Constructor
var TurnClient = function (host, port, username, password, transport) {
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'turn:client'
  })
  // init
  StunClient.call(this, host, port, transport)
  this.username = username
  this.password = password
  // register channel_data decoder
  this._decoders.push({
    decoder: ChannelData.decode,
    listener: this.dispatchChannelDataPacket.bind(this)
  })
}

// Inherit from StunClient
inherits(TurnClient, StunClient)

var pjson = require('../package.json')
var defaultSoftwareTag = pjson.name + ' v' + pjson.version

TurnClient.CHANNEL_BINDING_LIFETIME = 600
TurnClient.DEFAULT_ALLOCATION_LIFETIME = 600
TurnClient.CREATE_PERMISSION_LIFETIME = 300
TurnClient.DEFAULTS = {
  software: defaultSoftwareTag,
  lifetime: TurnClient.DEFAULT_ALLOCATION_LIFETIME,
  dontFragment: false
}

/** TurnClient opertions */

// Execute allocation
TurnClient.prototype.allocateP = function () {
  var self = this
  // send an allocate request without credentials
  return this.sendAllocateP()
    .then(function (allocateReply) {
      var errorCode = allocateReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        // check of this is a 401 Unauthorized or a 438 Stale Nonce error
        if ([401, 438].indexOf(errorCode.code) !== -1) {
          // throw error if username and password are undefined
          if (self.username === undefined || self.password === undefined) {
            throw new Error('allocate error: unauthorized access, while username and/or password are undefined')
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
          self._log.error('allocate error: ' + errorCode.reason)
          self._log.error('allocate response: ' + JSON.stringify(allocateReply))
          throw new Error('allocate error: ' + errorCode.reason)
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
        throw new Error('allocate error: ' + errorCode.reason)
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
      // retrieve lifetime attr, if present
      var lifetimeAttr = allocateReply.getAttribute(Attributes.LIFETIME)
      // create and return result
      var result = {
        mappedAddress: self.mappedAddress,
        relayedAddress: self.relayedAddress
      }
      if (lifetimeAttr) {
        result.lifetime = lifetimeAttr.duration
      }

      return Q.fcall(function () {
        return result
      })
    })
}

TurnClient.prototype.allocate = function (onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'allocate callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
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
TurnClient.prototype.createPermissionP = function (address) {
  if (address === undefined) {
    var errorMsg = 'create permission requires specified peer address'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // send a create permission request
  var args = {}
  args.nonce = this.nonce
  args.realm = this.realm
  args.user = this.username
  args.pwd = this.password
  args.address = address
  return this.sendCreatePermissionP(args)
    .then(function (createPermissionReply) {
      var errorCode = createPermissionReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('create permission error ' + errorCode.reason)
      }
    // done
    })
}

TurnClient.prototype.createPermission = function (address, onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var undefinedCbError = 'create permission callback handlers are undefined'
    this._log.error(undefinedCbError)
    throw new Error(undefinedCbError)
  }
  if (address === undefined) {
    var undefinedAddressError = 'create permission requires specified peer address'
    this._log.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  this.createPermissionP(address)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Create channel
TurnClient.prototype.bindChannelP = function (address, port, channel) {
  if (address === undefined || port === undefined) {
    var undefinedAddressError = 'channel bind requires specified peer address and port'
    this._log.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  // create channel id
  var min = 0x4000
  var max = 0x7FFF
  if (channel !== undefined) {
    if (channel < min || channel > max) {
      var incorrectChannelError = 'channel id must be >= 0x4000 and =< 0x7FFF'
      this._log.error(incorrectChannelError)
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
  return this.sendChannelBindP(args)
    .then(function (channelBindReply) {
      var errorCode = channelBindReply.getAttribute(Attributes.ERROR_CODE)
      // check if the reply includes an error code attr
      if (errorCode) {
        throw new Error('bind error: ' + errorCode.reason)
      }
      return Q.fcall(function () {
        return channel
      })
    })
}

TurnClient.prototype.bindChannel = function (address, port, channel, onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var undefinedCbError = 'bind callback handlers are undefined'
    this._log.error(undefinedCbError)
    throw new Error(undefinedCbError)
  }
  if (address === undefined || port === undefined) {
    var undefinedAddressError = 'channel bind requires specified peer address and port'
    this._log.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  this.bindChannelP(address, port, channel)
    .then(function (duration) {
      onSuccess(duration)
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Execute refresh
TurnClient.prototype.refreshP = function (lifetime) {
  if (lifetime === undefined) {
    var undefinedLifetimeError = 'lifetime is undefined'
    this._log.error(undefinedLifetimeError)
    throw new Error(undefinedLifetimeError)
  }
  var self = this
  // send refresh request
  var args = {}
  args.nonce = this.nonce
  args.realm = this.realm
  args.user = this.username
  args.pwd = this.password
  args.lifetime = lifetime
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
          throw new Error('refresh error: ' + refreshReply.getAttribute(Attributes.ERROR_CODE).reason)
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
        throw new Error('refresh error: ' + errorCode.reason)
      }
      // otherwise retrieve and return lifetime
      var lifetime = refreshReply.getAttribute(Attributes.LIFETIME).duration
      return Q.fcall(function () {
        return lifetime
      })
    })
}

TurnClient.prototype.refresh = function (lifetime, onSuccess, onFailure) {
  if (lifetime === undefined) {
    var undefinedLifetimeError = 'lifetime is undefined'
    this._log.error(undefinedLifetimeError)
    throw new Error(undefinedLifetimeError)
  }
  if (onSuccess === undefined || onFailure === undefined) {
    var undefinedCbError = 'refresh callback handlers are undefined'
    this._log.error(undefinedCbError)
    throw new Error(undefinedCbError)
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
TurnClient.prototype.closeP = function () {
  var self = this
  return this.refreshP(0)
    .then(function () {
      return TurnClient.super_.prototype.closeP.call(self)
    })
}

TurnClient.prototype.close = function (onSuccess, onFailure) {
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'close callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  var self = this
  this.closeP()
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      self._log.error('closing socket failed: ' + error.message)
      onFailure(errorMsg)
    })
}

/** Message transmission */

// Send TURN allocation
TurnClient.prototype.sendAllocateP = function (args) {
  this._log.debug('send allocate (using promises)')
  var message = composeAllocateRequest(args)
  return this.sendStunRequestP(message)
}

TurnClient.prototype.sendAllocate = function (args, onSuccess, onFailure) {
  this._log.debug('send allocate')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send allocate callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
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
TurnClient.prototype.sendCreatePermissionP = function (args) {
  this._log.debug('send create permission (using promises)')
  var message = composeCreatePermissionRequest(args)
  return this.sendStunRequestP(message)
}

TurnClient.prototype.sendCreatePermission = function (args, onSuccess, onFailure) {
  this._log.debug('send create permission')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send create permission callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
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
TurnClient.prototype.sendChannelBindP = function (args) {
  this._log.debug('send channel bind (using promises)')
  var message = composeChannelBindRequest(args)
  return this.sendStunRequestP(message)
}

TurnClient.prototype.sendChannelBind = function (args, onSuccess, onFailure) {
  this._log.debug('send channel bind')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send channel bind callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
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
TurnClient.prototype.sendRefreshP = function (args) {
  this._log.debug('send refresh (using promises)')
  var message = composeRefreshRequest(args)
  return this.sendStunRequestP(message)
}

TurnClient.prototype.sendRefresh = function (args, onSuccess, onFailure) {
  this._log.debug('send refresh')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send refresh callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
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
TurnClient.prototype.sendToRelayP = function (bytes, address, port) {
  var args = {
    address: address,
    port: port,
    bytes: bytes
  }
  var message = composeSendIndication(args)
  return this.sendStunIndicationP(message)
}

TurnClient.prototype.sendToRelay = function (bytes, address, port, onSuccess, onFailure) {
  this._log.debug('send data')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send data callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  this.sendToRelayP(bytes, address, port)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

// Send channel data via relay/turn server
TurnClient.prototype.sendToChannelP = function (bytes, channel) {
  var args = {
    channel: channel,
    bytes: bytes
  }
  var message = composeChannelDataMessage(args)
  return this.sendStunIndicationP(message)
}

TurnClient.prototype.sendToChannel = function (bytes, channel, onSuccess, onFailure) {
  this._log.debug('send channel data')
  if (onSuccess === undefined || onFailure === undefined) {
    var errorMsg = 'send channel data callback handlers are undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  this.sendToChannelP(bytes, channel)
    .then(function () {
      onSuccess()
    })
    .catch(function (error) {
      onFailure(error)
    })
}

/** Message arrival */

// Incoming STUN indication
TurnClient.prototype.onIncomingStunIndication = function (stunPacket, rinfo) {
  if (stunPacket.method === Packet.METHOD.DATA) {
    var dataBytes = stunPacket.getAttribute(Attributes.DATA).bytes
    var xorPeerAddress = stunPacket.getAttribute(Attributes.XOR_PEER_ADDRESS)
    this.emit('relayed-message', dataBytes, {
      address: xorPeerAddress.address,
      port: xorPeerAddress.port
    })
  } else {
    TurnClient.super_.prototype.onIncomingStunIndication.call(this, stunPacket, rinfo)
  }
}

// Dispatch ChannelData packet
TurnClient.prototype.dispatchChannelDataPacket = function (packet, rinfo) {
  this.emit('relayed-message', packet.bytes, rinfo, packet.channel)
}

/** Message composition */

function composeAllocateRequest (args) {
  var margs = merge(Object.create(TurnClient.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, margs)
  attrs.add(new Attributes.Software(margs.software))
  attrs.add(new Attributes.RequestedTransport())
  if (margs.dontFragment !== undefined) {
    attrs.add(new Attributes.DontFragment())
  }
  if (margs.lifetime !== undefined) {
    attrs.add(new Attributes.Lifetime(margs.lifetime))
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
    var undefinedArgsError = 'invalid create-permission attributes: args = undefined'
    _log.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = 'invalid create-permission attributes: args.address = undefined'
    _log.error(undefinedAddressError)
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
    var undefinedArgsError = 'invalid send attributes: args = undefined'
    _log.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = 'invalid send attributes: args.address = undefined'
    _log.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  if (args.port === undefined) {
    var undefinedPortError = 'invalid send attributes: args.port = undefined'
    _log.error(undefinedPortError)
    throw new Error(undefinedPortError)
  }
  if (args.bytes === undefined) {
    var undefinedBytesError = 'invalid send attributes: args.bytes = undefined'
    _log.error(undefinedBytesError)
    throw new Error(undefinedBytesError)
  }
  var margs = merge(Object.create(TurnClient.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  attrs.add(new Attributes.XORPeerAddress(margs.address, margs.port))
  if (margs.dontFragment) {
    attrs.add(new Attributes.DontFragment())
  }
  attrs.add(new Attributes.Data(margs.bytes))
  // create send packet
  var packet = new Packet(Packet.METHOD.SEND, Packet.TYPE.INDICATION, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function composeChannelBindRequest (args) {
  // check args
  if (args === undefined) {
    var undefinedArgsError = 'invalid channel-bind attributes: args = undefined'
    _log.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.channel === undefined) {
    var undefinedChannelError = 'invalid channel-bind attributes: args.channel = undefined'
    _log.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  if (args.address === undefined) {
    var undefinedAddressError = 'invalid channel-bind attributes: args.address = undefined'
    _log.error(undefinedAddressError)
    throw new Error(undefinedAddressError)
  }
  if (args.port === undefined) {
    var undefinedPortError = 'invalid channel-bind attributes: args.port = undefined'
    _log.error(undefinedPortError)
    throw new Error(undefinedPortError)
  }
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, args)
  attrs.add(new Attributes.ChannelNumber(args.channel))
  attrs.add(new Attributes.XORPeerAddress(args.address, args.port))
  // create channelBind packet
  var packet = new Packet(Packet.METHOD.CHANNELBIND, Packet.TYPE.REQUEST, attrs)
  // create channelBind packet
  var message = packet.encode()
  return message
}

function composeChannelDataMessage (args) {
  // check args
  if (args === undefined) {
    var undefinedArgsError = 'invalid channel-bind attributes: args = undefined'
    _log.error(undefinedArgsError)
    throw new Error(undefinedArgsError)
  }
  if (args.bytes === undefined) {
    var undefinedDataError = 'invalid channel-data attribute: bytes = undefined'
    _log.error(undefinedDataError)
    throw new Error(undefinedDataError)
  }
  if (args.channel === undefined) {
    var undefinedChannelError = 'invalid channel-data attribute: channel = undefined'
    _log.error(undefinedChannelError)
    throw new Error(undefinedChannelError)
  }
  // create channel-data packet
  var channelData = new ChannelData(args.channel, args.bytes)
  // encode packet
  var message = channelData.encode()
  return message
}

function composeRefreshRequest (args) {
  var margs = merge(Object.create(TurnClient.DEFAULTS), args)
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

module.exports = TurnClient
