var inherits = require('util').inherits
var merge = require('merge')
var Q = require('q')
var winston = require('winston')

var Attributes = require('./attributes')
var ChannelData = require('./channel_data')
var Packet = require('./packet')
var Session = require('./session')

// Constructor
var TurnSession = function (stunHost, stunPort, username, password) {
  Session.call(this, stunHost, stunPort)
  this.username = username
  this.password = password
}

// Inherit from session
inherits(TurnSession, Session)

TurnSession.DEFAULTS = {
  software: 'libturn v0.1',
  lifetime: 3600,
  dontFragment: true
}

/** Session opertions */

// Execute allocation
TurnSession.prototype.allocateP = function () {
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

TurnSession.prototype.allocate = function (onReady, onError) {
  if (onReady === undefined || onError === undefined) {
    var error = '[libturn] allocate callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.allocateP()
    .then(function (result) {
      onReady(result)
    })
    .catch(function (error) {
      onError(error)
    })
}

// Create permission to send data to a peer address
TurnSession.prototype.createPermissionP = function (address, lifetime) {
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

TurnSession.prototype.createPermission = function (address, lifetime, onReady, onError) {
  if (onReady === undefined || onError === undefined) {
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
      onReady()
    })
    .catch(function (error) {
      onError(error)
    })
}

// Create channel
TurnSession.prototype.bindChannelP = function (address, port, channel, lifetime) {
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

TurnSession.prototype.bindChannel = function (address, port, channel, lifetime, onReady, onError) {
  if (onReady === undefined || onError === undefined) {
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
      onReady(duration)
    })
    .catch(function (error) {
      onError(error)
    })
}

// Execute session refresh
TurnSession.prototype.refreshP = function (lifetime) {
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

TurnSession.prototype.refresh = function (lifetime, onReady, onError) {
  if (onReady === undefined || onError === undefined) {
    var error = '[libturn] refresh callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.refreshP(lifetime)
    .then(function (duration) {
      onReady(duration)
    })
    .catch(function (error) {
      onError(error)
    })
}

// Close this session
TurnSession.prototype.close = function (onReady, onError) {
  if (onReady === undefined || onError === undefined) {
    var error = '[libturn] close callback handlers are undefined'
    winston.error(error)
    throw new Error(error)
  }
  this.closeP()
    .then(function () {
      onReady()
    })
    .catch(function (error) {
      onError(error)
    })
}

TurnSession.prototype.closeP = function () {
  var self = this
  return this.refreshP(0)
    .then(function () {
      self._close()
    })
}

/** Message transmission */

// Send TURN allocation
TurnSession.prototype.sendAllocate = function (args, cb) {
  winston.debug('[libturn] send allocate')
  var message = _composeAllocateMessage(args)
  this._sendStunMessage(message, cb)
}

TurnSession.prototype.sendAllocateP = function (args) {
  winston.debug('[libturn] send allocate')
  var message = _composeAllocateMessage(args)
  return this._sendStunMessageP(message)
}

// Send TURN create permission
TurnSession.prototype.sendCreatePermission = function (args, cb) {
  winston.debug('[libturn] send create permission')
  var message = _composeCreatePermissionMessage(args)
  this._sendStunMessage(message, cb)
}

TurnSession.prototype.sendCreatePermissionP = function (args) {
  winston.debug('[libturn] send create permission')
  var message = _composeCreatePermissionMessage(args)
  return this._sendStunMessageP(message)
}

// Send TURN channel bind
TurnSession.prototype.sendChannelBind = function (args, cb) {
  winston.debug('[libturn] send channel bind')
  var message = _composeChannelBindMessage(args)
  this._sendStunMessage(message, cb)
}

TurnSession.prototype.sendChannelBindP = function (args) {
  winston.debug('[libturn] send channel bind')
  var message = _composeChannelBindMessage(args)
  return this._sendStunMessageP(message)
}

// Send TURN refresh
TurnSession.prototype.sendRefresh = function (args, cb) {
  winston.debug('[libturn] send refresh')
  var message = _composeRefreshMessage(args)
  this._sendStunMessage(message, cb)
}

TurnSession.prototype.sendRefreshP = function (args) {
  winston.debug('[libturn] send refresh')
  var message = _composeRefreshMessage(args)
  return this._sendStunMessageP(message)
}

// Send data via relay/turn server
TurnSession.prototype.sendData = function (data, address, port, cb) {
  var args = {
    data: data,
    address: address,
    port: port
  }
  var message = _composeSendMessage(args)
  this._sendStunMessage(message, cb)
}

TurnSession.prototype.sendChannelData = function (channel, data, cb) {
  var message = _composeChannelDataMessage(channel, data)
  this._sendStunMessage(message, cb)
}

/** Message composition */

// TURN messages
function _composeAllocateMessage (args) {
  var margs = merge(Object.create(TurnSession.DEFAULTS), args)
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
  var packet = new Packet(Packet.METHOD.ALLOCATE | Packet.CLASS.REQUEST, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function _composeCreatePermissionMessage (args) {
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
  var packet = new Packet(Packet.METHOD.CREATEPERMISSION | Packet.CLASS.REQUEST, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function _composeSendMessage (args) {
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
  var margs = merge(Object.create(TurnSession.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  attrs.add(new Attributes.XORPeerAddress(margs.address, margs.port))
  if (margs.dontFragment) {
    attrs.add(new Attributes.DontFragment())
  }
  attrs.add(new Attributes.Data(margs.data))
  // create send packet
  var packet = new Packet(Packet.METHOD.SEND | Packet.CLASS.INDICATION, attrs)
  // encode packet
  var message = packet.encode()
  return message
}

function _composeChannelBindMessage (args) {
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
  var packet = new Packet(Packet.METHOD.CHANNELBIND | Packet.CLASS.REQUEST, attrs)
  // create channelBind packet
  var message = packet.encode()
  return message
}

function _composeChannelDataMessage (channel, data) {
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

function _composeRefreshMessage (args) {
  var margs = merge(Object.create(TurnSession.DEFAULTS), args)
  // create attrs
  var attrs = new Attributes()
  _addSecurityAttributes(attrs, margs)
  attrs.add(new Attributes.Software(margs.software))
  attrs.add(new Attributes.Lifetime(margs.lifetime))
  // create refresh packet
  var packet = new Packet(Packet.METHOD.REFRESH | Packet.CLASS.REQUEST, attrs)
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

module.exports = TurnSession
