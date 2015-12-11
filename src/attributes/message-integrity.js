var crypto = require('crypto')
var winston = require('winston')

var MessageIntegrityAttr = function (request, hash) {
  if (request) {
    if (request.username === undefined || request.password === undefined) {
      var error = '[libturn] invalid message integrity attribute'
      winston.error(error)
      throw new Error(error)
    }
  }
  this.request = request
  this.hash = hash
  this.type = 0x0008
  winston.debug('[libturn] message integrity attr: request = ' + JSON.stringify(this.request) + ', hash = ' + this.hash)
}

MessageIntegrityAttr.prototype.encode = function (packetBytes) {
  if (packetBytes === undefined) {
    var error = '[libturn] invalid MessageIntegrityAttr.encode attributes'
    winston.error(error)
    throw new Error(error)
  }
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var key
  if (this.request.realm && this.request.realm !== '') {
    var md5 = crypto.createHash('md5')
    md5.update([this.request.username, this.request.realm, this.request.password].join(':'))
    key = md5.digest()
  } else {
    key = this.request.password
  }
  var hmac = crypto.createHmac('sha1', key)
  hmac.update(packetBytes)
  var valueBytes = new Buffer(hmac.digest())
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes])
  // done
  return result
}

MessageIntegrityAttr.decode = function (attrBytes) {
  if (attrBytes.length !== 20) {
    var error = '[libturn] invalid message integrity attribute'
    winston.error(error)
    throw new Error(error)
  }
  var hash = attrBytes.toString('hex')
  return new MessageIntegrityAttr(null, hash)
}

module.exports = MessageIntegrityAttr
