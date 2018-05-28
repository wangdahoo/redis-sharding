const HashRing = require('hashring')
const redis = require('redis')
const bluebird = require('bluebird')
const LOG_LABEL = '[REDIS SHARDING]'

function log () {
  arguments[0] = `${LOG_LABEL} ${(arguments[0] || '')}`
  process.env.NODE_EMV !== 'production'
    ? console.log.apply(this, arguments)
    : void 666
}

const getMethods = obj => {
  const methods = []
  for (let i in obj) {
    if (obj.hasOwnProperty(i) && typeof obj[i] === 'function') {
      methods.push(i)
    }
  }
  return methods
}

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
    if (callee === 'multi') throw new TypeError('client.multi is not a function')

    let client
    const server = this.__hashring__.get(args[0])
    return createClient(server)
      .then(_client => {
        client = _client
        return client[`${callee}Async`].apply(client, args)
      })
      .then(reply => {
        client.quit()
        log(`reply by ${server} =>`, reply)
        return reply === 'OK'
          ? server
          : reply
      })
  }
}

class MultiCommand {
  constructor (server, command, args) {
    this.server = server
    this.command = command
    this.args = args
    this.reply = undefined
  }

  setReply (reply) {
    this.reply = reply
  }
}

class RedisMultiProxy {
  constructor (hashring) {
    this.__hashring__ = hashring
    this.__multis__ = {}
    this.__clients__ = {}
    this.__commands__ = []
  }
  
  _save_command (server, command, args) {
    this.__commands__.push(new MultiCommand(server, command, args))
  }

  _save_replies (server, replies) {
    let saved = 0
    let len = replies.length
    replies = replies.reverse()
    for (let c of this.__commands__) {
      if (c.server === server) {
        const reply = replies.pop()
        c.setReply(reply === 'OK' ? server : reply)
        saved++
      }
    }
    return saved === len && replies.length === 0
  }

  _get_all_replies () {
    const replies = []
    this.__commands__.forEach((c, i) => {
      replies[i] = c.reply
    })
    return replies
  }

  _destroy_all_clients () {
    for (let server in this.__clients__) {
      this.__clients__[server].quit()
    }
  }

  _get_multi (server) {
    const _multi = server => createClient(server)
      .then(client => {
        this.__clients__[server] = client
        this.__multis__[server] = client.multi()
        return this.__multis__[server]
      })

    return this.__multis__[server]
      ? Promise.resolve(this.__multis__[server])
      : _multi(server)
  }

  __call__ (callee, args) {
    if (callee === 'exec') throw new TypeError(`multi.${callee} is not a function, use multi.execAsync instead.`)
    // discard
    if (callee === 'discardAsync' || callee === 'discard') throw new Error('Not Implemented')

    // exec
    if (callee === 'execAsync') {
      const p = []
      for (let server in this.__multis__) {
        p.push(this.__multis__[server].execAsync().then(replies => {
          log(`replies by ${server} =>`, replies)
          return this._save_replies(server, replies)
        }))
      }

      return Promise.all(p).then(() => {
        this._destroy_all_clients()
        return this._get_all_replies()
      })
    }

    const server = this.__hashring__.get(args[0])
    return this._get_multi(server)
      .then(multi => {
        this._save_command(server, callee, args)
        return multi[`${callee}`].apply(multi, args)
      })
  }
}

// extend proxy
const PROXY_TYPE_CLIENT = 'client'
const PROXY_TYPE_MULTI = 'multi'

const extend = (proxyType, proxy, suffix) => {
  const methods = proxyType === PROXY_TYPE_CLIENT
    ? getMethods(redis.RedisClient.prototype)
    : getMethods(redis.Multi.prototype) // proxyType === 'multi'

  for (let i of methods) {
    proxy[`${i}${suffix}`] = function () {
      return proxy.__call__(i, arguments)
    }
  }
  return proxy
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
    return extend(PROXY_TYPE_CLIENT, client, suffix)
  }

  getMulti () {
    const multi = new RedisMultiProxy(this.__hashring__)
    return extend(PROXY_TYPE_MULTI, multi, '')
  }

  getServer (key) {
    return this.__hashring__.get(key)
  }
}

module.exports = Sharding
