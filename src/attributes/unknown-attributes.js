var winston = require('winston')

var UnknownAttributesAttr = function (value) {
  this.value = value
  this.type = 0x000A
  winston.debug('[libturn] unknown attributes attr: ' + JSON.stringify(this.value))
}

UnknownAttributesAttr.prototype.encode = function () {
  throw new Error('[libturn] unknown-attributes.encode not implemented yet')
}

UnknownAttributesAttr.decode = function (attrBytes) {
  var unknownAttrs = []
  var offset = 0

  while (offset < attrBytes.length) {
    unknownAttrs.push(attrBytes.readUInt16BE(offset))
    offset += 2
  }

  return new UnknownAttributesAttr(unknownAttrs)
}

module.exports = UnknownAttributesAttr
