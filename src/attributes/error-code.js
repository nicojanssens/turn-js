var padding = require('./padding')
var winston = require('winston')

var ErrorCodeAttr = function (code, reason) {
  if (code === undefined) {
    var undefinedCodeError = '[libturn] invalid error code attribute'
    winston.error(undefinedCodeError)
    throw new Error(undefinedCodeError)
  }
  if (code < 300 || code >= 700) {
    var invalidCodeError = '[libturn] invalid error code'
    winston.error(invalidCodeError)
    return new Error(invalidCodeError)
  }
  reason = reason || ErrorCodeAttr.REASON[code]
  if (reason.length >= 128) {
    var invalidReasonError = '[libturn] invalid error reason'
    winston.error(invalidReasonError)
    return new Error(invalidReasonError)
  }
  this.code = code
  this.reason = reason
  this.type = 0x0009

  winston.debug('[libturn] error code attr: code = ' + this.code + ', reason = ' + this.reason)
}

// error codes
ErrorCodeAttr.REASON = {
  300: 'Try Alternate',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  420: 'Unknown Attribute',
  437: 'Allocation Mismatch',
  438: 'Stale Nonce',
  441: 'Wrong Credentials',
  442: 'Unsupported Transport Protocol',
  486: 'Allocation Quota Reached',
  500: 'Server Error',
  508: 'Insufficient Capacity'
}

ErrorCodeAttr.prototype.encode = function () {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(this.type, 0)
  // value
  var valueBytes = new Buffer(4 + this.reason.length)
  valueBytes.writeUInt16BE(0, 0)
  valueBytes.writeUInt8(this.code / 100 | 0, 2)
  valueBytes.writeUInt8(this.code % 100, 3)
  valueBytes.write(this.reason, 4)
  // length
  var lengthBytes = new Buffer(2)
  lengthBytes.writeUInt16BE(valueBytes.length, 0)
  // padding
  var paddingBytes = padding.getBytes(valueBytes.length)
  // combination
  var result = Buffer.concat([typeBytes, lengthBytes, valueBytes, paddingBytes])
  // done
  return result
}

ErrorCodeAttr.decode = function (attrBytes) {
  var code = attrBytes.readUInt8(2) * 100 + attrBytes.readUInt8(3) % 100
  var reason = attrBytes.toString('utf8', 4)

  if (reason.length >= 128) {
    throw new Error('[libturn] invalid error code')
  }
  if (code < 300 || code >= 700) {
    throw new Error('[libturn] invalid error code')
  }

  return new ErrorCodeAttr(code, reason)
}

module.exports = ErrorCodeAttr
