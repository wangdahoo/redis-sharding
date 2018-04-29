const HashRing = require('hashring')
const redis = require('redis')
const bluebird = require('bluebird')

const getMethods = obj => {
  const methods = []
  for (let i in obj) {
    if (obj.hasOwnProperty(i) && typeof obj[i] === 'function') {
      methods.push(i)
    }
  }
  return methods
}

const clientMethods = getMethods(redis.RedisClient.prototype)

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const createClient = server => {
  return new Promise((resolve, reject) => {
    const client = redis.createClient(`redis://${server}`)
    client.on('connect', () => resolve(client))
    client.on('error', e => reject(e))
  })
}

class RedisClientProxy {
  constructor (hashring) {
    this.__hashring__ = hashring
  }

  __call__ (callee, args) {
    let client
    const server = this.__hashring__.get(args[0])
    return createClient(server)
      .then(_client => {
        client = _client
        return client[`${callee}Async`].apply(client, args)
      })
      .then(reply => {
        client.quit()
        return reply === 'OK'
          ? server
          : reply
      })
  }
}

const extend = (client, suffix) => {
  for (let i of clientMethods) {
    client[`${i}${suffix}`] = function () {
      return client.__call__(i, arguments)
    }
  }
  return client
}

const shardingDefaultOptions = {
  useAsyncSuffix: false
}

class Sharding {
  constructor (servers) {
    this.__hashring__ = new HashRing(servers)
    this.options = shardingDefaultOptions
  }

  get defaults () {
    return this.options
  }

  set defaults (options) {
    this.options = Object.assign({}, shardingDefaultOptions, options)
  }

  getClient () {
    const client = new RedisClientProxy(this.__hashring__)
    const suffix = this.options.useAsyncSuffix ? 'Async' : ''
    return extend(client, suffix)
  }
}

module.exports = Sharding
