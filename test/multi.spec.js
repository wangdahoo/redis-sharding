const assert = require('assert')
const Sharding = require('../lib')
const sharding = new Sharding({
  '127.0.0.1:7000': { vnodes: 50 },
  '127.0.0.1:7001': { vnodes: 50 },
  '127.0.0.1:7002': { vnodes: 50 },
  '127.0.0.1:7003': { vnodes: 50 }
})

/** need support this stuff */

// const multi = sharding.getMulti()

// multi
//   .set('a', 'foo') // => 7002
//   .set('b', 'bar') // => 7000
//   .get('a')
//   .execAsync()
//   .then(reply => console.log(reply))
